# AI 热榜雷达

[访问网站](https://javaarthur.github.io/ai-trend-radar/) · [自动更新状态](https://github.com/JavaArthur/ai-trend-radar/actions/workflows/update-and-deploy.yml)

一个中文 AI 开源项目目录：按 Skills 和开源应用工具筛选，追踪 GitHub 官方周榜与本站实测增长。Astro + TypeScript + GitHub Actions + GitHub Pages，无数据库、无服务器费用。

## 功能

- 两个入口：Skills / 开源应用工具。细分视频、图片与设计、编程、公众号与写作、办公、语音、知识库与智能助手；模型、纯框架与资源合集暂不在目录展示。
- 整块卡片可点击，收藏独立操作；首页展示 Remotion 官方 Skills、video-shotcraft 和 hyperframes。
- 详情阅读真实中英文 README，支持语言切换、图片、代码、表格和原文链接。
- 官方周榜 AI 精选、近 7 天净增、持续上升、最近发现、全部收录。
- 中文搜索、项目详情、真实快照走势图、浏览器本地收藏。
- 每天北京时间 08:23 自动发现和更新，失败保留旧数据，支持手动执行。
- 可选免费模型生成中文摘要；没有密钥也能采集、规则分类和发布。

## 本地启动

使用 Node.js 24，执行：

```sh
npm ci
npm run dev
```

打开终端显示的地址下的 `/ai-trend-radar/`。本地采集需要 `GITHUB_TOKEN` 环境变量，或已登录的 `gh` CLI（`gh auth login`）。不输出或保存 token。

```sh
npm run collect
npm run sync:readmes # 首次补齐可见项目 README；-- --force 可强制刷新
npm run validate
npm test
npm run check
npm run build
npm run preview
```

`.env.example` 是变量说明，采集脚本读取进程环境，不自动加载 `.env`。设置真实密钥时使用系统环境或密钥管理器，不写入源码。

## GitHub Pages 部署

1. Fork 或复制此仓库，修改 `astro.config.mjs` 中 `site` 和 `base`。
2. 仓库 Settings → Pages → Source 选择 **GitHub Actions**。
3. 默认分支为 `main`。推送代码将验证并部署现有数据；Actions 中手动运行 **Update radar and deploy Pages** 可立即重新采集。
4. 日程使用 `23 0 * * *`（UTC），即北京时间 08:23。采集、快照提交、构建和部署在同一工作流中完成。

标准公开仓库 runner 免费；不使用付费 runner。部署只保留 1 天 Pages artifact。`GITHUB_TOKEN` 由 Actions 自动提供，无需另配 GitHub PAT。

## 免费中文摘要

默认付费预算为 **0**。详情见 [免费模型配置](docs/free-models.md)。没有任何模型密钥时，规则分类照常执行，简介保留原文并显示“中文摘要待补充”。手工校订的中文摘要不会被 AI 覆盖。

配置项位于 `config/settings.json`：每日 AI 项目上限 30、各 provider 调用上限、热榜门槛、最大跟踪量。只有明确允许的免费路由和确认处于免费计划的备用接口会被调用，模型调用失败不会影响采集。

## 数据和维护

- `data/catalog.json`：真实仓库元数据、分类依据、来源时间与近 90 天日快照。
- `data/readmes/<仓库 ID>.json`：作者原始 README、语言、文件路径、SHA 与抓取时间。
- `data/ai-usage.json`：当天 AI 处理计数，不含密钥。
- `config/overrides.json`：人工纠正，优先使用仓库 ID 作为键（改名后仍有效）。
- [数据口径与维护](docs/operations.md)：热度定义、失败恢复、分类规则、免费额度限制。
- [首批质量核验](docs/initial-review.md)：人工检查和中文摘要的范围。

人工修正示例：

```json
{
  "123456": {
    "summary": "基于仓库资料的中文介绍。",
    "categories": ["video"],
    "forms": ["app"],
    "tags": ["视频生成"],
    "reason": "依据仓库简介校订"
  }
}
```

可以设置 `exclude: true` 排除仓库，或 `aiRelated: false` 保留跟踪但不在 AI 目录展示。Skill 标签必须存在实际技能文件引用或安装说明；校验器会阻止缺乏依据的 Skill 标签。

## 限制

本站不是 GitHub 全量榜单。第一周只有官方周榜可用，实测净增榜要积累约 7 天。总 Star、最近推送和公开 README 无法保证项目质量或未来增长。免费模型配额与可用性可能变化；不依赖一次性试用金或付费后备路由。

代码 MIT；收录项目各自保留原许可证。收藏只存在当前浏览器。

## README 同步与界面维护

日常采集完成元数据和快照后，每轮最多刷新 35 个 README 缓存，优先刷新最久未抓取的项目；仓库有推送或缓存超过 7 天时进入队列。原文抓取无需模型密钥。抓取失败保留上次成功内容，并在详情页标注。初次部署可执行 `npm run sync:readmes` 补齐全部可见项目。

支持根目录的 README.md、README_EN.md、README_zh.md、README.zh-CN.md、README_CN.md 等，并跟随主 README 里的相对翻译文件链接。不会把 demos、packages 下的普通 README 误当主项目英文翻译。没有对应语言时按钮不可用，不伪造翻译。自动识别中文默认 README；混合语言或非标准文档目录可能需要后续扩展。

抓取时隐藏可识别的 Webhook 与密钥样式，避免转存上游文档里意外泄露的凭据，详情会显示隐藏说明。Markdown 在构建时解析并过滤脚本、事件属性与危险 URL；相对图片指向原仓库，文档链接指向 GitHub。浏览器只接收静态 HTML，不携带 GitHub 或模型密钥。原始文档保留原作者许可证。

视觉采用 [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) 技能指导，设计取舍见 [第二版设计](docs/design-v2.md)。
