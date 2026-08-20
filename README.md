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

## 最佳实践:一张「运营监控中心」卡片

这是覆盖全部能力的参考示例,对模型说「用 ui_card 做一张运营监控中心卡片」即可复现。设计要点:

1. **信息分层**:顶层 `stat-row` 放 4 个北极星指标(带 delta 涨跌)→ `alert` 全局状态灯 → `tabs` 把「流量 / 异常 / 发布」三个视图分区,避免单屏过载。
2. **按数据形态选组件**:趋势用 `chart`,汇总用 `kv`,事件流用 `timeline`,告警用 `alert`,元信息用 `badges`,变更内容用 `code`,长尾细节收进 `collapse`。
3. **可探索性**:异常明细表开启 `filter:true` + 点击表头排序,用户自己下钻,不消耗额度。
4. **行动闭环**:底部 `buttons` 放 `{label, action}` 事件按钮——「下钻事故」「拉值班」「生成周报」,确认后把 action 回传对话流,agent 接续处理,形成 展示→洞察→行动 闭环。

```json
{
  "type": "card",
  "title": "运营监控中心",
  "children": [
    { "type": "stat-row", "children": [
      { "type": "stat", "label": "活跃用户", "value": "12,847", "delta": 6.2 },
      { "type": "stat", "label": "今日订单", "value": "3,204", "delta": 12.8 },
      { "type": "stat", "label": "错误率", "value": "0.42%", "delta": -0.15 },
      { "type": "stat", "label": "P99 延迟", "value": "238ms", "delta": 4.1 }
    ]},
    { "type": "alert", "tone": "ok", "text": "系统运行正常 · 所有核心指标在阈值内" },
    { "type": "tabs", "items": [
      { "label": "流量概览", "children": [
        { "type": "chart", "items": [
          { "label": "一", "value": 820 }, { "label": "二", "value": 936 },
          { "label": "三", "value": 1024 }, { "label": "四", "value": 978 },
          { "label": "五", "value": 1150 }, { "label": "六", "value": 1420 },
          { "label": "日", "value": 1310 }
        ]},
        { "type": "kv", "items": [
          { "key": "峰值时段", "value": "周六 20:00-22:00" },
          { "key": "周环比", "value": "+11.4%" }
        ]}
      ]},
      { "label": "异常明细", "children": [
        { "type": "table", "filter": true,
          "columns": ["时间", "服务", "级别", "详情", "耗时(ms)"],
          "rows": [
            ["09:42", "order-api", "ERROR", "库存扣减超时", 3200],
            ["10:03", "payment", "ERROR", "网关连接拒绝", 5000],
            ["10:12", "search", "WARN", "慢查询 >1s", 1450]
          ]}
      ]},
      { "label": "发布记录", "children": [
        { "type": "timeline", "items": [
          { "title": "v2.4.0 已上线", "desc": "P99 从 262ms 降至 238ms" },
          { "title": "v2.4.1 提测中", "desc": "修复库存超时问题" }
        ]},
        { "type": "collapse", "title": "变更单详情", "children": [
          { "type": "badges", "items": ["CR-1024 已审核", "2 文件", "+86/-12"] },
          { "type": "code", "text": "fix(inventory): 扣减增加 3s 超时与幂等键…" }
        ]}
      ]}
    ]},
    { "type": "buttons", "items": [
      { "label": "下钻 09:42 超时事故", "action": "drilldown order-api 09:42 库存超时" },
      { "label": "拉支付值班", "action": "page-oncall payment", "confirm": true },
      { "label": "生成周报", "action": "generate weekly-ops-report", "confirm": false }
    ]}
  ]
}
```

### 设计准则速查

| 场景 | 推荐组合 |
|---|---|
| 周报 / 汇报 | stat-row 指标 + chart 趋势 + timeline 里程碑 + ok 告警 |
| 排障 / 监控 | alert 状态灯 + filter 表格 + 事件按钮下钻 |
| 文档 / 变更单 | kv 元数据 + collapse 折叠详情 + code + badges |
| 对比 / 选型 | tabs 分方案 + table 排序筛选 + buttons 让用户拍板 |
| 超长内容 | tabs 或 collapse 分区,永远不要一张平铺大卡 |
