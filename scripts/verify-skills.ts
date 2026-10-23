import { readFile, writeFile } from "node:fs/promises";
import { GitHub } from "../src/lib/github";
import { hasSkillEvidence } from "../src/lib/classify";
import type { Catalog, Override } from "../src/lib/types";
const c: Catalog = JSON.parse(await readFile("data/catalog.json", "utf8"));
const overrides: Record<string, Override> = JSON.parse(
  await readFile("config/overrides.json", "utf8"),
);
const github = new GitHub();
let verified = 0;
let removed = 0;
for (const p of c.projects.filter((p) => p.skillEvidence)) {
  try {
    const tree = await github.get(
      `/repos/${p.fullName}/git/trees/${encodeURIComponent(p.defaultBranch)}?recursive=1`,
    );
    const paths = (tree.tree || [])
      .map((t: any) => t.path)
      .filter((path: string) => /(^|\/)SKILL\.md$/i.test(path));
    let evidence = paths.length > 0;
    if (!evidence) {
      const file = await github.get(`/repos/${p.fullName}/readme`);
      evidence = hasSkillEvidence(
        Buffer.from(file.content || "", "base64").toString("utf8"),
      );
    }
    p.skillEvidence = evidence;
    p.classification.evidence = p.classification.evidence.filter(
      (e) => !(e.source === "readme" && /SKILL\.md/.test(e.text)),
    );
    if (evidence) {
      p.classification.evidence.push({
        source: "readme",
        text: paths.length
          ? `已核实实际技能文件：${paths.slice(0, 3).join("、")}`
          : "README 中有明确的技能安装命令",
      });
      verified++;
    } else {
      p.classification.forms = p.classification.forms.filter(
        (f) => f !== "skill",
      );
      if (!p.classification.forms.length) p.classification.forms = ["app"];
      const o = overrides[String(p.id)];
      if (o?.forms?.includes("skill")) o.forms = p.classification.forms;
      removed++;
      console.log(`移除缺乏依据的 Skill 标签：${p.fullName}`);
    }
  } catch {
    console.log(`未完成核验：${p.fullName}`);
  }
}
await writeFile("data/catalog.json", JSON.stringify(c, null, 2) + "\n");
await writeFile(
  "config/overrides.json",
  JSON.stringify(overrides, null, 2) + "\n",
);
console.log({ verified, removed });
