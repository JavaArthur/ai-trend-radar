import { readFile } from "node:fs/promises";
import { GitHub } from "../src/lib/github";
import { refreshReadmes, loadReadmes } from "../src/lib/readme-store";
import { family, featuredNames } from "../src/lib/directory";
import type { Catalog } from "../src/lib/types";
const catalog: Catalog = JSON.parse(
  await readFile("data/catalog.json", "utf8"),
);
const github = new GitHub();
let refreshed = 0;
const projects = catalog.projects
  .filter((p) => family(p))
  .sort(
    (a, b) =>
      Number(featuredNames.includes(b.fullName)) -
      Number(featuredNames.includes(a.fullName)),
  );
for (const p of projects) {
  const old = await loadReadmes(p.id);
  if (old?.files.length && !process.argv.includes("--force")) continue;
  const bundle = await refreshReadmes(github, p);
  console.log(
    `${p.fullName}: ${bundle.files.map((f) => f.language + ":" + f.path).join(", ") || bundle.error}`,
  );
  refreshed++;
}
console.log(
  `README sync: ${refreshed} repositories, ${github.count} API requests`,
);
