import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import type { Project } from "./types";
import { readmeLanguage, type ReadmeBundle, type ReadmeFile } from "./readme";
import type { GitHub } from "./github";
import { redactReadme } from "./redact";
export async function loadReadmes(id: number): Promise<ReadmeBundle | null> {
  try {
    return JSON.parse(await readFile(`data/readmes/${id}.json`, "utf8"));
  } catch {
    return null;
  }
}
export async function refreshReadmes(
  github: Pick<GitHub, "get">,
  p: Pick<Project, "id" | "fullName" | "defaultBranch">,
  initial?: any,
): Promise<ReadmeBundle> {
  const old = await loadReadmes(p.id);
  const now = new Date().toISOString();
  const files: ReadmeFile[] = [];
  try {
    const main = initial || (await github.get(`/repos/${p.fullName}/readme`));
    const mainText = Buffer.from(main.content || "", "base64").toString("utf8");
    const root = await github.get(`/repos/${p.fullName}/contents/`);
    const paths = new Set<string>([main.path || "README.md"]);
    for (const entry of root)
      if (entry.type === "file" && readmeLanguage(entry.path))
        paths.add(entry.path);
    // Follow README translation links in subdirectories, never arbitrary external URLs.
    for (const match of mainText.matchAll(
      /(?:\]\(|href=["'])([^\s)"'#?]+readme[^\s)"'#?]*\.(?:md|markdown))/gi,
    )) {
      const candidate = match[1].replace(/^\.\//, "");
      if (
        !candidate.includes("..") &&
        !candidate.startsWith("/") &&
        !candidate.includes(":") &&
        readmeLanguage(candidate) &&
        /readme[._-](en|english|zh|cn|chinese)/i.test(candidate)
      )
        paths.add(candidate);
    }
    const priority = (name: string) =>
      /^readme[._-]/i.test(name) ? 0 : name === main.path ? 1 : 2;
    const preferred = [...paths].sort((a, b) => priority(a) - priority(b));
    for (const filename of preferred) {
      let language = readmeLanguage(filename);
      if (!language) continue;
      const data =
        filename === main.path
          ? main
          : await github.get(
              `/repos/${p.fullName}/contents/${filename.split("/").map(encodeURIComponent).join("/")}`,
            );
      if (data.encoding !== "base64" || !data.content || data.size > 600000)
        continue;
      const { markdown, redactions } = redactReadme(
        Buffer.from(data.content, "base64").toString("utf8"),
      );
      // A Chinese-only default README is a Chinese source, not an English translation.
      if (/^readme\.(md|markdown)$/i.test(filename)) {
        const prose = markdown
          .replace(/```[\s\S]*?```/g, "")
          .replace(/https?:\/\/\S+/g, "")
          .replace(/<[^>]*>/g, "");
        const han = prose.match(/[\u4e00-\u9fff]/g)?.length || 0;
        const latin = prose.match(/[a-z]/gi)?.length || 0;
        if (
          han > 30 &&
          (han / Math.max(1, han + latin) > 0.18 ||
            files.some((f) => f.language === "en"))
        )
          language = "zh";
      }
      if (!files.some((f) => f.language === language))
        files.push({
          language,
          path: filename,
          markdown,
          ...(redactions ? { redactions } : {}),
          sha: data.sha,
          fetchedAt: now,
        });
    }
    if (!files.length) throw new Error("No supported README");
    const bundle: ReadmeBundle = {
      repository: p.fullName,
      branch: p.defaultBranch,
      checkedAt: now,
      files,
    };
    await save(p.id, bundle);
    return bundle;
  } catch {
    const bundle: ReadmeBundle = old
      ? { ...old, error: "最近一次抓取失败，保留上次成功内容。" }
      : {
          repository: p.fullName,
          branch: p.defaultBranch,
          checkedAt: now,
          files: [],
          error: "暂未抓取到 README，可前往 GitHub 阅读。",
        };
    await save(p.id, bundle);
    return bundle;
  }
}
async function save(id: number, bundle: ReadmeBundle) {
  await mkdir("data/readmes", { recursive: true });
  await writeFile(
    `data/readmes/${id}.json.tmp`,
    JSON.stringify(bundle, null, 2) + "\n",
  );
  await rename(`data/readmes/${id}.json.tmp`, `data/readmes/${id}.json`);
}
