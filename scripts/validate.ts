import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { validateLabels } from "../src/lib/classify";
import type { Catalog } from "../src/lib/types";
const data: Catalog = JSON.parse(await readFile("data/catalog.json", "utf8"));
assert.equal(data.schemaVersion, 1);
const ids = new Set<number>();
const slugs = new Set<string>();
for (const p of data.projects) {
  assert(!ids.has(p.id), "duplicate ID");
  ids.add(p.id);
  assert(!slugs.has(p.slug), "duplicate slug");
  slugs.add(p.slug);
  assert(Number.isInteger(p.stars) && p.stars >= 0);
  assert(p.url.startsWith("https://github.com/"));
  assert(
    validateLabels(
      p.classification.categories,
      p.classification.forms,
      p.skillEvidence,
    ),
    `invalid labels: ${p.fullName}`,
  );
  assert(Number.isFinite(Date.parse(p.fetchedAt)));
  const dates = new Set<string>();
  for (const s of p.snapshots) {
    assert(Number.isInteger(s.stars) && s.stars >= 0);
    assert(Number.isFinite(Date.parse(s.at)));
    assert(!dates.has(s.at.slice(0, 10)));
    dates.add(s.at.slice(0, 10));
  }
}
console.log(`Validated ${ids.size} projects and observed snapshots.`);
