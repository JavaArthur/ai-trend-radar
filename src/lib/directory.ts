import type { Project } from "./types";
export const sections = [
  { id: "video", name: "视频", icon: "▷" },
  { id: "image", name: "图片与设计", icon: "◈" },
  { id: "coding", name: "编程", icon: "⌘" },
  { id: "content", name: "公众号与写作", icon: "✎" },
  { id: "office", name: "办公与自动化", icon: "▤" },
  { id: "audio", name: "语音与音乐", icon: "♫" },
  { id: "knowledge", name: "搜索与知识库", icon: "⌕" },
  { id: "agents", name: "智能助手", icon: "◇" },
];
export function family(p: Project): "skills" | "tools" | null {
  if (!p.classification.aiRelated) return null;
  if (p.skillEvidence && p.classification.forms.includes("skill"))
    return "skills";
  if (p.classification.forms.includes("app")) return "tools";
  return null;
}
export const featuredNames = [
  "remotion-dev/skills",
  "Vincentwei1021/video-shotcraft",
  "heygen-com/hyperframes",
];
export function directoryCategories(p: Project) {
  const found = p.classification.categories.filter((id) =>
    sections.some((s) => s.id === id),
  );
  return found.length ? found : ["agents"];
}
