import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { load } from "cheerio";
import path from "node:path";
import { redactReadme } from "./redact";
export type ReadmeLanguage = "en" | "zh";
export interface ReadmeFile {
  redactions?: number;
  language: ReadmeLanguage;
  path: string;
  markdown: string;
  sha: string;
  fetchedAt: string;
}
export interface ReadmeBundle {
  repository: string;
  branch: string;
  checkedAt: string;
  files: ReadmeFile[];
  error?: string;
}
export function readmeLanguage(filename: string): ReadmeLanguage | null {
  const name = path.posix.basename(filename);
  if (
    /^readme[._-](zh([._-](cn|hans|tw|hant))?|cn|chinese)\.(md|markdown)$/i.test(
      name,
    )
  )
    return "zh";
  if (/^readme([._-](en([._-]us)?|english))?\.(md|markdown)$/i.test(name))
    return "en";
  return null;
}
export function sourceUrl(bundle: ReadmeBundle, file: ReadmeFile) {
  return `https://github.com/${bundle.repository}/blob/${encodeURIComponent(bundle.branch)}/${file.path.split("/").map(encodeURIComponent).join("/")}`;
}
export function renderReadme(bundle: ReadmeBundle, file: ReadmeFile): string {
  const $ = load(
    marked.parse(redactReadme(file.markdown).markdown, { async: false }),
    {},
    false,
  );
  const prefix = `readme-${file.language}-`;
  const ids = new Map<string, number>();
  $("h1,h2,h3,h4,h5,h6").each((_, el) => {
    const heading = $(el);
    const slug = heading
      .text()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s/g, "-");
    const count = ids.get(slug) || 0;
    ids.set(slug, count + 1);
    heading.attr("id", prefix + slug + (count ? `-${count}` : ""));
    if (el.tagName === "h1") el.tagName = "h2";
  });
  $("[id]")
    .not("h1,h2,h3,h4,h5,h6")
    .each((_, el) => {
      const node = $(el);
      node.attr("id", prefix + node.attr("id"));
    });
  $("a[name]").each((_, el) => {
    $(el).attr("id", prefix + $(el).attr("name"));
  });
  function resolve(value: string, asset: boolean) {
    if (value.startsWith("#")) return "#" + prefix + value.slice(1);
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//"))
      return value;
    const root = asset
      ? `https://raw.githubusercontent.com/${bundle.repository}/${encodeURIComponent(bundle.branch)}/`
      : `https://github.com/${bundle.repository}/blob/${encodeURIComponent(bundle.branch)}/`;
    // A repository-root path is not a path on this Pages website.
    const relative = value.startsWith("/")
      ? value.slice(1)
      : path.posix.join(path.posix.dirname(file.path), value);
    return root + relative;
  }
  $("a[href]").each((_, el) => {
    const n = $(el);
    n.attr("href", resolve(n.attr("href")!, false));
    if (!n.attr("href")!.startsWith("#"))
      n.attr("target", "_blank").attr("rel", "noopener noreferrer");
  });
  $("img[src],video[src],source[src]").each((_, el) => {
    const n = $(el);
    n.attr("src", resolve(n.attr("src")!, true));
    if (el.tagName === "video") n.attr("preload", "none").attr("controls", "");
    if (el.tagName === "img")
      n.attr("loading", "lazy").attr("decoding", "async");
  });
  return sanitizeHtml($.html(), {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "details",
      "summary",
      "video",
      "source",
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["id"],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
      code: ["class"],
      video: ["src", "controls", "poster", "width", "preload"],
      source: ["src", "type"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
  });
}
