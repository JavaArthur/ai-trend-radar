import { execFileSync } from "node:child_process";
import settings from "../../config/settings.json";
export function localToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}
export function retryDelay(
  status: number,
  headers: Headers,
  attempt: number,
  now = Date.now(),
): number | null {
  if (![403, 429, 500, 502, 503, 504].includes(status)) return null;
  const retry = headers.get("retry-after");
  if (retry)
    return Math.max(1000, Number(retry) * 1000 || Date.parse(retry) - now);
  if (headers.get("x-ratelimit-remaining") === "0")
    return Math.max(
      1000,
      Number(headers.get("x-ratelimit-reset")) * 1000 - now,
    );
  return 2000 * 2 ** attempt;
}
export class GitHub {
  count = 0;
  private lastSearch = 0;
  constructor(private token = localToken()) {}
  async get(path: string): Promise<any> {
    if (this.count >= settings.githubRequestBudget)
      throw new Error("本次 GitHub 请求预算已达上限");
    if (path.startsWith("/search/")) {
      const delay = 6500 - (Date.now() - this.lastSearch);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      this.lastSearch = Date.now();
    }
    for (let i = 0; i < 3; i++) {
      this.count++;
      const res = await fetch(`https://api.github.com${path}`, {
        headers: {
          Accept: "application/vnd.github+json",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        signal: AbortSignal.timeout(25000),
      });
      if (res.ok) return res.json();
      const delay = retryDelay(res.status, res.headers, i);
      if (delay !== null && delay <= 30000 && i < 2) {
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw Object.assign(new Error(`GitHub ${res.status}`), {
        status: res.status,
      });
    }
  }
}
