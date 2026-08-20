# dsh-genui

DSH Web GUI 的聊天生成式 UI 插件:让模型用真正的界面卡片代替 markdown 展示结构化/可视化内容。

## 组成

- **Host 半**(`lib/index.js`):注册 agent 工具 `ui_card` 与一条 system-prompt 公告。模型传入 JSON 组件树 `spec`,工具返回确认。
- **Client 半**(`lib/client.js`):在 `tool.call.toolview` 槽位以 key `ui_card` 注册渲染器,从 `block.argsRaw`(运行中)/`block.call.argsRaw`(已结算)解析原始 JSON 字符串中的 spec,递归渲染为 React 组件。

## 支持的组件

`card` `row` / `stat-row` `stat`(带涨跌 delta) `table`(点击表头排序;`filter:true` 开启筛选框) `progress` `timeline` `chart`(柱状) `kv` `badges` `alert`(info/ok/warn/err) `code` `collapse`(折叠面板) `tabs`(选项卡) `buttons`(可交互) `text`,支持任意嵌套;深度上限 6 层、宽度分组件限量,解析/渲染失败降级为提示卡片,不会拖垮 GUI。

## 交互能力

- **本地交互**:`collapse` 折叠/展开、`tabs` 选项卡切换、表格点击表头排序(`filter:true` 时提供行筛选输入框)——不产生任何网络/agent 调用。
- **事件回传**:`buttons` 的 items 除字符串(本地高亮单选)外可传 `{label, action, confirm}`。用户点击后(默认需二次确认,`confirm:false` 立即发送)会通过会话作用域的 `ctx.conversation.send()` 把一条 `[ui_card 事件] …` 用户消息发回当前对话流,触发 agent 按上下文继续处理。每次回传消耗一轮 API 额度。
- 事件按钮状态机:待发 → 「确认发送？」(黄) → 已发送(绿);失败显示红色错误提示。

## 安装

```bash
dsh plugin --profile web add link:D:\dsh\plugin\GenUI
```

然后重启 DSH(`dsh web`)。任何会话中模型即可调用 `ui_card`;对模型说「用 ui_card / 界面卡片展示」即可。

## 卸载

```bash
dsh plugin --profile web remove dsh-genui
```

纯 JS、零构建、零第三方运行时依赖(仅 peer 依赖 react);配色用中性灰 + `--ds-color-accent` 主题变量,明暗主题自适应。
