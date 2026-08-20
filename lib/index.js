/**
 * dsh-genui — host half.
 *
 * Registers the `ui_card` agent tool: the model passes a JSON component
 * tree (spec) and gets a confirmation; the browser half (./client) renders
 * that spec as real React components inside the conversation through the
 * keyed `tool.call.toolview` slot (key "ui_card"). Also installs a short
 * system-prompt section so every agent knows the capability exists.
 *
 * Plain JavaScript on purpose: no build step, loads straight from lib/.
 */

import { defineTool } from '@deepseek-ai/dsh-tools'

/** Stable cordis plugin name. */
export const name = 'genui'

/** Services required before the plugin can mount. */
export const inject = ['tools', 'systemPrompt']

/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 150

/** Model-facing announcement (mirrors the dsh-ssh convention). */
export const GENUI_GUIDANCE = '本机已安装 dsh-genui 插件（聊天生成式 UI）：模型可调用 ui_card 工具，把结构化/可视化内容（仪表盘、指标、对比表、时间线、进度、图表、告警）以 JSON 组件树传入，聊天界面会渲染为真正的界面卡片而非 markdown。支持组件：card/row/stat(带涨跌)/table(可排序，filter:true 开筛选)/progress/timeline/chart(柱状)/kv/badges/alert(四色)/code/collapse(折叠面板)/tabs(选项卡)/buttons/form(表单：包裹 input/select/textarea，字段需唯一 name)/text，可任意嵌套，值必须是纯 JSON。交互能力：buttons 的 items 可传 {label,action,confirm}，用户点击（默认需二次确认）会以用户消息把事件发回对话流；表单提交把全部字段打包进信封 payload 一次回传，省额度。collapse/tabs/表格排序筛选为本地交互。事件格式：收到「[ui_card 事件] {json}」开头的用户消息时，解析其 JSON 信封（cardId 定位来源卡片、action 为请求动作、payload 为表单字段集合），按对话上下文执行。工具返回的 warnings 列出 spec 中将被丢弃/截断的字段路径，请据此修正后再渲染。回答包含结构化或视觉数据、或用户要求「卡片/面板/仪表盘/可视化」时优先使用 ui_card 展示。'

/** The component vocabulary, shared by the tool description. */
const NODES = 'card{title,children}, row{children}, stat{label,value,delta}, stat-row{children}, table{columns,rows,filter?}, progress{label,value}, timeline{items:[{title,desc}]}, chart{items:[{label,value}]}, kv{items:[{key,value}]}, badges{items:strings}, alert{tone:info|ok|warn|err,text}, code{text}, collapse{title,open,children}, tabs{items:[{label,children}]}, buttons{items:strings|{label,action,confirm}}, form{action,submitLabel,confirm?,children}, input{name,label,value?,placeholder?,password?}, select{name,label,options:strings}, textarea{name,label,value?,placeholder?}, text{text}'

/**
 * Static spec pre-check (host side): mirrors the browser half's render-time
 * limits so the TOOL RESULT can already tell the model what will be dropped
 * or truncated — before the user ever sees a blank row. Bounded to 20 notes.
 */
