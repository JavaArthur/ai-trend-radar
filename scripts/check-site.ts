import { readdir, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { load } from "cheerio";
import assert from "node:assert/strict";
const files = (await readdir("dist", { recursive: true })).filter((p) =>
  p.endsWith(".html"),
);
let checked = 0;
for (const file of files) {
  const text = await readFile(join("dist", file), "utf8");
  assert(
    !/gh[pousr]_[A-Za-z0-9]{30,}|sk-or-v1-[A-Za-z0-9]{20,}/.test(text),
    `Potential credential in ${file}`,
  );
  const $ = load(text);
  assert($("title").text().trim(), `Missing title: ${file}`);
  assert.equal($("h1").length, 1, `Heading structure: ${file}`);
  for (const node of $("[href], [src]").toArray()) {
    const value = $(node).attr("href") || $(node).attr("src") || "";
    if (!value.startsWith("/ai-trend-radar/")) continue;
    assert(!value.includes("//"), `Double slash: ${file}`);
    const path = decodeURIComponent(
      value.split(/[?#]/)[0].slice("/ai-trend-radar/".length),
    );
    await access(
      join("dist", path.endsWith("/") || !path ? path + "index.html" : path),
    );
    checked++;
  }
}
console.log(
  `Checked ${files.length} HTML pages and ${checked} local asset/page links; no credential patterns found.`,
);

// The source cache is committed too; scan it as well as the published HTML.
const { redactReadme } = await import("../src/lib/redact");
for (const file of (await readdir("data/readmes")).filter((p) =>
  p.endsWith(".json"),
)) {
  const bundle = JSON.parse(await readFile(join("data/readmes", file), "utf8"));
  for (const source of bundle.files)
    assert.equal(
      redactReadme(source.markdown).redactions,
      0,
      `Credential pattern in README cache ${file}`,
    );
}
console.log("README source caches passed credential-pattern checks.");
