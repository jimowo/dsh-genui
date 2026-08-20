/**
 * dsh-genui — browser half (runs inside the dsh web GUI).
 *
 * Bundled in the `window.__ModuleLoader__.load` factory format the dsh client
 * module loader evals as a classic script (raw ESM here would be a SyntaxError
 * that kills the whole client boot chain).
 *
 * Registers the `ui_card` renderer in the keyed `tool.call.toolview` slot.
 * The owner passes ToolCallOwnerProps { callId, toolName, block, ... }; the
 * spec lives in block.argsRaw (running) or block.call.argsRaw (settled) as a
 * RAW JSON STRING, which this half parses and renders as React components.
 *
 * Failure policy: parse/render problems degrade to a small note card, never
 * a throw — an external plugin must not take the GUI down.
 */

window.__ModuleLoader__.load({
	id: "dsh-genui",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		const { createElement, useState, Fragment } = require("react");

		/** Stable cordis plugin name. */
		const name = "genui-client";

		/** Required services (fiber inject waiting — slot system first; sessions
		 *  scope + conversation send are needed by interactive button events). */
		const inject = ["slots", "sessions", "conversation"];

		/** Namespaced styles; neutral grays so light/dark themes both work. */
		const CSS = [
			'.genui-root{font-size:13px;line-height:1.55;color:inherit;}',
			'.genui-card{border:1px solid rgba(128,128,128,.3);border-radius:10px;padding:10px 12px;margin:6px 0;background:rgba(128,128,128,.05);}',
			'.genui-card-title{font-weight:600;font-size:12px;opacity:.75;margin-bottom:6px;letter-spacing:.02em;}',
			'.genui-row{display:flex;flex-wrap:wrap;gap:8px;}',
			'.genui-stat{flex:1;min-width:96px;border:1px solid rgba(128,128,128,.3);border-radius:8px;padding:8px 10px;}',
			'.genui-stat-v{font-size:18px;font-weight:650;}',
			'.genui-stat-l{font-size:11px;opacity:.6;margin-top:2px;}',
			'.genui-delta-up{color:#2e9e5b;font-size:11px}',
			'.genui-delta-down{color:#d05050;font-size:11px}',
			'.genui-table{width:100%;border-collapse:collapse;font-size:12px;margin:4px 0;}',
			'.genui-table th,.genui-table td{text-align:left;padding:4px 8px;border-bottom:1px solid rgba(128,128,128,.2);}',
			'.genui-table th{opacity:.6;font-weight:600;}',
			'.genui-prog{background:rgba(128,128,128,.15);border-radius:99px;height:8px;overflow:hidden;flex:1;}',
			'.genui-prog-fill{height:100%;background:var(--ds-color-accent,#4f8ef7);border-radius:99px;transition:width .3s;}',
			'.genui-tl{border-left:2px solid rgba(128,128,128,.3);padding-left:12px;margin:4px 0;}',
			'.genui-tl-item{position:relative;padding:2px 0 8px;}',
			'.genui-tl-item:before{content:"";position:absolute;left:-17px;top:7px;width:8px;height:8px;border-radius:50%;background:var(--ds-color-accent,#4f8ef7);}',
			'.genui-tl-t{font-weight:600;font-size:12px;}',
			'.genui-tl-d{font-size:12px;opacity:.65;}',
			'.genui-alert{border-radius:8px;padding:8px 12px;margin:6px 0;font-size:12px;border:1px solid;}',
			'.genui-alert-info{border-color:#4f8ef7;background:rgba(79,142,247,.08);}',
			'.genui-alert-ok{border-color:#2e9e5b;background:rgba(46,158,91,.08);}',
			'.genui-alert-warn{border-color:#d09b2d;background:rgba(208,155,45,.1);}',
			'.genui-alert-err{border-color:#d05050;background:rgba(208,80,80,.08);}',
			'.genui-badge{display:inline-block;border-radius:99px;padding:1px 9px;font-size:11px;margin:2px 4px 2px 0;border:1px solid rgba(128,128,128,.35);}',
			'.genui-collapse{border:1px solid rgba(128,128,128,.3);border-radius:8px;margin:6px 0;background:rgba(128,128,128,.05);}',
			'.genui-collapse-h{cursor:pointer;padding:6px 10px;font-weight:600;font-size:12px;user-select:none;display:flex;justify-content:space-between;align-items:center;}',
			'.genui-collapse-b{padding:4px 10px 8px;border-top:1px solid rgba(128,128,128,.2);}',
			'.genui-tabs{margin:6px 0;}',
			'.genui-tabbar{display:flex;gap:4px;border-bottom:1px solid rgba(128,128,128,.3);margin-bottom:6px;flex-wrap:wrap;}',
			'.genui-tab{cursor:pointer;padding:4px 12px;font-size:12px;border-radius:6px 6px 0 0;opacity:.65;user-select:none;}',
			'.genui-tab-on{opacity:1;font-weight:600;background:rgba(128,128,128,.12);}',
			'.genui-th-sort{cursor:pointer;user-select:none;white-space:nowrap;}',
			'.genui-tfilter{font-size:12px;padding:3px 8px;border:1px solid rgba(128,128,128,.35);border-radius:6px;margin:2px 0 4px;background:transparent;color:inherit;width:200px;}',
			'.genui-btn-pending{background:rgba(208,155,45,.15);border-color:#d09b2d;color:inherit;}',
			'.genui-btn-sent{background:rgba(46,158,91,.15);border-color:#2e9e5b;color:#2e9e5b;cursor:default;}',
			'.genui-btn-err{background:rgba(208,80,80,.12);border-color:#d05050;color:#d05050;}',
			'.genui-kv{display:grid;grid-template-columns:auto 1fr;gap:2px 14px;margin:4px 0;font-size:12px;}',
			'.genui-kv-k{opacity:.6;}',
			'.genui-code{font-family:ui-monospace,Consolas,monospace;font-size:12px;background:rgba(128,128,128,.12);border-radius:6px;padding:8px 10px;overflow:auto;margin:4px 0;white-space:pre-wrap;}',
			'.genui-bars{display:flex;align-items:flex-end;gap:6px;height:72px;margin:6px 0;}',
			'.genui-bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:2px;height:100%;}',
			'.genui-bar-v{width:100%;background:var(--ds-color-accent,#4f8ef7);border-radius:4px 4px 0 0;opacity:.85;}',
			'.genui-bar-l{font-size:10px;opacity:.6;}',
			'.genui-btn{cursor:pointer;border:1px solid rgba(128,128,128,.4);border-radius:8px;padding:4px 12px;font-size:12px;background:transparent;color:inherit;margin:4px 6px 0 0;}',
			'.genui-btn-on{background:var(--ds-color-accent,#4f8ef7);border-color:transparent;color:#fff;}',
			'.genui-note{font-size:11px;opacity:.55;margin-top:6px;}',
		].join('')

		/** Render only strings/numbers/booleans; anything else becomes ''. */
		function text(v) {
			if (v === null || v === undefined) return ''
			if (typeof v === 'string') return v
			if (typeof v === 'number' || typeof v === 'boolean') return String(v)
			return ''
		}

		/** Client root context, captured in apply() for the event send path. */
		let rootCtx = null

		/**
		 * Per-card render diagnostics (v0.3 validation feedback): collected while
		 * rendering, rendered as a note at the card bottom, so a silently
		 * text()-dropped field (e.g. badges items of {label} objects) becomes
		 * visible instead of a blank row the model believes rendered fine.
		 */
		function makeDiag() {
			const list = []
			const self = {
				warn(msg) { if (list.length < 12) list.push(msg) },
				note(path, v) {
					if (v === null || v === undefined || typeof v === 'string'
						|| typeof v === 'number' || typeof v === 'boolean') return ''
					self.warn(path + ': 不支持的值类型 ' + Object.prototype.toString.call(v).slice(8, -1) + '，已丢弃')
					return ''
				},
				trunc(path, limit, actual) {
					if (actual > limit) self.warn(path + ': ' + actual + ' 项超出上限 ' + limit + '，已截断')
				},
				unknown(path, type) {
					self.warn(path + ': 未知组件类型「' + type + '」，已降级为容器')
				},
				empty() { return list.length === 0 },
				el() {
					return list.length ? createElement('div', { className: 'genui-note', style: { color: '#d09b2d', marginTop: 6 } },
						'⚠ Spec 校验警告（供模型修正）:',
						list.map((m, i) => createElement('div', { key: 'w' + i }, '· ' + m))) : null
				},
			}
			return self
		}

		/** text() with diagnostics: records the drop path when v is unsupported. */
		function textD(v, path, diag) {
			if (v === null || v === undefined) return ''
			if (typeof v === 'string') return v
			if (typeof v === 'number' || typeof v === 'boolean') return String(v)
			diag.note(path, v)
			return ''
		}

		/**
		 * Build the send function for one card instance. Session-scoped when the
		 * slot props carry a sessionId (SessionStandardProps); falls back to the
		 * root context otherwise. Throws when no conversation service is reachable.
		 */
		function makeSend(props) {
			return async function send(text) {
				const sid = props && props.sessionId
				const scoped = sid && rootCtx && rootCtx.sessions ? rootCtx.sessions.scope(sid) : null
				const target = scoped || rootCtx
				if (!target || !target.conversation || typeof target.conversation.send !== 'function') {
					throw new Error('无可用的会话发送通道')
				}
				await target.conversation.send(text)
			}
		}

		/**
		 * Interactive buttons group.
		 * items entries: plain string → legacy local-highlight single select;
		 * {label, action, confirm} → event button: confirm-then-send by default
		 * (first click arms "确认发送？", second click sends a user message into
		 * the session so the agent can act on it). confirm:false sends directly.
		 */
		function Buttons({ items, env }) {
			const raw = Array.isArray(items) ? items.slice(0, 8) : []
			const parsed = raw.map(item => {
				if (item !== null && typeof item === 'object') {
					return {
						label: text(item.label) || text(item.action),
						action: text(item.action),
						confirm: item.confirm !== false,
					}
				}
				return { label: text(item), action: '', confirm: false }
			}).filter(b => b.label !== '')
			const [selected, setSelected] = useState(0)
			const [pending, setPending] = useState(-1)
			const [sent, setSent] = useState(-1)
			const [error, setError] = useState('')
			const send = env && typeof env.send === 'function' ? env.send : null

			async function fire(index) {
				const b = parsed[index]
				if (!send) {
					setPending(-1)
					setError('无会话作用域，无法发送事件')
					return
				}
				// v0.3 structured event envelope: human-readable prefix + one JSON
				// line the agent can parse stably (cardId locates the source card).
				const envelope = '[ui_card 事件] ' + JSON.stringify({
					cardId: env && env.cardId ? env.cardId : 'card',
					action: b.action,
					label: b.label,
				})
				try {
					await send(envelope + '\n（界面卡片按钮事件，请按 action 与对话上下文处理）')
					setPending(-1)
					setSent(index)
					setError('')
				} catch (e) {
					setPending(-1)
					setError('发送失败: ' + (e && e.message ? e.message : String(e)))
				}
			}

			function click(index) {
				const b = parsed[index]
				if (!b.action) { setSelected(index); return }
				if (sent === index) return
				if (!b.confirm) { fire(index); return }
				if (pending === index) fire(index)
				else { setPending(index); setError('') }
			}

			return createElement('div', null,
				parsed.map((b, index) => {
					let cls = 'genui-btn'
					let label = b.label
					if (!b.action && selected === index) cls += ' genui-btn-on'
					if (b.action && pending === index) { cls += ' genui-btn-pending'; label = b.label + ' — 确认发送？' }
					if (b.action && sent === index) { cls += ' genui-btn-sent'; label = '✓ ' + b.label }
					return createElement('button', {
						key: 'bt' + index,
						className: cls,
						onClick: () => { click(index) },
					}, label)
				}),
				error ? createElement('div', { className: 'genui-note', style: { color: '#d05050' } }, error) : null)
		}

		/** Collapsible panel: click the header to toggle. open:true starts expanded. */
		function Collapse({ title, open, childEls }) {
			const [on, setOn] = useState(!!open)
			return createElement('div', { className: 'genui-collapse' },
				createElement('div', { className: 'genui-collapse-h', onClick: () => { setOn(!on) } },
					title || '折叠面板',
					createElement('span', null, on ? '▾' : '▸')),
				on ? createElement('div', { className: 'genui-collapse-b' }, childEls) : null)
		}

		/** Tab group: items:[{label, children:[nodes]}]; local active-tab state. */
		function Tabs({ node, depth, env }) {
			const items = Array.isArray(node.items)
				? node.items.filter(it => it !== null && typeof it === 'object').slice(0, 8)
				: []
			const [active, setActive] = useState(0)
			const cur = items.length ? items[Math.min(active, items.length - 1)] : null
			const kids = cur && Array.isArray(cur.children) ? cur.children : (cur && cur.children ? [cur.children] : [])
			return createElement('div', { className: 'genui-tabs' },
				createElement('div', { className: 'genui-tabbar' }, items.map((it, index) =>
					createElement('span', {
						key: 'tab' + index,
						className: 'genui-tab' + (index === active ? ' genui-tab-on' : ''),
						onClick: () => { setActive(index) },
					}, text(it.label) || ('Tab ' + (index + 1))))),
				kids.slice(0, 30).map((child, index) =>
					createElement(Fragment, { key: 'tc' + index }, renderNode(child, depth + 1, env))))
		}

		/**
		 * Sortable (always) and filterable (opt-in via filter:true) table.
		 * Click a header to sort asc/desc — numeric-aware compare; type in the
		 * filter box to substring-match whole rows (case-insensitive).
		 */
		function Table({ columns, rows, filter }) {
			const [sortCol, setSortCol] = useState(-1)
			const [dir, setDir] = useState(1)
			const [q, setQ] = useState('')

			function cmp(a, b) {
				const na = parseFloat(a), nb = parseFloat(b)
				if (Number.isFinite(na) && Number.isFinite(nb) && String(a).trim() !== '' && String(b).trim() !== '') {
					return na - nb
				}
				return String(a).localeCompare(String(b), undefined, { numeric: true })
			}

			let view = rows
			if (filter && q !== '') {
				const needle = q.toLowerCase()
				view = rows.filter(row => row.some(cell => String(cell).toLowerCase().includes(needle)))
			}
			if (sortCol >= 0 && sortCol < columns.length) {
				view = view.slice().sort((r1, r2) => dir * cmp(r1[sortCol] || '', r2[sortCol] || ''))
			}

			function headerClick(index) {
				if (sortCol === index) setDir(-dir)
				else { setSortCol(index); setDir(1) }
			}

			return createElement('div', null,
				filter ? createElement('input', {
					className: 'genui-tfilter',
					type: 'text',
					placeholder: '筛选行…',
					value: q,
					onChange: e => { setQ(e && typeof e.target === 'object' ? e.target.value : '') },
				}) : null,
				createElement('table', { className: 'genui-table' },
					createElement('thead', null, createElement('tr', null, columns.map((column, index) =>
						createElement('th', {
							key: 'h' + index,
							className: 'genui-th-sort',
							onClick: () => { headerClick(index) },
						}, column + (sortCol === index ? (dir > 0 ? ' ▲' : ' ▼') : ''))))),
					createElement('tbody', null, view.map((row, rowIndex) =>
						createElement('tr', { key: 'r' + rowIndex }, row.map((cell, cellIndex) =>
							createElement('td', { key: 'd' + cellIndex }, cell)))))))
		}

		/** Recursively render one spec node; depth- and width-bounded. The env
		 *  carries the per-card send function (event buttons) and the per-card
		 *  diagnostics collector (validation feedback). */
		function renderNode(node, depth, env) {
			const diag = env.diag
			if (depth > 6) {
				if (depth === 7 && diag) diag.warn('(depth>6): 嵌套超过 6 层，多余层级已丢弃')
				return null
			}
			if (node === null || node === undefined) return null
			if (typeof node === 'string' || typeof node === 'number') {
				return createElement('div', null, String(node))
			}
			if (typeof node !== 'object') return null
			const type = String(node.type || '')
			const kids = Array.isArray(node.children) ? node.children : (node.children ? [node.children] : [])
			if (diag && Array.isArray(node.children) && node.children.length > 30) {
				diag.trunc(type + '.children', 30, node.children.length)
			}
			const childEls = kids.slice(0, 30).map((child, index) =>
				createElement(Fragment, { key: 'k' + index }, renderNode(child, depth + 1, env)),
			)
			if (type === 'card') {
				return createElement('div', { className: 'genui-card', key: 'c' + depth },
					node.title ? createElement('div', { className: 'genui-card-title' }, text(node.title)) : null,
					childEls)
			}
			if (type === 'row' || type === 'stat-row') {
				return createElement('div', { className: 'genui-row' }, childEls)
			}
			if (type === 'stat') {
				const delta = typeof node.delta === 'number' ? node.delta : null
				return createElement('div', { className: 'genui-stat' },
					createElement('div', { className: 'genui-stat-v' }, text(node.value)),
					createElement('div', { className: 'genui-stat-l' }, text(node.label)),
					delta !== null
						? createElement('div', { className: delta >= 0 ? 'genui-delta-up' : 'genui-delta-down' },
							(delta >= 0 ? '▲ +' : '▼ ') + String(delta))
						: null)
			}
			if (type === 'table') {
				const columns = Array.isArray(node.columns) ? node.columns.map(text).slice(0, 20) : []
				const rows = Array.isArray(node.rows)
					? node.rows.slice(0, 100).map(row => (Array.isArray(row) ? row.map(text).slice(0, 20) : []))
					: []
				return createElement(Table, { columns, rows, filter: node.filter === true })
			}
			if (type === 'progress') {
				const value = Math.max(0, Math.min(100, Number(node.value) || 0))
				return createElement('div', { className: 'genui-row', style: { alignItems: 'center' } },
					node.label ? createElement('span', { style: { fontSize: 12, opacity: 0.7, minWidth: 72 } }, text(node.label)) : null,
					createElement('div', { className: 'genui-prog' },
						createElement('div', { className: 'genui-prog-fill', style: { width: value + '%' } })),
					createElement('span', { style: { fontSize: 11, opacity: 0.6, minWidth: 34, textAlign: 'right' } }, value + '%'))
			}
			if (type === 'timeline') {
				const items = Array.isArray(node.items) ? node.items.slice(0, 40) : []
				return createElement('div', { className: 'genui-tl' }, items.map((item, index) => {
					if (item === null || typeof item !== 'object') return null
					return createElement('div', { className: 'genui-tl-item', key: 't' + index },
						createElement('div', { className: 'genui-tl-t' }, text(item.title)),
						item.desc ? createElement('div', { className: 'genui-tl-d' }, text(item.desc)) : null)
				}))
			}
			if (type === 'alert') {
				const tone = ['info', 'ok', 'warn', 'err'].includes(text(node.tone)) ? text(node.tone) : 'info'
				return createElement('div', { className: 'genui-alert genui-alert-' + tone }, text(node.text))
			}
			if (type === 'badges') {
				const src = Array.isArray(node.items) ? node.items : []
				if (diag && src.length) {
					src.forEach((item, index) => {
						if (item !== null && typeof item === 'object') {
							diag.warn('badges.items[' + index + ']: badges 的 items 必须是字符串数组，对象值被丢弃；请改用 ["' + (text(item.label) || text(item.text) || '…') + '"]')
						}
					})
				}
				if (diag) diag.trunc('badges.items', 30, src.length)
				const items = src.map(text).slice(0, 30)
				return createElement('div', null, items.map((badge, index) =>
					createElement('span', { className: 'genui-badge', key: 'b' + index }, badge)))
			}
			if (type === 'kv') {
				const src = Array.isArray(node.items) ? node.items : []
				if (diag) diag.trunc('kv.items', 40, src.length)
				const items = src.slice(0, 40)
				return createElement('div', { className: 'genui-kv' }, items.map((item, index) => {
					if (item === null || typeof item !== 'object') return null
					return createElement(Fragment, { key: 'kv' + index },
						createElement('div', { className: 'genui-kv-k' }, textD(item.key, 'kv.items[' + index + '].key', diag)),
						createElement('div', null, textD(item.value, 'kv.items[' + index + '].value', diag)))
				}))
			}
			if (type === 'code') {
				return createElement('pre', { className: 'genui-code' }, text(node.text))
			}
			if (type === 'chart') {
				const items = Array.isArray(node.items) ? node.items.slice(0, 24) : []
				const nums = items.map(item => (item && typeof item === 'object' ? Number(item.value) || 0 : 0))
				const max = Math.max(...nums, 0)
				return createElement('div', { className: 'genui-bars' }, items.map((item, index) => {
					const height = max > 0 ? Math.round((nums[index] / max) * 100) : 0
					return createElement('div', { className: 'genui-bar', key: 'bar' + index },
						createElement('div', { className: 'genui-bar-v', style: { height: height + '%' } }),
						item && typeof item === 'object'
							? createElement('div', { className: 'genui-bar-l' }, text(item.label))
							: null)
				}))
			}
			if (type === 'collapse') {
				return createElement(Collapse, { title: text(node.title), open: node.open === true, childEls })
			}
			if (type === 'tabs') {
				return createElement(Tabs, { node, depth, env })
			}
			if (type === 'buttons') {
				return createElement(Buttons, { items: node.items, env })
			}
			if (type === 'text') {
				return createElement('div', null, text(node.text))
			}
			// Unknown type: degrade to a plain card of its children.
			if (diag && type !== '') diag.unknown('spec', type)
			return childEls.length ? createElement('div', { className: 'genui-card' }, childEls) : null
		}

		/**
		 * Extract the spec from ToolCallOwnerProps.
		 * block: RunningToolCall { argsRaw } | ToolResultNode { call: { argsRaw } | null }.
		 * argsRaw is the RAW JSON STRING of the tool arguments { spec, title }.
		 */
		function loadSpec(props) {
			const block = props && props.block
			if (block === null || typeof block !== 'object') return null
			const settled = 'kind' in block
			const raw = settled
				? (block.call && typeof block.call.argsRaw === 'string' ? block.call.argsRaw : null)
				: (typeof block.argsRaw === 'string' ? block.argsRaw : null)
			if (raw === null || raw === '') return null
			let args
			try {
				args = JSON.parse(raw)
			} catch {
				return null
			}
			if (args === null || typeof args !== 'object') return null
			if (args.spec && typeof args.spec === 'object' && typeof args.spec.type === 'string') return args.spec
			if (typeof args.type === 'string') return args
			return null
		}

		/** The registered view component. */
		function GenUICard(props) {
			const spec = loadSpec(props)
			if (spec === null) {
				return createElement('div', { className: 'genui-card genui-note' },
					'GenUI: this call carries no renderable spec yet.')
			}
			const diag = makeDiag()
			const cardId = (props && props.callId) ? String(props.callId).slice(-8) : 'card'
			const el = renderNode(spec, 0, { send: makeSend(props), diag, cardId })
			return createElement('div', { className: 'genui-root' }, el, diag.el())
		}

		/**
		 * Mount the stylesheet and the toolview renderer.
		 * @param {import('@deepseek-ai/dsh-client-runtime/client').ClientContext} ctx - client root context.
		 */
		function apply(ctx) {
			rootCtx = ctx
			ctx.effect(() => {
				const element = document.createElement('style')
				element.setAttribute('data-dsh-genui', '')
				element.textContent = CSS
				document.head.appendChild(element)
				return () => { element.remove() }
			}, 'dsh-genui: styles')

			ctx.slots.inject('tool.call.toolview', () =>
				ctx.slots.register(
					{ name: 'tool.call.toolview', key: 'ui_card' },
					(props) => createElement(GenUICard, props),
				))
		}

		exports.name = name;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});
