export const number = (n: number) => new Intl.NumberFormat("en-US").format(n);
export const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
export const date = (s: string | null | undefined) =>
  s
    ? new Date(s).toLocaleDateString("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";
export const datetime = (s: string | null | undefined) =>
  s
    ? new Date(s).toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        hour12: false,
      })
    : "尚未采集";
export function sparkline(points: { stars: number }[]) {
  if (points.length < 2) return "";
  const low = Math.min(...points.map((p) => p.stars));
  const high = Math.max(...points.map((p) => p.stars));
  return points
    .map(
      (p, i) =>
        `${(i / (points.length - 1)) * 240},${52 - ((p.stars - low) / (high - low || 1)) * 42}`,
    )
    .join(" ");
}