function precheck(spec) {
  const notes = []
  const TYPES = new Set(['card', 'row', 'stat-row', 'stat', 'table', 'progress', 'timeline', 'chart', 'kv', 'badges', 'alert', 'code', 'collapse', 'tabs', 'buttons', 'form', 'input', 'select', 'textarea', 'text'])
  function scalarOK(v) {
    return v === null || v === undefined || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
  }
  function walk(node, path, depth) {
    if (notes.length >= 20) return
    if (depth > 6) { notes.push(path + ': 嵌套超过 6 层上限，多余层级不会渲染'); return }
    if (node === null || node === undefined || typeof node !== 'object') return
    const type = typeof node.type === 'string' ? node.type : ''
    if (type === '') { notes.push((path || 'spec') + ': 缺少 type 字段，整个节点不会渲染'); return }
    if (!TYPES.has(type)) notes.push(path + ': 未知组件类型「' + type + '」')
    const kids = Array.isArray(node.children) ? node.children : (node.children ? [node.children] : [])
    if (kids.length > 30) notes.push(path + '.children: ' + kids.length + ' 项超出上限 30，将截断')
    kids.slice(0, 30).forEach((child, i) => { walk(child, path + '.children[' + i + ']', depth + 1) })
    if (type === 'badges' && Array.isArray(node.items)) {
      node.items.forEach((item, i) => {
        if (item !== null && typeof item === 'object') {
          const hint = typeof item.label === 'string' ? item.label : '…'
          notes.push('badges.items[' + i + ']: badges items 必须是字符串数组，对象值将被丢弃；请改用 ["' + hint + '"]')
        }
      })
      if (node.items.length > 30) notes.push('badges.items: ' + node.items.length + ' 项超出上限 30，将截断')
    }
    if ((type === 'kv' || type === 'timeline') && Array.isArray(node.items) && node.items.length > 40) {
      notes.push(type + '.items: ' + node.items.length + ' 项超出上限 40，将截断')
    }
    if (type === 'chart' && Array.isArray(node.items) && node.items.length > 24) {
      notes.push('chart.items: ' + node.items.length + ' 项超出上限 24，将截断')
    }
    if (type === 'table') {
      if (Array.isArray(node.columns) && node.columns.length > 20) notes.push('table.columns: 超出上限 20，将截断')
      if (Array.isArray(node.rows)) {
        if (node.rows.length > 100) notes.push('table.rows: ' + node.rows.length + ' 行超出上限 100，将截断')
        node.rows.slice(0, 100).forEach((row, ri) => {
          if (Array.isArray(row)) row.forEach((cell, ci) => {
            if (!scalarOK(cell) && notes.length < 20) notes.push('table.rows[' + ri + '][' + ci + ']: 值必须是字符串/数字，将被丢弃')
          })
        })
      }
    }
    if (type === 'kv' && Array.isArray(node.items)) {
      node.items.forEach((item, i) => {
        if (item && typeof item === 'object') {
          if (!scalarOK(item.key)) notes.push('kv.items[' + i + '].key: 值必须是字符串/数字，将被丢弃')
          if (!scalarOK(item.value)) notes.push('kv.items[' + i + '].value: 值必须是字符串/数字，将被丢弃')
        }
      })
    }
    if (type === 'buttons' && Array.isArray(node.items)) {
      node.items.forEach((item, i) => {
        if (item !== null && typeof item === 'object' && typeof item.label !== 'string' && typeof item.action !== 'string') {
          notes.push('buttons.items[' + i + ']: 既无 label 也无 action，按钮不会渲染')
        }
      })
    }
    if (type === 'form' && typeof node.action !== 'string') {
      notes.push('form: 缺少 action 字段，提交信封 action 将为默认值 form-submit')
    }
    if ((type === 'input' || type === 'select' || type === 'textarea') && typeof node.name !== 'string') {
      notes.push(type + ': 缺少 name 字段，提交时该字段值不会被收集')
    }
    if (type === 'select' && !Array.isArray(node.options)) {
      notes.push('select: 缺少 options 字符串数组，下拉框将为空')
    }
  }
  walk(spec, 'spec', 0)
  return notes.slice(0, 20)
}

/** Build the tool definition once per apply. */
function makeTool() {
  return defineTool({
    name: 'ui_card',
    description:
      'Render a generative UI card inside the chat instead of markdown. ' +
      'Use this whenever the answer contains structured or visual data — dashboards, metrics, comparisons, tables, timelines, progress, charts, callouts — ' +
      'or when the user asks for a card, panel, dashboard, or visualization. ' +
      'Pass a JSON component tree built from supported nodes: ' + NODES + '. ' +
      'children may nest nodes and strings. All values must be plain JSON (strings/numbers).',
    parameters: {
      spec: {
        type: 'object',
        additionalProperties: true,
        required: true,
        description:
          'Root component node, e.g. {"type":"card","title":"...","children":[...]}. ' +
          'Supported types: card, row, stat-row, stat, table (click headers to sort; filter:true adds a filter box), progress, timeline, chart, kv, badges, alert, code, collapse, tabs, buttons, form, input, select, textarea, text. ' +
          'buttons items may be strings (local highlight) or {label,action,confirm}: action buttons send a "[ui_card 事件]" user message back into the conversation, confirm-then-send by default (confirm:false sends immediately). ' +
          'form wraps input/select/textarea fields (each needs a unique name); submit packs all field values into the same envelope payload {cardId,action,payload} — one message, one API turn.',
      },
      title: {
        type: 'string',
        description: 'Optional short caption shown above the UI.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          rendered: { type: 'boolean', required: true },
          rootType: { type: 'string', required: true },
          warnings: { type: 'array', items: { type: 'string' } },
        },
      },
      render(args, value) {
        const warnings = value && Array.isArray(value.warnings) ? value.warnings : []
        const lines = ['GenUI 卡片已渲染（根组件: ' + String(value && value.rootType) + '）。界面已在对话流中展示。']
        if (warnings.length) {
          lines.push('⚠ Spec 校验警告（请在后续卡片中修正，否则对应内容不会渲染）:')
          for (const w of warnings) lines.push('· ' + w)
        }
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    async execute(args) {
      const spec = args && args.spec
      const kind = spec && typeof spec.type === 'string' ? spec.type : 'unknown'
      const warnings = spec && typeof spec === 'object' ? precheck(spec) : ['spec: 缺少有效的对象 spec']
      return { rendered: true, rootType: kind, warnings }
    },
  })
}

/**
 * Mount the tool and the announcement.
 * @param {import('@deepseek-ai/cordis').Context} ctx - host plugin context.
 */
export function apply(ctx) {
  const tool = makeTool()
  ctx.effect(() => {
    const disposeTool = ctx.tools.register(tool)
    const disposeSection = ctx.systemPrompt.section({
      name: 'plugin:dsh-genui',
      order: SECTION_ORDER,
      text: GENUI_GUIDANCE,
    })
    return () => {
      disposeTool()
      disposeSection()
    }
  }, 'dsh-genui: tool + prompt')
}
