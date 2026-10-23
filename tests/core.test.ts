import { test } from "node:test";
import assert from "node:assert/strict";
import {
  metrics,
  mergeSnapshots,
  mergeProject,
  slugFor,
} from "../src/lib/metrics";
import {
  classify,
  hasSkillEvidence,
  validateLabels,
  applyOverride,
} from "../src/lib/classify";
import { parseTrending, retainTrend } from "../src/lib/trending";
import { enrich, providerAllowed, type Usage } from "../src/lib/ai";
import { retryDelay } from "../src/lib/github";
import settings from "../config/settings.json";
import type { Project } from "../src/lib/types";
const now = Date.parse("2026-10-23T00:23:00Z");
const DAY = 86400000;
function project(): Project {
  const at = new Date(now).toISOString();
  return {
    id: 1,
    fullName: "owner/AI-video",
    slug: "owner-ai-video-1",
    url: "https://github.com/owner/AI-video",
    description: "AI video generation",
    homepage: null,
    stars: 240,
    forks: 2,
    language: "TypeScript",
    topics: ["ai-video"],
    license: "MIT",
    archived: false,
    unavailable: false,
    pushedAt: at,
    createdAt: at,
    firstSeenAt: new Date(now - 7 * DAY).toISOString(),
    fetchedAt: at,
    defaultBranch: "main",
    sources: ["trending"],
    skillEvidence: false,
    classification: classify(
      {
        description: "AI video generation",
        fullName: "owner/AI-video",
        topics: [],
      },
      "",
      false,
      at,
    ),
    snapshots: Array.from({ length: 8 }, (_, i) => ({
      at: new Date(now - (7 - i) * DAY).toISOString(),
      stars: 100 + i * 20,
    })),
  };
}
test("7-day hot and rising require genuine observed endpoints", () => {
  const m = metrics(project(), now);
  assert.equal(m.delta, 140);
  assert.equal(m.rate, 1.4);
  assert.equal(m.complete, true);
  assert.equal(m.rising, true);
});
test("cold start has no synthetic trend", () => {
  const p = project();
  p.snapshots = p.snapshots.slice(-1);
  assert.equal(metrics(p, now).delta, null);
  assert.equal(metrics(p, now).hot, false);
});
test("missing middle day permits measured delta but forbids sustained label", () => {
  const p = project();
  p.snapshots.splice(3, 1);
  assert.equal(metrics(p, now).delta, 140);
  assert.equal(metrics(p, now).rising, false);
});
test("missing 7-day endpoint cannot borrow 6-day data", () => {
  const p = project();
  p.snapshots.shift();
  assert.equal(metrics(p, now).delta, null);
});
test("negative stars are preserved and excluded from hot", () => {
  const p = project();
  p.snapshots[7].stars = 80;
  const m = metrics(p, now);
  assert.equal(m.delta, -20);
  assert.equal(m.hot, false);
});
test("absolute and relative threshold boundaries", () => {
  const p = project();
  p.snapshots[7].stars = 130;
  assert.equal(metrics(p, now).hot, true);
  p.snapshots[7].stars = 129;
  assert.equal(metrics(p, now).hot, false);
  p.snapshots[0].stars = 1000;
  p.snapshots[7].stars = 1100;
  assert.equal(metrics(p, now).hot, true);
});
test("zero baseline never creates infinite percent", () => {
  const p = project();
  p.snapshots[0].stars = 0;
  assert.equal(metrics(p, now).rate, null);
});
test("archive, unavailability, stale snapshot and stale maintenance exclusion", () => {
  for (const field of ["archived", "unavailable"] as const) {
    const p = project();
    p[field] = true;
    assert.equal(metrics(p, now).hot, false);
  }
  const p = project();
  p.pushedAt = new Date(now - 91 * DAY).toISOString();
  assert.equal(metrics(p, now).hot, false);
  assert.equal(metrics(project(), now + 3 * DAY).delta, null);
});
test("same-day rerun replaces one point and keeps 90-day window", () => {
  const p = project();
  const points = mergeSnapshots(
    [{ at: new Date(now - 100 * DAY).toISOString(), stars: 1 }, ...p.snapshots],
    { at: new Date(now + 1000).toISOString(), stars: 250 },
  );
  assert.equal(points.length, 8);
  assert.equal(points.at(-1)?.stars, 250);
});
test("renamed repository retains history by immutable ID", () => {
  const old = project();
  const changed = {
    ...project(),
    fullName: "new-owner/new-name",
    snapshots: [{ at: new Date(now + DAY).toISOString(), stars: 260 }],
  };
  const p = mergeProject(old, changed);
  assert.equal(p.id, 1);
  assert.equal(p.snapshots.length, 9);
  assert.equal(p.firstSeenAt, old.firstSeenAt);
  assert.match(slugFor(changed.fullName, 1), /-1$/);
});
test("skill needs affirmative file or install evidence", () => {
  assert.equal(hasSkillEvidence("Improve coding skills"), false);
  assert.equal(hasSkillEvidence("npx skills add org/repo"), true);
  assert.equal(hasSkillEvidence("", ["skills/video/SKILL.md"]), true);
  assert.equal(validateLabels(["video"], ["skill"], false), false);
});
test("video does not match IDE substring", () => {
  const c = classify(
    { description: "AI video generation", topics: [], fullName: "o/video" },
    "",
    false,
    "2026-10-23",
  );
  assert(c.categories.includes("video"));
  assert(!c.categories.includes("coding"));
});
test("unrelated PHP interpreter is not AI", () => {
  assert.equal(
    classify(
      {
        description: "The PHP interpreter",
        topics: ["php"],
        fullName: "php/php-src",
      },
      "Build PHP",
      false,
      "2026-10-23",
    ).aiRelated,
    false,
  );
});
test("manual corrections take precedence", () => {
  assert.equal(
    applyOverride(project(), {
      summary: "人工审校的中文摘要",
      categories: ["video"],
    }).classification.status,
    "manual",
  );
});
test("Trending parser and stale fallback", () => {
  const entries = parseTrending(
    '<article class="Box-row"><h2><a href="/foo/bar"> foo / bar </a></h2><span>1,234 stars this week</span></article>',
  );
  assert.equal(entries[0].starsInPeriod, 1234);
  assert.throws(() => parseTrending("<h1>Rate limited</h1>"));
  const old = { fetchedAt: "2026-10-22", entries };
  assert.deepEqual(retainTrend(old, null, "2026-10-23").entries, entries);
  assert.equal(retainTrend(old, null, "2026-10-23").fetchedAt, old.fetchedAt);
});
test("GitHub rate limits respect Retry-After and reset", () => {
  assert.equal(
    retryDelay(429, new Headers({ "retry-after": "12" }), 0, now),
    12000,
  );
  assert.equal(retryDelay(404, new Headers(), 0, now), null);
  assert.equal(
    retryDelay(
      403,
      new Headers({
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String((now + 20000) / 1000),
      }),
      0,
      now,
    ),
    20000,
  );
});
test("no paid model fallback or unconfirmed Groq", () => {
  assert.equal(
    providerAllowed(
      { ...settings.providers[0], model: "expensive/model" },
      { OPENROUTER_API_KEY: "test" },
    ),
    false,
  );
  assert.equal(
    providerAllowed(settings.providers[1], { GROQ_API_KEY: "test" }),
    false,
  );
});
test("AI quota failure falls through to configured free backup", async () => {
  const calls: string[] = [];
  const usage: Usage = { day: "2026-10-23", projects: 0, providers: {} };
  const request = (async (url: any) => {
    calls.push(String(url));
    return calls.length === 1
      ? new Response("{}", { status: 429 })
      : new Response(
          JSON.stringify({
            model: "test-free",
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    aiRelated: true,
                    summary: "用于视频生成的开源工具，支持自动化创作工作流。",
                    categories: ["video"],
                    forms: ["app"],
                    tags: ["视频"],
                    reason: "项目说明明确提供 AI 视频生成能力。",
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        );
  }) as typeof fetch;
  const output = await enrich(project(), "AI video", usage, request, {
    OPENROUTER_API_KEY: "dummy",
    GROQ_API_KEY: "dummy",
    GROQ_FREE_TIER_CONFIRMED: "true",
  });
  assert.equal(output?.status, "ai");
  assert.equal(calls.length, 2);
  assert.equal(usage.providers.openrouter, settings.providers[0].dailyLimit);
});
test("invalid output and exhausted budget retain rule classification", async () => {
  const request = (async () =>
    new Response(
      JSON.stringify({ choices: [{ message: { content: "not json" } }] }),
    )) as typeof fetch;
  assert.equal(
    await enrich(
      project(),
      "readme",
      { day: "d", projects: 0, providers: {} },
      request,
      { OPENROUTER_API_KEY: "dummy" },
    ),
    null,
  );
  let called = false;
  await enrich(
    project(),
    "readme",
    { day: "d", projects: 30, providers: {} },
    (async () => {
      called = true;
      throw Error();
    }) as typeof fetch,
    { OPENROUTER_API_KEY: "dummy" },
  );
  assert.equal(called, false);
});

test("a bare mention of SKILL.md is not proof of a usable skill", () => {
  assert.equal(
    hasSkillEvidence("This article explains what SKILL.md means."),
    false,
  );
  assert.equal(
    hasSkillEvidence("android skills add r8-analyzer --project=."),
    true,
  );
});
