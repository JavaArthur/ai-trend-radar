const key = "ai-trend-radar:favorites:v1";
let saved = new Set<string>();
try {
  const value = JSON.parse(localStorage.getItem(key) || "[]");
  if (Array.isArray(value)) saved = new Set(value.map(String));
} catch {
  /* private mode */
}
function updateFavorites() {
  document
    .querySelectorAll<HTMLButtonElement>("[data-save]")
    .forEach((button) => {
      const active = saved.has(button.dataset.save!);
      button.setAttribute("aria-pressed", String(active));
      button.textContent = active ? "★" : "☆";
      button.title = active ? "取消收藏" : "收藏项目";
    });
  const count = document.querySelector("#favorite-count");
  if (count) count.textContent = String(saved.size);
}
document.querySelectorAll<HTMLButtonElement>("[data-save]").forEach((button) =>
  button.addEventListener("click", () => {
    const id = button.dataset.save!;
    saved.has(id) ? saved.delete(id) : saved.add(id);
    try {
      localStorage.setItem(key, JSON.stringify([...saved]));
    } catch {}
    updateFavorites();
    renderDirectory?.();
  }),
);
updateFavorites();
let renderDirectory: (() => void) | undefined;
const grid = document.querySelector<HTMLElement>("#project-grid");
if (grid) {
  const cards = [...grid.querySelectorAll<HTMLElement>(".project-card")];
  const params = new URLSearchParams(location.search);
  const search = document.querySelector<HTMLInputElement>("#search")!;
  const select = document.querySelector<HTMLSelectElement>("#view")!;
  const state = {
    family: params.get("family") === "tools" ? "tools" : "skills",
    category: params.get("category") || "all",
    view: params.get("view") || "all",
    query: params.get("q") || "",
    favorites: params.get("saved") === "1",
  };
  if (
    !document.querySelector(`[data-category="${CSS.escape(state.category)}"]`)
  )
    state.category = "all";
  if (![...select.options].some((o) => o.value === state.view))
    state.view = "all";
  search.value = state.query;
  select.value = state.view;
  const notes: Record<string, string> = {
    all: "周榜项目优先，其余按总 Star 排列。观察中表示本站尚未积累足够的 7 天数据。",
    weekly:
      "来源：GitHub Trending 周榜，保留官方顺序，仅展示当前目录收录的 AI 项目。",
    growth: "仅本站已跟踪项目：按两次真实观测的 7 天净增排列，并通过热榜门槛。",
    rising: "连续 7 个日间隔中至少 5 天增长，且满足热榜门槛；不代表未来走势。",
    new: "按本站首次发现时间排列。这是新候选，不代表已经验证热门。",
    stars: "按累计 Star 排列。长期累计不等于近期热度。",
  };
  function render() {
    const tokens = state.query
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const sorted = [...cards].sort((a, b) =>
      state.view === "new"
        ? b.dataset.new!.localeCompare(a.dataset.new!)
        : state.view === "growth" || state.view === "rising"
          ? Number(b.dataset.delta) - Number(a.dataset.delta)
          : state.view === "stars"
            ? Number(b.dataset.stars) - Number(a.dataset.stars)
            : (Number(a.dataset.weekly) || 999) -
                (Number(b.dataset.weekly) || 999) ||
              Number(b.dataset.stars) - Number(a.dataset.stars),
    );
    let count = 0;
    for (const card of sorted) {
      const d = card.dataset;
      const visible =
        d.family === state.family &&
        (state.category === "all" ||
          d.categories!.split(" ").includes(state.category)) &&
        (!state.favorites || saved.has(d.id!)) &&
        tokens.every((t) => d.search!.includes(t)) &&
        (state.view !== "weekly" || Number(d.weekly) > 0) &&
        (state.view !== "growth" || d.hot === "true") &&
        (state.view !== "rising" || d.rising === "true");
      card.hidden = !visible;
      if (visible) count++;
      grid!.append(card);
    }
    document.querySelector("#result-count")!.textContent = String(count);
    document.querySelector("#family-label")!.textContent =
      state.family === "skills" ? " Skills" : "个应用工具".replace("个", "");
    document.querySelector("#filter-caption")!.textContent = state.favorites
      ? "只看已收藏"
      : select.selectedOptions[0].text;
    document.querySelector("#view-note")!.textContent = notes[state.view];
    document.querySelector<HTMLElement>("#empty-state")!.hidden = count > 0;
    document.querySelector("#empty-note")!.textContent = [
      "growth",
      "rising",
    ].includes(state.view)
      ? "这个分类暂未积累足够的真实增长证据，可以先查看全部项目或官方周榜。"
      : "换个关键词，或看看另一类工具。";
    document
      .querySelectorAll<HTMLButtonElement>("[data-family]")
      .forEach((b) => {
        if (!b.classList.contains("family-tab")) return;
        const active = b.dataset.family === state.family;
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", String(active));
      });
    document
      .querySelectorAll<HTMLButtonElement>("[data-category]")
      .forEach((b) => {
        const active = b.dataset.category === state.category;
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", String(active));
      });
    document
      .querySelector("#favorites")!
      .setAttribute("aria-pressed", String(state.favorites));
    const url = new URL(location.href);
    url.search = "";
    if (state.family !== "skills") url.searchParams.set("family", state.family);
    if (state.category !== "all")
      url.searchParams.set("category", state.category);
    if (state.view !== "all") url.searchParams.set("view", state.view);
    if (state.query) url.searchParams.set("q", state.query);
    if (state.favorites) url.searchParams.set("saved", "1");
    history.replaceState(null, "", url);
  }
  renderDirectory = render;
  document.querySelectorAll<HTMLButtonElement>(".family-tab").forEach((b) =>
    b.addEventListener("click", () => {
      state.family = b.dataset.family!;
      render();
    }),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((b) =>
    b.addEventListener("click", () => {
      state.category = b.dataset.category!;
      render();
    }),
  );
  search.addEventListener("input", () => {
    state.query = search.value;
    render();
  });
  select.addEventListener("change", () => {
    state.view = select.value;
    render();
  });
  document.querySelector("#favorites")!.addEventListener("click", () => {
    state.favorites = !state.favorites;
    render();
  });
  document.querySelector("#reset-filters")!.addEventListener("click", () => {
    state.category = "all";
    state.query = "";
    state.view = "all";
    state.favorites = false;
    search.value = "";
    select.value = "all";
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "/" &&
      !/input|textarea|select/i.test((e.target as HTMLElement).tagName)
    ) {
      e.preventDefault();
      search.focus();
    }
  });
  const meta = (window as any).__radar;
  const warnings = [];
  if (
    !meta?.lastUpdated ||
    Date.now() - Date.parse(meta.lastUpdated) > 48 * 3600000
  )
    warnings.push("数据已超过 48 小时未更新，正在展示最近一次成功采集的记录。");
  if (
    meta?.weeklyError ||
    !meta?.weeklyAt ||
    Date.now() - Date.parse(meta.weeklyAt) > 48 * 3600000
  )
    warnings.push("官方周榜暂未更新，保留上次结果。");
  if (warnings.length) {
    const box = document.querySelector<HTMLElement>("#data-warning")!;
    box.textContent = warnings.join(" ");
    box.hidden = false;
  }
  render();
}
const tabs = [
  ...document.querySelectorAll<HTMLButtonElement>("[data-readme-tab]"),
];
if (tabs.length) {
  function switchReadme(language: string) {
    if (!tabs.some((t) => t.dataset.readmeTab === language && !t.disabled))
      return;
    for (const tab of tabs) {
      const active = tab.dataset.readmeTab === language;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    document
      .querySelectorAll<HTMLElement>("[data-readme-panel]")
      .forEach((p) => (p.hidden = p.dataset.readmePanel !== language));
    try {
      localStorage.setItem("ai-trend-radar:readme-language", language);
    } catch {}
    const url = new URL(location.href);
    url.searchParams.set("readme", language);
    history.replaceState(null, "", url);
  }
  let preferred = new URLSearchParams(location.search).get("readme");
  try {
    preferred ||= localStorage.getItem("ai-trend-radar:readme-language");
  } catch {}
  if (preferred) switchReadme(preferred);
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchReadme(tab.dataset.readmeTab!));
    tab.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const enabled = tabs.filter((t) => !t.disabled);
      let next =
        enabled[
          (enabled.indexOf(tab) +
            (e.key === "ArrowLeft" ? -1 : 1) +
            enabled.length) %
            enabled.length
        ];
      if (e.key === "Home") next = enabled[0];
      if (e.key === "End") next = enabled.at(-1)!;
      switchReadme(next.dataset.readmeTab!);
      next.focus();
    });
  });
}
