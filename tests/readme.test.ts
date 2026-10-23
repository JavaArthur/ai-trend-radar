import { test } from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { load } from "cheerio";
import {
  readmeLanguage,
  renderReadme,
  type ReadmeBundle,
} from "../src/lib/readme";
import { refreshReadmes } from "../src/lib/readme-store";
import { family } from "../src/lib/directory";
import type { Project } from "../src/lib/types";
const bundle: ReadmeBundle = {
  repository: "owner/project",
  branch: "main",
  checkedAt: "2026-10-24",
  files: [],
};
test("recognize localized README filenames without treating other languages as English", () => {
  for (const path of [
    "README_zh.md",
    "README_CN.md",
    "readme.zh-CN.md",
    "docs/README.zh-Hans.md",
  ])
    assert.equal(readmeLanguage(path), "zh");
  for (const path of ["README.md", "README_EN.md", "README.en-US.md"])
    assert.equal(readmeLanguage(path), "en");
  for (const path of ["README_JA.md", "README_RU.md", "SKILL.md"])
    assert.equal(readmeLanguage(path), null);
});
test("render relative assets and documents, anchors and tables without executable HTML", () => {
  const html = renderReadme(bundle, {
    language: "zh",
    path: "docs/README_zh.md",
    sha: "a",
    fetchedAt: "now",
    markdown:
      '# 标题\n\n[跳转](#标题)\n\n![图](../assets/image.png)\n\n[说明](guide.md)\n\n<script>alert(1)</script><img src="x" onerror="evil()"><a href="javascript:evil()">bad</a><iframe src="https://evil.test"></iframe>\n\n| A | B |\n|---|---|\n| 1 | 2 |',
  });
  const $ = load(html);
  assert.equal($("h1").length, 0);
  assert.equal($("h2").attr("id"), "readme-zh-标题");
  assert.equal(
    decodeURIComponent($("a").first().attr("href")!),
    "#readme-zh-标题",
  );
  assert.equal(
    $("img").first().attr("src"),
    "https://raw.githubusercontent.com/owner/project/main/assets/image.png",
  );
  assert(
    html.includes("https://github.com/owner/project/blob/main/docs/guide.md"),
  );
  assert.equal($("table").length, 1);
  assert(!/javascript:|onerror|<script|<iframe/.test(html));
});
test("default README wins over linked component readmes; translated docs and stale fallback work", async () => {
  const id = 9999999999001;
  const p = { id, fullName: "test/project", defaultBranch: "main" };
  const make = (path: string, markdown: string) => ({
    path,
    sha: path,
    size: markdown.length,
    encoding: "base64",
    content: Buffer.from(markdown).toString("base64"),
  });
  const main = make(
    "README.md",
    "# Project\n[Demo](demos/README.md)\n[中文](docs/README_zh.md)",
  );
  const calls: string[] = [];
  const github = {
    get: async (path: string) => {
      calls.push(path);
      if (path.endsWith("/readme")) return main;
      if (path.endsWith("/contents/"))
        return [{ type: "file", path: "README.md" }];
      if (path.endsWith("docs/README_zh.md"))
        return make("docs/README_zh.md", "# 项目中文说明");
      throw Error("unexpected");
    },
  };
  try {
    const result = await refreshReadmes(github, p);
    assert.equal(
      result.files.find((f) => f.language === "en")?.path,
      "README.md",
    );
    assert.equal(
      result.files.find((f) => f.language === "zh")?.path,
      "docs/README_zh.md",
    );
    assert(!calls.some((c) => c.includes("demos/")));
    const retained = await refreshReadmes(
      {
        get: async () => {
          throw Error("rate limit");
        },
      },
      p,
    );
    assert.deepEqual(retained.files, result.files);
    assert(retained.error);
    assert.equal(retained.checkedAt, result.checkedAt);
  } finally {
    await rm(`data/readmes/${id}.json`, { force: true });
  }
});
test("Chinese default and explicit English README both remain available", async () => {
  const id = 9999999999002;
  const p = { id, fullName: "test/bilingual", defaultBranch: "main" };
  const make = (path: string, text: string) => ({
    path,
    sha: path,
    size: text.length,
    encoding: "base64",
    content: Buffer.from(text).toString("base64"),
  });
  const main = make(
    "README.md",
    "# 项目说明\n" + "这是中文的项目使用介绍和安装操作说明。".repeat(10),
  );
  const github = {
    get: async (path: string) =>
      path.endsWith("/readme")
        ? main
        : path.endsWith("/contents/")
          ? [
              { type: "file", path: "README.md" },
              { type: "file", path: "README_EN.md" },
            ]
          : make("README_EN.md", "# English introduction"),
  };
  try {
    const result = await refreshReadmes(github, p);
    assert.equal(result.files.length, 2);
    assert.equal(
      result.files.find((f) => f.language === "zh")?.path,
      "README.md",
    );
    assert.equal(
      result.files.find((f) => f.language === "en")?.path,
      "README_EN.md",
    );
  } finally {
    await rm(`data/readmes/${id}.json`, { force: true });
  }
});
test("directory has only verified skills and applications", () => {
  const p = {
    classification: { aiRelated: true, forms: ["framework"] },
    skillEvidence: false,
  } as Project;
  assert.equal(family(p), null);
  p.classification.forms = ["model"];
  assert.equal(family(p), null);
  p.classification.forms = ["resource"];
  assert.equal(family(p), null);
  p.classification.forms = ["skill"];
  assert.equal(family(p), null);
  p.skillEvidence = true;
  assert.equal(family(p), "skills");
  p.classification.forms = ["app", "skill"];
  assert.equal(family(p), "skills");
  p.skillEvidence = false;
  assert.equal(family(p), "tools");
  p.classification.aiRelated = false;
  assert.equal(family(p), null);
});

test("upstream credential examples are redacted before caching and rendering", async () => {
  const { redactReadme } = await import("../src/lib/redact");
  const webhook = [
    "https://hooks.slack.com",
    "services",
    "T0123456789",
    "B0123456789",
    "abcdefghijklmnopqrstuvwx",
  ].join("/");
  const result = redactReadme("Example: " + webhook + "\nHello world");
  assert.equal(result.redactions, 1);
  assert(!result.markdown.includes("hooks.slack"));
  assert(result.markdown.includes("Hello world"));
  const html = renderReadme(bundle, {
    language: "en",
    path: "README.md",
    sha: "a",
    fetchedAt: "now",
    markdown: `[Hook](${webhook})`,
  });
  assert(!html.includes("hooks.slack"));
});
