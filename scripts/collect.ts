import { readFile, writeFile, rename } from "node:fs/promises";
import { GitHub } from "../src/lib/github";
import { queries } from "../src/lib/taxonomy";
import { classify, hasSkillEvidence, applyOverride } from "../src/lib/classify";
import { mergeProject, slugFor } from "../src/lib/metrics";
import { parseTrending, retainTrend } from "../src/lib/trending";
import { enrich, providerAllowed, type Usage } from "../src/lib/ai";
import type { Catalog, Project, Override } from "../src/lib/types";
import settings from "../config/settings.json";
const at = new Date().toISOString();
const day = at.slice(0, 10);
const catalog: Catalog = JSON.parse(
  await readFile("data/catalog.json", "utf8"),
);
const overrides: Record<string, Override> = JSON.parse(
  await readFile("config/overrides.json", "utf8"),
);
let usage: Usage = JSON.parse(await readFile("data/ai-usage.json", "utf8"));
if (usage.day !== day) usage = { day, projects: 0, providers: {} };
const github = new GitHub();
const warnings: string[] = [];
const oldById = new Map(catalog.projects.map((p) => [p.id, p]));
const candidates = new Map<number, any>();
const sources = new Map<number, Set<string>>();
function offer(repo: any, source: string) {
  if (!repo?.id) return;
  candidates.set(repo.id, repo);
  if (!sources.has(repo.id)) sources.set(repo.id, new Set());
  sources.get(repo.id)!.add(source);
}
// HTML discovery is deliberately isolated: a markup change cannot erase the previous list.
for (const period of ["daily", "weekly"] as const) {
  try {
    const res = await fetch(`https://github.com/trending?since=${period}`, {
      headers: { "User-Agent": "AI-Trend-Radar/1.0" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    catalog.trending[period] = retainTrend(
      catalog.trending[period],
      parseTrending(await res.text()),
      at,
    );
  } catch (e) {
    const message = `${period} Trending 暂不可用`;
    warnings.push(message);
    catalog.trending[period] = retainTrend(
      catalog.trending[period],
      null,
      at,
      message,
    );
  }
}
const trendNames = [
  ...new Set(
    [...catalog.trending.weekly.entries, ...catalog.trending.daily.entries].map(
      (e) => e.fullName,
    ),
  ),
];
for (const name of trendNames) {
  try {
    offer(await github.get(`/repos/${name}`), "trending");
  } catch {
    warnings.push(`无法读取 ${name}`);
  }
}
const recent = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
for (const [category, q] of queries) {
  console.log(`检索分类 ${category}`);
  try {
    const data = await github.get(
      `/search/repositories?q=${encodeURIComponent(q + " archived:false fork:false stars:>=50 pushed:>=" + recent)}&sort=stars&order=desc&per_page=10`,
    );
    for (const repo of data.items || []) offer(repo, `search:${category}`);
  } catch {
    warnings.push(`分类 ${category} 搜索暂不可用`);
  }
}
const limit = catalog.projects.length
  ? settings.trackingLimit
  : settings.initialLimit;
// Existing projects keep their tracking slot; new projects share remaining slots round-robin by source.
const selected = new Map<number, any>();
const existing = [...catalog.projects]
  .sort(
    (a, b) =>
      Number(b.classification.aiRelated) - Number(a.classification.aiRelated) ||
      b.stars - a.stars,
  )
  .slice(0, Math.max(0, limit - 40));
for (const old of existing) {
  try {
    const repo =
      candidates.get(old.id) || (await github.get(`/repositories/${old.id}`));
    selected.set(old.id, repo);
  } catch (e: any) {
    if (e.status === 404 || e.status === 410) old.unavailable = true;
    warnings.push(`未更新 ${old.fullName}`);
  }
}
for (const name of trendNames) {
  const r = [...candidates.values()].find(
    (r) => r.full_name.toLowerCase() === name.toLowerCase(),
  );
  if (r && selected.size < limit) selected.set(r.id, r);
}
const buckets = new Map<string, any[]>();
for (const [cat] of queries) if (!buckets.has(cat)) buckets.set(cat, []);
for (const r of candidates.values()) {
  for (const source of sources.get(r.id) || []) {
    if (source.startsWith("search:")) buckets.get(source.slice(7))?.push(r);
  }
}
for (let n = 0; n < 20 && selected.size < limit; n++)
  for (const list of buckets.values()) {
    const r = list[n];
    if (r && selected.size < limit) selected.set(r.id, r);
  }
console.log(`发现 ${candidates.size} 个候选，更新 ${selected.size} 个仓库`);
const result = new Map(oldById);
let refreshed = 0;
const priority = [...selected.values()].sort(
  (a, b) =>
    Number(
      trendNames.some((n) => n.toLowerCase() === b.full_name.toLowerCase()),
    ) -
      Number(
        trendNames.some((n) => n.toLowerCase() === a.full_name.toLowerCase()),
      ) || b.stargazers_count - a.stargazers_count,
);
for (const repo of priority) {
  const old = oldById.get(repo.id);
  let readme = "";
  let readmeFetched = false;
  const needsReadme =
    !old ||
    old.pushedAt !== repo.pushed_at ||
    (old.classification.status === "rules" &&
      settings.providers.some((p) => providerAllowed(p, process.env)) &&
      usage.projects < settings.aiDailyLimit);
  if (needsReadme && github.count < settings.githubRequestBudget - 10) {
    try {
      const file = await github.get(`/repos/${repo.full_name}/readme`);
      readme = Buffer.from(file.content || "", "base64").toString("utf8");
      readmeFetched = true;
    } catch {
      /* keep previous classification on transient errors */
    }
  }
  let skillEvidence = readmeFetched
    ? hasSkillEvidence(readme)
    : old?.skillEvidence || false;
  if (
    readmeFetched &&
    !skillEvidence &&
    /SKILL\.md|agent.skills/i.test(readme)
  ) {
    try {
      const tree = await github.get(
        `/repos/${repo.full_name}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`,
      );
      skillEvidence = hasSkillEvidence(
        readme,
        (tree.tree || []).map((entry: any) => entry.path),
      );
    } catch {
      skillEvidence = old?.skillEvidence || false;
    }
  }
  const rules = classify(
    {
      fullName: repo.full_name,
      description: repo.description || "",
      topics: repo.topics || [],
    },
    readme,
    skillEvidence,
    at,
  );
  let classification = old?.classification || rules;
  if (
    readmeFetched &&
    (!old ||
      rules.readmeHash !== old.classification.readmeHash ||
      old.classification.status === "rules")
  )
    classification = rules;
  let project: Project = {
    id: repo.id,
    fullName: repo.full_name,
    slug: slugFor(repo.full_name, repo.id),
    url: repo.html_url,
    description: repo.description || "",
    homepage: repo.homepage || null,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    language: repo.language,
    topics: repo.topics || [],
    license: repo.license?.spdx_id || null,
    archived: repo.archived,
    unavailable: false,
    pushedAt: repo.pushed_at,
    createdAt: repo.created_at,
    firstSeenAt: at,
    fetchedAt: at,
    defaultBranch: repo.default_branch,
    readmeCheckedAt: readmeFetched ? at : old?.readmeCheckedAt,
    sources: [...(sources.get(repo.id) || new Set(["tracked"]))],
    skillEvidence,
    classification,
    snapshots: [{ at, stars: repo.stargazers_count }],
  };
  project = mergeProject(old, project);
  if (readmeFetched && project.classification.status === "rules")
    project.classification =
      (await enrich(project, readme, usage)) || project.classification;
  const override = overrides[String(project.id)] || overrides[project.fullName];
  project = applyOverride(project, override);
  if (override?.exclude) {
    result.delete(project.id);
    continue;
  }
  result.set(project.id, project);
  refreshed++;
  if (refreshed % 25 === 0)
    console.log(`已更新 ${refreshed} 个，GitHub 请求 ${github.count}`);
}
if (!refreshed) throw new Error("本轮没有成功更新任何仓库，未覆盖已有目录");
catalog.projects = [...result.values()].filter(
  (p) => !(overrides[String(p.id)] || overrides[p.fullName])?.exclude,
);
catalog.generatedAt = at;
catalog.lastSuccessfulCollectionAt = at;
catalog.warnings = warnings;
await writeFile(
  "data/catalog.json.tmp",
  JSON.stringify(catalog, null, 2) + "\n",
);
await rename("data/catalog.json.tmp", "data/catalog.json");
await writeFile("data/ai-usage.json", JSON.stringify(usage, null, 2) + "\n");
console.log(
  JSON.stringify({
    updated: refreshed,
    total: catalog.projects.length,
    aiRelated: catalog.projects.filter((p) => p.classification.aiRelated)
      .length,
    githubRequests: github.count,
    aiCalls: usage.providers,
    warnings,
  }),
);
