import { load } from "cheerio";
import type { TrendEntry, TrendSource } from "./types";
export function parseTrending(html: string): TrendEntry[] {
  const $ = load(html);
  const entries: TrendEntry[] = [];
  $("article.Box-row").each((_i, node) => {
    const href = $(node).find("h2 a").attr("href")?.trim();
    if (!href || !/^\/[\w.-]+\/[\w.-]+$/.test(href)) return;
    const text = $(node).text();
    const stars = text.match(/([\d,]+)\s+stars?\s+(?:today|this week)/i);
    entries.push({
      fullName: href.slice(1),
      rank: entries.length + 1,
      starsInPeriod: stars ? Number(stars[1].replace(/,/g, "")) : null,
    });
  });
  if (!entries.length)
    throw new Error("Trending 页面未解析到仓库，保留上次数据");
  return entries;
}
export function retainTrend(
  previous: TrendSource,
  entries: TrendEntry[] | null,
  at: string,
  error?: string,
): TrendSource {
  return entries?.length
    ? { fetchedAt: at, entries }
    : { ...previous, error: error || "采集失败" };
}
