declare global {
  interface Window {
    __radar: {
      lastUpdated: string | null;
      weeklyAt: string | null;
      weeklyError?: string;
      observed: number;
    };
  }
}
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const cards = [...document.querySelectorAll<HTMLElement>(".project-card")];
const key = "ai-trend-radar:favorites:v1";
let saved = new Set<string>();
try {
  const data = JSON.parse(localStorage.getItem(key) || "[]");
  if (Array.isArray(data)) saved = new Set(data.map(String));
} catch {}
let render = () => {};
const state = {
  category: "all",
  form: "all",
  view: "weekly",
  query: "",
  favorites: false,
};
function saveUI() {
  document.querySelectorAll<HTMLButtonElement>("[data-save]").forEach((b) => {
    const yes = saved.has(b.dataset.save!);
    b.textContent = yes ? "★" : "☆";
    b.classList.toggle("saved", yes);
    b.setAttribute("aria-pressed", String(yes));
    b.setAttribute(
      "aria-label",
      `${yes ? "取消收藏" : "收藏"} ${b.closest("[data-name]")?.getAttribute("data-name") || "此项目"}`,
    );
  });
  const count = document.querySelector("#favorite-count");
  if (count) count.textContent = String(saved.size);
}
document.querySelectorAll<HTMLButtonElement>("[data-save]").forEach((b) =>
  b.addEventListener("click", () => {
    const id = b.dataset.save!;
    saved.has(id) ? saved.delete(id) : saved.add(id);
    try {
      localStorage.setItem(key, JSON.stringify([...saved]));
    } catch {}
    saveUI();
    if (cards.length) render();
  }),
);
saveUI();
if (cards.length || document.querySelector("#cards")) {
  const params = new URLSearchParams(location.search);
  state.query = params.get("q") || "";
  state.category = params.get("category") || "all";
  state.form = params.get("form") || "all";
  if (
    ["weekly", "growth", "rising", "new", "all"].includes(
      params.get("view") || "",
    )
  )
    state.view = params.get("view")!;
  $("#search").setAttribute("value", state.query);
  const notes: Record<string, string> = {
    weekly:
      "来自 GitHub 官方周榜的 AI 项目，保留官方排名；官方本周增长与本站净增独立展示。",
    growth:
      "仅统计本站已跟踪、满足近期活跃与热度门槛的 AI 项目。使用真实观测点计算近 7 天净增。",
    rising:
      "完整连续观测 7 天，至少 5 天 Star 净增为正，并满足热榜门槛。趋势证据不代表未来保证。",
    new: "按本站首次发现时间排序。新发现不等于新创建，也不等于已验证热门。",
    all: "所有已确认与 AI 相关的收录项目。热度回落后仍可查阅，按总 Star 排序。",
  };
  render = () => {
    const words = state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    const order = [...cards].sort((a, b) =>
      state.view === "weekly"
        ? Number(a.dataset.weekly) - Number(b.dataset.weekly)
        : state.view === "new"
          ? (b.dataset.new || "").localeCompare(a.dataset.new || "")
          : state.view === "growth" || state.view === "rising"
            ? Number(b.dataset.delta) - Number(a.dataset.delta)
            : Number(b.dataset.stars) - Number(a.dataset.stars),
    );
    for (const card of order) {
      const d = card.dataset;
      const fits =
        (state.category === "all" ||
          d.categories?.split(",").includes(state.category)) &&
        (state.form === "all" || d.forms?.split(",").includes(state.form)) &&
        words.every((w) => d.search?.includes(w)) &&
        (!state.favorites || saved.has(d.id!)) &&
        (state.view === "weekly"
          ? Number(d.weekly) > 0
          : state.view === "growth"
            ? d.hot === "true"
            : state.view === "rising"
              ? d.rising === "true"
              : true);
      card.hidden = !fits;
      if (fits) shown++;
      const growth = card.querySelector("[data-growth]");
      if (growth)
        growth.textContent =
          state.view === "weekly" && d.weeklyStars !== ""
            ? `↗ ${Number(d.weeklyStars).toLocaleString("en-US")} / 官方本周`
            : d.delta !== ""
              ? `${Number(d.delta) >= 0 ? "+" : ""}${Number(d.delta).toLocaleString("en-US")} / 7天`
              : "◌ 趋势观察中";
      $("#cards").append(card);
    }
    $("#result-count").textContent = `${shown} 个项目`;
    $("#empty").hidden = shown > 0;
    const cold =
      (state.view === "growth" || state.view === "rising") &&
      !window.__radar.observed;
    $("#empty-title").textContent = cold
      ? "增长需要时间，观察已经开始"
      : state.favorites
        ? "这里等待你的第一颗星"
        : "暂时没有匹配的项目";
    $("#empty-description").textContent = cold
      ? "本站正在积累真实快照。满 7 天后，符合条件的项目会出现在这里；现在可以先看官方周榜。"
      : state.favorites
        ? "点击项目卡片上的 ☆ 收藏，记录保存在当前浏览器。"
        : "试试其他关键词、用途或项目形态。";
    $("#note-text").textContent =
      notes[state.view] +
      (state.view === "weekly"
        ? ` 最近抓取：${window.__radar.weeklyAt ? new Date(window.__radar.weeklyAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) : "暂无"}。${window.__radar.weeklyError ? "本轮采集失败，展示上次结果。" : ""}`
        : "");
    if (
      state.view === "weekly" &&
      window.__radar.weeklyAt &&
      Date.now() - Date.parse(window.__radar.weeklyAt) > 48 * 3600000
    )
      $("#note-text").textContent += " 周榜数据已过期。";
    for (const [attr, value] of [
      ["category", state.category],
      ["form", state.form],
      ["view", state.view],
    ])
      document
        .querySelectorAll<HTMLButtonElement>(`button[data-${attr}]`)
        .forEach((b) => {
          const yes = b.dataset[attr] === value;
          b.classList.toggle("active", yes);
          b.setAttribute("aria-pressed", String(yes));
        });
    $("#favorites").setAttribute("aria-pressed", String(state.favorites));
    $("#favorites").classList.toggle("active", state.favorites);
    const p = new URLSearchParams();
    if (state.query) p.set("q", state.query);
    if (state.category !== "all") p.set("category", state.category);
    if (state.form !== "all") p.set("form", state.form);
    if (state.view !== "weekly") p.set("view", state.view);
    history.replaceState(
      null,
      "",
      location.pathname + (p.size ? "?" + p : "") + location.hash,
    );
  };
  document.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((b) =>
    b.addEventListener("click", () => {
      state.category = b.dataset.category!;
      state.view = "all";
      render();
    }),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-form]").forEach((b) =>
    b.addEventListener("click", () => {
      state.form = b.dataset.form!;
      render();
    }),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) =>
    b.addEventListener("click", () => {
      state.view = b.dataset.view!;
      render();
    }),
  );
  $("#search").addEventListener("input", (e) => {
    state.query = (e.target as HTMLInputElement).value;
    if (state.query) state.view = "all";
    render();
  });
  $("#favorites").addEventListener("click", () => {
    state.favorites = !state.favorites;
    state.view = "all";
    state.category = "all";
    state.form = "all";
    render();
  });
  $("#reset").addEventListener("click", () => {
    Object.assign(state, {
      category: "all",
      form: "all",
      view: "weekly",
      query: "",
      favorites: false,
    });
    $<HTMLInputElement>("#search").value = "";
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "/" &&
      !(e.target instanceof HTMLInputElement) &&
      !(e.target instanceof HTMLTextAreaElement)
    ) {
      e.preventDefault();
      $("#search").focus();
    }
  });
  if (
    window.__radar.lastUpdated &&
    Date.now() - Date.parse(window.__radar.lastUpdated) > 48 * 3600000
  )
    $("#stale-warning").hidden = false;
  render();
}
export {};
