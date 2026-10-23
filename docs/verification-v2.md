# 第二版验收（2026-10-24，北京时间）

## 内容与数据

- 目录收敛为 42 个 Skills、89 个应用工具；底层保留 217 个已跟踪仓库，旧详情地址继续可访问。
- 131 个可见项目均有实际 README 缓存，其中 57 个同时提供中英文。首次采集后纠正了组件 README 误识别为主文档的问题，再次从 GitHub 抓取核验。
- REA：英文 `README.md`，中文 `docs/readme/README_zh.md`。
- video-shotcraft：英文 `README.md`，中文 `README_CN.md`。
- Remotion 使用官方 `remotion-dev/skills`，实际技能文件已核实；详情保留 Remotion 主仓库链接。hyperframes 与 video-shotcraft 同列视频 Skills。
- 修正写作 Skill、主用途为应用但提及 MCP 的工具、纯模型与资料合集的形态和分类。推荐展示不冒充热榜排名。

## 自动验证

26 项行为测试通过；新增覆盖语言文件变体、子目录翻译、组件文档排除、中文默认文件与显式英文并存、危险 HTML 与 URL 清理、相对图片/文档链接、抓取失败保留缓存和目录分组。原有真实增长、缺测、负增长、限流和免费接口回退测试继续通过。

Astro 类型检查无错误或警告；数据校验通过；静态构建 211 页；本地页面与资源链接检查通过，无凭据模式匹配。日常采集每轮最多更新 35 个 README，GitHub Actions 会提交整个 data 目录。

## 浏览器验证

在实际浏览器中验证两级分类、关键词搜索、REA 中英文原文切换、独立收藏按钮、收藏筛选与刷新后持久化。测试中增加的收藏已恢复。卡片正文点击已实际跳转至 video-shotcraft，英文 / 中文切换分别对应 README.md / README_CN.md；390px 手机视口下首页和详情均无页面横向溢出，README 区宽 354px。界面截图接口（Page.captureScreenshot）持续超时，未把 DOM 验收当作已完成截图目视验收。

设计取舍与技能来源见 [design-v2.md](design-v2.md)。

首次推送被 GitHub Push Protection 拦截：一个上游公开 README 包含 Webhook 样式。没有绕过保护；已在缓存与渲染入口加入凭据样式隐藏，修正未发布提交并补充回归测试。页面对隐藏内容显示说明。
