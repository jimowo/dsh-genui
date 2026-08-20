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
export const GENUI_GUIDANCE = '本机已安装 dsh-genui 插件（聊天生成式 UI）：模型可调用 ui_card 工具，把结构化/可视化内容（仪表盘、指标、对比表、时间线、进度、图表、告警）以 JSON 组件树传入，聊天界面会渲染为真正的界面卡片而非 markdown。支持组件：card/row/stat(带涨跌)/table(可排序，filter:true 开筛选)/progress/timeline/chart(柱状)/kv/badges/alert(四色)/code/collapse(折叠面板)/tabs(选项卡)/buttons/text，可任意嵌套，值必须是纯 JSON。交互能力：buttons 的 items 可传 {label,action,confirm}，用户点击（默认需二次确认）会以用户消息把事件发回对话流触发你继续处理；collapse/tabs/表格排序筛选为本地交互。收到「[ui_card 事件]」开头的用户消息时，这是界面卡片按钮回传的事件，请按对话上下文响应其 action。回答包含结构化或视觉数据、或用户要求「卡片/面板/仪表盘/可视化」时优先使用 ui_card 展示。'

/** The component vocabulary, shared by the tool description. */
const NODES = 'card{title,children}, row{children}, stat{label,value,delta}, stat-row{children}, table{columns,rows,filter?}, progress{label,value}, timeline{items:[{title,desc}]}, chart{items:[{label,value}]}, kv{items:[{key,value}]}, badges{items:strings}, alert{tone:info|ok|warn|err,text}, code{text}, collapse{title,open,children}, tabs{items:[{label,children}]}, buttons{items:strings|{label,action,confirm}}, text{text}'

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
          'Supported types: card, row, stat-row, stat, table (click headers to sort; filter:true adds a filter box), progress, timeline, chart, kv, badges, alert, code, collapse, tabs, buttons, text. ' +
          'buttons items may be strings (local highlight) or {label,action,confirm}: action buttons send a "[ui_card 事件]" user message back into the conversation, confirm-then-send by default (confirm:false sends immediately).',
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
        },
      },
      render(args, value) {
        return [{
          type: 'text',
          text: 'GenUI 卡片已渲染（根组件: ' + String(value && value.rootType) + '）。界面已在对话流中展示。',
        }]
      },
    },
    async execute(args) {
      const spec = args && args.spec
      const kind = spec && typeof spec.type === 'string' ? spec.type : 'unknown'
      return { rendered: true, rootType: kind }
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
