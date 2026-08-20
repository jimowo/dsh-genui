# dsh-genui 迭代路线图

依据 2026-02 会话评审定稿。发布方式：git tag 即发布（暂不上 npm）。

## v0.3 · 校验反馈 + 结构化事件信封（下一步）

**校验反馈**（可靠性投资，源自本会话 badges 静默空白 bug）：

- 渲染期收集「被丢弃字段」：`text()` 吞掉非字符串/数字值时记录字段路径
  （如 `badges.items[0].label`），未知 `type`、超深度/超宽度截断同样记录
- 降级/警告以卡片底部 note 形式呈现给用户
- 工具返回值增加 `warnings: string[]`，让模型在下一轮就能自我纠正，
  而不是以为渲染成功

**结构化事件信封**（为 v0.4 表单铺路）：

```
[ui_card 事件] {"cardId":"...","action":"drilldown","payload":{...}}
```

- 首行人类可读前缀 + JSON 行，agent 按固定格式解析
- 生成 `cardId`（调用序号或短随机 id）注入按钮事件
- 系统提示公告同步更新解析指引

## v0.4 · 表单组件

- `input{text,password,number}` / `select{options}` / `textarea` / `form{children,submitLabel,action}`
- 提交时把全部字段打包进 v0.3 的信封 payload，一次回传一轮额度
- 仅渲染端 + 描述文案改动，通道零新增

## v0.5 · 图表增强（自 v0.3 后移）

- `chart.kind: bar | line | pie | horizontal`，`color` 柱色覆写
- stat 内嵌 sparkline（`trend:[numbers]`）
- hover 提示（title 属性起步）

## v1.0 · 打磨与分发

- 键盘导航、aria 标签、色盲友好配色
- npm 公开发布、申请并入 web-ui-all 聚合包、CHANGELOG

## 候选池（未排期）

图表点击柱下钻 · 主题色全局覆写 · 表格虚拟滚动 · 代码块复制按钮

## 明确不做

- **卡片实时刷新**：渲染自 argsRaw 快照，天然静态；强行支持需新工具
  通道与状态同步，复杂度不匹配收益
- **后端依赖**：保持零构建、零第三方运行时依赖的发布形态
