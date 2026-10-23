# 免费模型配置

网站已具备完整的无密钥运行路径。要自动补中文摘要，需要维护者创建免费账户，将密钥直接填入 GitHub **Settings → Secrets and variables → Actions → New repository secret**。不要把密钥发到 Issue 或提交到仓库。

## 默认：OpenRouter

- Secret 名称：`OPENROUTER_API_KEY`
- 接口：`https://openrouter.ai/api/v1`
- 模型：`openrouter/free`
- 不需要为本站主动充值。该路由只选择当时可用的免费模型；配额用尽就暂缓。
- 支持切换到明确的 `:free` 模型；非免费模型 ID 被代码拒绝。
- 不使用有可能选择付费模型的 `openrouter/auto`。

[官方免费路由](https://openrouter.ai/docs/guides/routing/routers/free-router) · [额度和限流](https://openrouter.ai/docs/api_reference/limits)

## 可选备用：Groq

- Secret 名称：`GROQ_API_KEY`
- 必须使用 **Free** 计划账户；不要启用付费 Developer 计划。
- 只有确认账户为 Free 后，添加 Repository variable：`GROQ_FREE_TIER_CONFIRMED=true`。
- 接口：`https://api.groq.com/openai/v1`
- 默认模型：`llama-3.3-70b-versatile`，模型下线时修改配置为控制台当前免费计划支持的模型。

Groq 的同一接口在付费账户上可能计费，因此“确认免费计划”是启用条件。账户若改为付费，先删除确认变量。项目不能代替供应商判断账户账单状态。

[免费计划限额](https://console.groq.com/docs/rate-limits) · [账户计费说明](https://console.groq.com/docs/billing-faqs)

## 节流与失败行为

每天最多处理 30 个项目。每个 provider 单独记录尝试次数；429、401、402、403 后本轮熔断该 provider，使用已配置的免费备用。没有可用服务则保留规则结果，下次继续。每日计数采用 UTC 日期，重置发生在北京时间 08:00。

只处理新增、README 内容变化或尚未补齐的项目，结果按 README 哈希缓存。优先处理官方热点和高关注项目。响应必须是合格 JSON、含中文摘要且标签在预定义词表内；错误结果不发布。

外部文本只作为资料，不执行 README 中的指令。只向模型发送公开仓库简介、Topics 和截断的 README。不会发送用户收藏或密钥。

服务免费政策可能变化。当前默认仅依赖公开提供的免费路由，不开通付费自动回退；不使用赠金到期后可能转为计费的方案。无需一次注册很多平台，先配置一个 OpenRouter key 即可。
