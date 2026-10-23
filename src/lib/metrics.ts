import settings from "../../config/settings.json";
import type { Metrics, Project, Snapshot } from "./types";
const DAY = 86400000;
export function mergeSnapshots(old: Snapshot[], point: Snapshot): Snapshot[] {
  const days = new Map(old.map((p) => [p.at.slice(0, 10), p]));
  days.set(point.at.slice(0, 10), point);
  return [...days.values()]
    .filter(
      (p) =>
        Date.parse(point.at) - Date.parse(p.at) < settings.historyDays * DAY,
    )
    .sort((a, b) => a.at.localeCompare(b.at));
}
export function metrics(p: Project, now = Date.now()): Metrics {
  const active =
    !p.archived &&
    !p.unavailable &&
    now - Date.parse(p.pushedAt) <= settings.activeWithinDays * DAY;
  const result: Metrics = {
    delta: null,
    rate: null,
    from: null,
    to: null,
    complete: false,
    positiveDays: 0,
    hot: false,
    rising: false,
    active,
  };
  const pts = [...p.snapshots].sort((a, b) => a.at.localeCompare(b.at));
  const last = pts.at(-1);
  if (!last || now - Date.parse(last.at) > 48 * 3600000) return result;
  const target = Date.parse(last.at) - 7 * DAY;
  // Use an actual observation around 7 days ago; never interpolate missing stars.
  const first = pts
    .filter((s) => Math.abs(Date.parse(s.at) - target) <= 12 * 3600000)
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a.at) - target) -
        Math.abs(Date.parse(b.at) - target),
    )[0];
  if (!first) return result;
  result.delta = last.stars - first.stars;
  result.rate = first.stars > 0 ? result.delta / first.stars : null;
  result.from = first.at;
  result.to = last.at;
  const window = pts.filter((s) => s.at >= first.at && s.at <= last.at);
  result.complete =
    window.length === 8 &&
    window.every(
      (s, i) =>
        i === 0 ||
        Date.parse(s.at.slice(0, 10)) -
          Date.parse(window[i - 1].at.slice(0, 10)) ===
          DAY,
    );
  result.positiveDays = window
    .slice(1)
    .filter((s, i) => s.stars > window[i].stars).length;
  result.hot =
    active &&
    p.classification.aiRelated &&
    (result.delta >= settings.hotAbsolute ||
      (result.delta >= settings.hotMinimum &&
        (result.rate ?? 0) >= settings.hotRate));
  result.rising =
    result.hot &&
    result.complete &&
    result.positiveDays >= settings.positiveDays;
  return result;
}
export function slugFor(fullName: string, id: number) {
  return `${fullName.toLowerCase().replace(/[^a-z0-9-]/g, "-")}-${id}`;
}
export function mergeProject(
  old: Project | undefined,
  current: Project,
): Project {
  if (!old) return current;
  return {
    ...current,
    firstSeenAt: old.firstSeenAt,
    sources: [...new Set([...old.sources, ...current.sources])],
    snapshots: mergeSnapshots(old.snapshots, current.snapshots[0]),
  };
}
