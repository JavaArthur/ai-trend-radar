import { createHash } from "node:crypto";
import { categories, forms } from "./taxonomy";
import type { Classification, Override, Project } from "./types";
const aiPattern =
  /\b(ai|llm|llms|gpt|rag|chatgpt|agentic|claude|codex|diffusion|transformers|pytorch|tensorflow|mcp|machine.learning|deep.learning|neural|lora|ollama|comfyui)\b|人工智能|大模型|智能体|机器学习|深度学习/i;
export function hasSkillEvidence(readme: string, paths: string[] = []) {
  return (
    paths.some((p) => /(^|\/)SKILL\.md$/i.test(p)) ||
    /(?:npx\s+skills|android\s+skills)\s+add\b|(?:cp|mkdir|install)\s[^\n]*\.(?:claude|agents|codex)\/skills\//i.test(
      readme,
    )
  );
}
export function classify(
  input: { description: string; topics: string[]; fullName: string },
  readme: string,
  skillEvidence: boolean,
  at: string,
): Classification {
  const primary = [input.fullName, input.description, ...input.topics].join(
    " ",
  );
  const text = `${primary}\n${readme.slice(0, 18000)}`.toLowerCase();
  const matches = (value: string, term: string) =>
    /[\u4e00-\u9fff]/.test(term)
      ? value.includes(term)
      : new RegExp(
          "(?:^|[^a-z0-9])" +
            term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
            "(?:$|[^a-z0-9])",
          "i",
        ).test(value);
  const scores = categories
    .map((c) => ({
      id: c.id,
      score: c.terms.reduce(
        (n, t) => n + (matches(primary, t) ? 5 : matches(text, t) ? 1 : 0),
        0,
      ),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  const categoryIds = scores.slice(0, 3).map((c) => c.id);
  const shape: string[] = [];
  if (skillEvidence) shape.push("skill");
  if (
    /model context protocol|\bmcp\b/i.test(
      primary + " " + readme.slice(0, 5000),
    )
  )
    shape.push("mcp");
  if (
    /awesome-|tutorial|course|curriculum|教程|合集|collection of/i.test(primary)
  )
    shape.push("resource");
  if (/framework|library|sdk|toolkit|框架|库\b/i.test(primary))
    shape.push("framework");
  if (
    /model weights|pretrained model|模型权重|language model|text-to-speech model/i.test(
      primary,
    )
  )
    shape.push("model");
  if (!shape.length) shape.push("app");
  const aiRelated =
    aiPattern.test(primary) || aiPattern.test(readme.slice(0, 8000));
  const evidence: Classification["evidence"] = [];
  if (input.description)
    evidence.push({
      source: "description",
      text: input.description.slice(0, 350),
    });
  if (input.topics.length)
    evidence.push({
      source: "topics",
      text: input.topics.slice(0, 12).join(", "),
    });
  if (skillEvidence)
    evidence.push({
      source: "readme",
      text: "已核实仓库中的 SKILL.md 文件或明确的技能安装命令",
    });
  return {
    aiRelated,
    categories: categoryIds,
    forms: shape,
    tags: input.topics.slice(0, 6),
    summary: input.description,
    status: "rules",
    evidence,
    readmeHash: createHash("sha256").update(readme).digest("hex"),
    processedAt: at,
  };
}
export function applyOverride(p: Project, override?: Override): Project {
  if (!override) return p;
  const c = { ...p.classification };
  for (const key of [
    "aiRelated",
    "categories",
    "forms",
    "tags",
    "summary",
  ] as const) {
    if (override[key] !== undefined) (c as any)[key] = override[key];
  }
  c.status = "manual";
  c.evidence = [
    ...c.evidence.filter((e) => e.source !== "manual"),
    { source: "manual", text: override.reason || "维护者校订" },
  ];
  return { ...p, classification: c };
}
export function validateLabels(
  categoryIds: string[],
  formIds: string[],
  skillEvidence: boolean,
) {
  return (
    categoryIds.every((id) => categories.some((c) => c.id === id)) &&
    formIds.every((id) => forms.some((f) => f.id === id)) &&
    (!formIds.includes("skill") || skillEvidence)
  );
}
