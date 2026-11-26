/**
 * dsh-link-library — Client half.
 *
 * One panel with three tabs: links (read later), todos, and Markdown articles.
 * Reads and writes the Host half through `GET api/link-library` and
 * `POST api/link-library.act`. Everything renders as React elements; Markdown
 * never goes through innerHTML.
 */
window.__ModuleLoader__.load({
  id: 'dsh-link-library',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const PANEL = 'links'
    const API = 'api/link-library'
    const ACT = `${API}.act`

    // ------------------------------------------------------------ strings

    const DICT = {
      zh: {
        panel: '链接与笔记',
        title: '链接与笔记',
        subtitle: '看过的链接、要做的事、要写的文章，都放在这里。',
        'tab.links': '链接',
        'tab.todos': '待办',
        'tab.articles': '文章',
        refresh: '刷新',
        loading: '正在读记录…',
        'error.load': '读不到记录：{message}',
        'stale.banner': '插件已经更新，但 Harness 还没重启：新加的待办和文章要重启应用后才能用。',
        retry: '重试',
        dismiss: '关闭',
        undo: '撤销',
        'count.links': '{n} 条',
        'count.todos': '{o} 条待办',
        'count.articles': '{n} 篇',
        'when.now': '刚刚',
        'when.minutes': '{n} 分钟前',
        'when.hours': '{n} 小时前',
        'when.days': '{n} 天前',

        'link.add': '粘贴链接，回车收藏',
        'link.addBtn': '收藏',
        'link.adding': '收藏中…',
        'link.search': '搜索标题、网址或备注',
        'link.all': '全部 {n}',
        'link.unread': '待看 {u}',
        'link.read': '已看 {n}',
        'link.empty': '还没有收藏的链接。在对话里发一个网址，或在上面的输入框粘贴链接。',
        'link.emptyFilter': '没有符合条件的链接。',
        'link.markRead': '标为已看',
        'link.markUnread': '标为待看',
        'link.copy': '复制链接',
        'link.remove': '删除',
        'link.added': '{when}收藏',
        'link.toast.added': '已收藏',
        'link.toast.duplicate': '这个链接已经在收藏里了',
        'link.toast.removed': '已删除',
        'link.toast.restored': '已恢复',
        'link.toast.copied': '链接已复制',
        'link.toast.copyFailed': '复制不了，网址是：{url}',
        'link.toast.openFailed': '打不开：{message}',
        'link.toast.openFailedCopied': '打不开（{message}），链接已经复制到剪贴板',
        'toast.salvaged': '旧的记录文件读不出来，已备份到 {path}，列表从空的开始。',

        'todo.add': '写一个待办，回车添加',
        'todo.addBtn': '添加',
        'todo.adding': '添加中…',
        'todo.search': '搜索待办',
        'todo.all': '全部 {n}',
        'todo.open': '未完成 {o}',
        'todo.done': '已完成 {d}',
        'todo.empty': '还没有待办。在对话里说「加个待办：…」，或在上面的输入框写一条。',
        'todo.emptyFilter': '没有符合条件的待办。',
        'todo.markDone': '标为已完成',
        'todo.markOpen': '改回未完成',
        'todo.edit': '改文字',
        'todo.remove': '删除',
        'todo.added': '{when}加',
        'todo.openLabel': '未完成',
        'todo.doneLabel': '已完成',
        'todo.doneAt': '{when}完成',
        'todo.toast.added': '已加进待办',
        'todo.toast.duplicate': '这条待办已经在清单里了',
        'todo.toast.removed': '已删掉待办',
        'todo.toast.restored': '已恢复待办',

        'article.new': '新建文章',
        'article.untitled': '未命名文章',
        'article.search': '搜索标题或正文',
        'article.empty': '还没有文章。点「新建文章」开始写，或者在对话里让我整理一篇。',
        'article.emptyFilter': '没有符合条件的文章。',
        'article.updated': '{when}更新',
        'article.chars': '{n} 字',
        'article.edit': '编辑',
        'article.preview': '预览',
        'article.saving': '保存中…',
        'article.saved': '已保存',
        'article.unsaved': '未保存',
        'article.titlePlaceholder': '文章标题',
        'article.bodyPlaceholder': '用 Markdown 写正文：\n# 标题\n- 列表\n**粗体**、`代码`、[链接](https://example.com)\n> 引用',
        'article.emptyPreview': '正文还是空的。',
        'article.back': '返回列表',
        'article.remove': '删除文章',
        'article.toast.created': '新建了一篇文章',
        'article.toast.removed': '已删掉文章',
        'article.toast.restored': '已恢复文章',
        'article.foot': '{n} 字 · Markdown',
      },
      en: {
        panel: 'Links & notes',
        title: 'Links & notes',
        subtitle: 'What you read, what you have to do, and what you are writing — in one place.',
        'tab.links': 'Links',
        'tab.todos': 'Todos',
        'tab.articles': 'Articles',
        refresh: 'Refresh',
        loading: 'Loading…',
        'error.load': 'Could not read your records: {message}',
        'stale.banner': 'The plugin was updated but Harness has not restarted yet: todos and articles need a restart.',
        retry: 'Try again',
        dismiss: 'Dismiss',
        undo: 'Undo',
        'count.links': '{n}',
        'count.todos': '{o} open',
        'count.articles': '{n}',
        'when.now': 'just now',
        'when.minutes': '{n} min ago',
        'when.hours': '{n} h ago',
        'when.days': '{n} d ago',

        'link.add': 'Paste a link and press Enter',
        'link.addBtn': 'Save',
        'link.adding': 'Saving…',
        'link.search': 'Search titles, URLs or notes',
        'link.all': 'All {n}',
        'link.unread': 'To read {u}',
        'link.read': 'Read {n}',
        'link.empty': 'No links yet. Send one in the chat, or paste a URL above.',
        'link.emptyFilter': 'No link matches this filter.',
        'link.markRead': 'Mark as read',
        'link.markUnread': 'Mark as unread',
        'link.copy': 'Copy link',
        'link.remove': 'Delete',
        'link.added': 'saved {when}',
        'link.toast.added': 'Saved',
        'link.toast.duplicate': 'That link is already saved',
        'link.toast.removed': 'Deleted',
        'link.toast.restored': 'Restored',
        'link.toast.copied': 'Link copied',
        'link.toast.copyFailed': 'Could not copy; the URL is: {url}',
        'link.toast.openFailed': 'Could not open it: {message}',
        'link.toast.openFailedCopied': 'Could not open it ({message}); the link is on your clipboard',
        'toast.salvaged': 'The old records file could not be read; it was moved to {path} and the list starts empty.',

        'todo.add': 'Write a todo and press Enter',
        'todo.addBtn': 'Add',
        'todo.adding': 'Adding…',
        'todo.search': 'Search todos',
        'todo.all': 'All {n}',
        'todo.open': 'Open {o}',
        'todo.done': 'Done {d}',
        'todo.empty': 'No todos yet. Say “add a todo: …” in the chat, or write one above.',
        'todo.emptyFilter': 'No todo matches this filter.',
        'todo.markDone': 'Mark as done',
        'todo.markOpen': 'Mark as open',
        'todo.edit': 'Edit text',
        'todo.remove': 'Delete',
        'todo.added': 'added {when}',
        'todo.openLabel': 'open',
        'todo.doneLabel': 'done',
        'todo.doneAt': 'done {when}',
        'todo.toast.added': 'Added',
        'todo.toast.duplicate': 'That todo is already on the list',
        'todo.toast.removed': 'Todo deleted',
        'todo.toast.restored': 'Todo restored',

        'article.new': 'New article',
        'article.untitled': 'Untitled',
        'article.search': 'Search titles or text',
        'article.empty': 'No articles yet. Create one, or ask me to write one.',
        'article.emptyFilter': 'No article matches this filter.',
        'article.updated': 'updated {when}',
        'article.chars': '{n} chars',
        'article.edit': 'Edit',
        'article.preview': 'Preview',
        'article.saving': 'Saving…',
        'article.saved': 'Saved',
        'article.unsaved': 'Unsaved',
        'article.titlePlaceholder': 'Article title',
        'article.bodyPlaceholder': 'Write in Markdown:\n# Heading\n- list\n**bold**, `code`, [link](https://example.com)\n> quote',
        'article.emptyPreview': 'Nothing written yet.',
        'article.back': 'Back to the list',
        'article.remove': 'Delete article',
        'article.toast.created': 'Article created',
        'article.toast.removed': 'Article deleted',
        'article.toast.restored': 'Article restored',
        'article.foot': '{n} chars · Markdown',
      },
    }

    const fill = (template, values) => {
      if (typeof template !== 'string') return ''
      if (!values) return template
      return template.replace(/\{(\w+)\}/g, (match, key) =>
        values[key] === undefined || values[key] === null ? match : String(values[key]),
      )
    }

    // -------------------------------------------------------------- icons

    const stroke = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' }

    function ShelfIcon(props) {
      const size = (props && props.size) || 16
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', strokeWidth: 1.6, 'aria-hidden': true, ...stroke },
        h('path', { d: 'M5.5 4.75h9.75A1.75 1.75 0 0 1 17 6.5v13.25l-5.75-3.6-5.75 3.6V4.75Z' }),
        h('path', { d: 'M19 7.25v12.5l-2.5-1.55' }),
      )
    }

    function CheckIcon() {
      return h(
        'svg',
        { width: 11, height: 11, viewBox: '0 0 24 24', strokeWidth: 3, 'aria-hidden': true, ...stroke },
        h('path', { d: 'm5 12.5 4.5 4.5L19 7.5' }),
      )
    }

    function CopyIcon() {
      return h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 24 24', strokeWidth: 1.6, 'aria-hidden': true, ...stroke },
        h('rect', { x: 9, y: 9, width: 10.5, height: 10.5, rx: 1.6 }),
        h('path', { d: 'M6.5 15.25h-.6a1.4 1.4 0 0 1-1.4-1.4V5.1a1.4 1.4 0 0 1 1.4-1.4h8.75a1.4 1.4 0 0 1 1.4 1.4v.6' }),
      )
    }

    function TrashIcon() {
      return h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 24 24', strokeWidth: 1.6, 'aria-hidden': true, ...stroke },
        h('path', { d: 'M4.75 7h14.5' }),
        h('path', { d: 'M9.5 7V5.35a.6.6 0 0 1 .6-.6h3.8a.6.6 0 0 1 .6.6V7' }),
        h('path', { d: 'M6.85 7l.72 11.9a1.3 1.3 0 0 0 1.3 1.22h6.26a1.3 1.3 0 0 0 1.3-1.22L17.15 7' }),
      )
    }

    function RefreshIcon() {
      return h(
        'svg',
        { width: 15, height: 15, viewBox: '0 0 24 24', strokeWidth: 1.7, 'aria-hidden': true, ...stroke },
        h('path', { d: 'M19.75 12a7.75 7.75 0 1 1-2.4-5.6' }),
        h('path', { d: 'M19.75 4.5v5h-5' }),
      )
    }

    function SearchIcon() {
      return h(
        'svg',
        { width: 13, height: 13, viewBox: '0 0 24 24', strokeWidth: 1.8, 'aria-hidden': true, ...stroke },
        h('circle', { cx: 10.5, cy: 10.5, r: 6 }),
        h('path', { d: 'm15 15 4.5 4.5' }),
      )
    }

    function PlusIcon() {
      return h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 24 24', strokeWidth: 1.8, 'aria-hidden': true, ...stroke },
        h('path', { d: 'M12 5.5v13M5.5 12h13' }),
      )
    }

    function PenIcon() {
      return h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 24 24', strokeWidth: 1.6, 'aria-hidden': true, ...stroke },
        h('path', { d: 'M16.5 4.6a1.9 1.9 0 0 1 2.7 2.7L9 17.5l-3.6.9.9-3.6Z' }),
      )
    }

    function BackIcon() {
      return h(
        'svg',
        { width: 15, height: 15, viewBox: '0 0 24 24', strokeWidth: 1.8, 'aria-hidden': true, ...stroke },
        h('path', { d: 'M10 5.5 4.5 12l5.5 6.5' }),
        h('path', { d: 'M4.5 12h15' }),
      )
    }

    // ----------------------------------------------------------------- css

    const CSS = `
.ll-page{position:relative;width:100%;min-width:0;height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.6}
.ll-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable}
.ll-content{max-width:860px;margin:0 auto;padding:0 clamp(20px,4vw,44px) 64px}
.ll-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-top:28px}
[data-platform=darwin] .ll-heading{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}
.ll-heading h1{margin:0;font-size:20px;font-weight:500;line-height:28px}
.ll-sub{margin:2px 0 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
.ll-heading-tools{display:flex;align-items:center;gap:8px;flex:none;padding-top:2px}
.ll-icon{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:7px;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer}
.ll-icon:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.ll-icon:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ll-danger:hover{color:var(--dsw-alias-state-error-primary)}
.ll-nav{display:inline-flex;gap:2px;margin:20px 0 0;padding:3px;border-radius:10px;background:var(--dsw-alias-interactive-bg-hover)}
.ll-navtab{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 14px;border:0;border-radius:8px;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer}
.ll-navtab:hover{color:var(--dsw-alias-label-primary)}
.ll-navtab[aria-pressed=true]{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 0 0 .5px var(--dsw-alias-border-l2)}
.ll-navcount{color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums}
.ll-warn{display:flex;align-items:center;gap:8px;margin:14px 0 0;padding:8px 12px;border:.5px solid var(--dsw-alias-state-warn-primary);border-radius:8px;color:var(--dsw-alias-state-warn-primary);font-size:12.5px;line-height:18px}
.ll-notice{display:flex;align-items:center;gap:8px;margin:12px 0 0;padding:7px 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:18px}
.ll-notice[data-kind=error]{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.ll-notice-text{flex:1;min-width:0;word-break:break-word}
.ll-undo{flex:none;height:22px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:none;color:inherit;font:inherit;font-size:12px;cursor:pointer}
.ll-undo:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.ll-notice-close{flex:none;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:none;color:inherit;font:inherit;font-size:15px;line-height:1;cursor:pointer}
.ll-panel{padding-top:14px}
.ll-add{display:flex;align-items:center;gap:8px;margin:4px 0 0;padding:4px 4px 4px 12px;border:.5px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}
.ll-add:focus-within{border-color:var(--dsw-alias-brand-primary)}
.ll-add-input{flex:1;min-width:0;height:30px;border:0;background:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}
.ll-add-input::placeholder{color:var(--dsw-alias-label-secondary)}
.ll-add-button{flex:none;height:30px;padding:0 14px;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}
.ll-add-button:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.ll-add-button:disabled{color:var(--dsw-alias-label-secondary);cursor:default;opacity:.65}
.ll-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:16px 0 4px}
.ll-tabs{display:flex;gap:2px}
.ll-tab{height:28px;padding:0 10px;border:0;border-radius:7px;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer}
.ll-tab:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.ll-tab[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-active,var(--dsw-alias-interactive-bg-hover));color:var(--dsw-alias-label-primary)}
.ll-search{display:flex;align-items:center;gap:6px;width:min(240px,46vw);height:28px;margin-left:auto;padding:0 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-secondary)}
.ll-search:focus-within{border-color:var(--dsw-alias-brand-primary)}
.ll-search input{flex:1;min-width:0;height:100%;border:0;background:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;outline:none}
.ll-search input::placeholder{color:var(--dsw-alias-label-secondary)}
.ll-search input::-webkit-search-cancel-button{display:none}
.ll-list{margin:8px 0 0;padding:0;list-style:none}
.ll-row{display:flex;align-items:flex-start;gap:10px;padding:11px 6px;border-bottom:.5px solid var(--dsw-alias-border-l1);border-radius:6px}
.ll-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.ll-check{flex:none;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;margin-top:2px;padding:0;border:.5px solid var(--dsw-alias-border-l2);border-radius:50%;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer}
.ll-check:hover{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}
.ll-check[aria-pressed=true]{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}
.ll-body{flex:1;min-width:0}
.ll-link{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.5;word-break:break-word;text-decoration:none}
.ll-link:hover{text-decoration:underline;text-underline-offset:2px}
.ll-row:not([data-read=true]) .ll-link:hover{color:var(--dsw-alias-brand-primary)}
.ll-row[data-read=true] .ll-link{color:var(--dsw-alias-label-secondary)}
.ll-meta{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px;margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.ll-note::before{content:"— "}
.ll-actions{flex:none;display:flex;align-items:center;gap:2px;opacity:0;transition:opacity .12s}
.ll-row:hover .ll-actions,.ll-row:focus-within .ll-actions{opacity:1}
.ll-empty{padding:48px 0 20px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:22px}
.ll-error{display:flex;flex-direction:column;align-items:flex-start;gap:10px;margin:20px 0;padding:12px 14px;border:.5px solid var(--dsw-alias-state-error-primary);border-radius:10px;color:var(--dsw-alias-state-error-primary);font-size:13px}
.ll-error button{height:26px;padding:0 12px;border:.5px solid currentColor;border-radius:7px;background:none;color:inherit;font:inherit;font-size:12.5px;cursor:pointer}
.ll-todo-text{display:block;width:100%;padding:0;border:0;background:none;color:inherit;font:inherit;font-size:14px;line-height:1.5;text-align:left;cursor:text;word-break:break-word}
.ll-row[data-done=true] .ll-todo-text{color:var(--dsw-alias-label-secondary);text-decoration:line-through}
.ll-todo-edit{width:100%;height:24px;padding:0 6px;border:.5px solid var(--dsw-alias-brand-primary);border-radius:5px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;outline:none}
.ll-new{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}
.ll-new:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.ll-art{margin:8px 0 0;padding:0;list-style:none}
.ll-art-row{display:flex;align-items:flex-start;gap:10px;padding:11px 6px;border-bottom:.5px solid var(--dsw-alias-border-l1);border-radius:6px}
.ll-art-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.ll-art-open{flex:1;min-width:0;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.ll-art-title{color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.5;font-weight:500;word-break:break-word}
.ll-art-excerpt{margin-top:3px;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:19px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.ll-art-row:hover .ll-actions,.ll-art-row:focus-within .ll-actions{opacity:1}
.ll-editor{padding-top:14px}
.ll-editor-bar{display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.ll-editor-title{flex:1;min-width:0;height:34px;padding:0 6px;border:0;border-radius:7px;background:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:17px;font-weight:500;outline:none}
.ll-editor-title:focus{background:var(--dsw-alias-interactive-bg-hover)}
.ll-editor-title::placeholder{color:var(--dsw-alias-label-secondary);font-weight:400}
.ll-save{flex:none;color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums}
.ll-editor-tools{display:flex;align-items:center;gap:6px;flex:none}
.ll-editor-body{display:block;width:100%;min-height:380px;margin:12px 0 0;padding:12px 14px;border:.5px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.75;outline:none;resize:vertical}
.ll-editor-body:focus{border-color:var(--dsw-alias-brand-primary)}
.ll-editor-preview{min-height:200px;margin:12px 0 0;padding:14px 16px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px}
.ll-editor-foot{margin-top:8px;color:var(--dsw-alias-label-secondary);font-size:12px}
.md{color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.75;word-break:break-word}
.md p{margin:0 0 10px;white-space:pre-wrap}
.md h1,.md h2,.md h3,.md h4,.md h5,.md h6{margin:18px 0 8px;font-weight:600;line-height:1.4}
.md h1{font-size:20px}
.md h2{font-size:17px}
.md h3{font-size:15px}
.md h4,.md h5,.md h6{font-size:14px}
.md ul,.md ol{margin:0 0 10px;padding-left:22px}
.md li{margin:2px 0}
.md blockquote{margin:0 0 10px;padding:2px 0 2px 12px;border-left:2px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}
.md code{padding:1px 5px;border-radius:4px;background:var(--dsw-alias-interactive-bg-hover);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
.md pre{margin:0 0 12px;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);overflow:auto}
.md pre code{padding:0;background:none}
.md a{color:var(--dsw-alias-brand-primary);text-decoration:none}
.md a:hover{text-decoration:underline;text-underline-offset:2px}
.md hr{margin:14px 0;border:0;border-top:.5px solid var(--dsw-alias-border-l2)}
.md strong{font-weight:600}
.md del{color:var(--dsw-alias-label-secondary)}
.md>*:first-child{margin-top:0}
.md>*:last-child{margin-bottom:0}
@media (hover:none){.ll-actions{opacity:1}}
@media (max-width:640px){.ll-search{width:100%;margin-left:0}}
`

    // ------------------------------------------------------------ markdown

    const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~~[^~\n]+~~)|(\[[^[\]\n]*\]\([^()\s]+\))|(https?:\/\/[^\s<>()]+)/g
    const FENCE_CLOSE = (marker) => new RegExp(`^\\s*${marker}{3,}\\s*$`)
    const BLOCK_START = /^(#{1,6}\s|>\s?|[-*+]\s|\d+[.)]\s|`{3,}|~{3,})|^\s{0,3}([-*_])(\s*\1){2,}\s*$/

    function renderInline(text, prefix) {
      const nodes = []
      // A fresh regex per call: renderInline recurses, and a shared mutable
      // lastIndex would make the outer scan skip or repeat text.
      const pattern = new RegExp(INLINE.source, 'g')
      let last = 0
      let match
      let index = 0
      while ((match = pattern.exec(text)) !== null) {
        if (match.index > last) nodes.push(text.slice(last, match.index))
        const token = match[0]
        const key = `${prefix}-${index++}`
        if (token.startsWith('`')) {
          nodes.push(h('code', { key }, token.slice(1, -1)))
        } else if (token.startsWith('**') || token.startsWith('__')) {
          nodes.push(h('strong', { key }, renderInline(token.slice(2, -2), key)))
        } else if (token.startsWith('~~')) {
          nodes.push(h('del', { key }, renderInline(token.slice(2, -2), key)))
        } else if (token.startsWith('*') || token.startsWith('_')) {
          nodes.push(h('em', { key }, renderInline(token.slice(1, -1), key)))
        } else if (token.startsWith('[')) {
          const link = token.match(/^\[([^\]]*)\]\(([^)\s]+)\)$/)
          const href = link ? link[2] : ''
          if (link && /^https?:\/\//i.test(href)) {
            nodes.push(h('a', { key, href, target: '_blank', rel: 'noopener noreferrer' }, renderInline(link[1], key)))
          } else {
            nodes.push(link ? link[1] : token)
          }
        } else {
          nodes.push(h('a', { key, href: token, target: '_blank', rel: 'noopener noreferrer' }, token))
        }
        last = pattern.lastIndex
      }
      if (last < text.length) nodes.push(text.slice(last))
      return nodes
    }

    const listItem = (line) => {
      const match = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/)
      if (!match) return null
      return {
        indent: match[1].replace(/\t/g, '    ').length,
        ordered: /\d/.test(match[2]),
        text: match[3],
      }
    }

    function renderList(items, nextKey) {
      const root = { indent: -1, children: [] }
      const stack = [root]
      for (const item of items) {
        while (stack.length > 1 && stack[stack.length - 1].indent >= item.indent) stack.pop()
        const node = { indent: item.indent, ordered: item.ordered, text: item.text, children: [] }
        stack[stack.length - 1].children.push(node)
        stack.push(node)
      }
      const renderNodes = (nodes) =>
        nodes.map((node) => {
          const key = nextKey()
          const children = [renderInline(node.text, key)]
          if (node.children.length) {
            children.push(h(node.children[0].ordered ? 'ol' : 'ul', { key: `${key}-sub` }, renderNodes(node.children)))
          }
          return h('li', { key }, children)
        })
      return h(root.children[0].ordered ? 'ol' : 'ul', { key: nextKey() }, renderNodes(root.children))
    }

    /** Block-level Markdown to React elements. No HTML is ever injected. */
    function renderMarkdown(text, depth = 0) {
      const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n')
      const blocks = []
      let i = 0
      let counter = 0
      const nextKey = () => `md-${counter++}`
      while (i < lines.length) {
        const line = lines[i]
        if (!line.trim()) {
          i += 1
          continue
        }

        const fence = line.match(/^\s*(`{3,}|~{3,})\s*([A-Za-z0-9+#._-]*)\s*$/)
        if (fence) {
          const closing = FENCE_CLOSE(fence[1][0])
          const body = []
          i += 1
          while (i < lines.length && !closing.test(lines[i])) {
            body.push(lines[i])
            i += 1
          }
          if (i < lines.length) i += 1
          blocks.push(
            h(
              'pre',
              { key: nextKey() },
              h('code', { className: fence[2] ? `language-${fence[2]}` : undefined }, body.join('\n')),
            ),
          )
          continue
        }

        const heading = line.match(/^(#{1,6})\s+(.*)$/)
        if (heading) {
          const level = heading[1].length
          blocks.push(h(`h${level}`, { key: nextKey() }, renderInline(heading[2].trim(), `hd${counter}`)))
          i += 1
          continue
        }

        if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
          blocks.push(h('hr', { key: nextKey() }))
          i += 1
          continue
        }

        if (/^\s{0,3}>/.test(line)) {
          const body = []
          while (i < lines.length && /^\s{0,3}>/.test(lines[i])) {
            // Strip every marker of this line at once: nested quotes flatten,
            // and the recursion below can never run once per ">" (#3).
            body.push(lines[i].replace(/^\s{0,3}(>\s?)+/, ''))
            i += 1
          }
          blocks.push(
            depth < 4
              ? h('blockquote', { key: nextKey() }, renderMarkdown(body.join('\n'), depth + 1))
              : h('blockquote', { key: nextKey() }, h('p', null, body.join('\n'))),
          )
          continue
        }

        if (listItem(line)) {
          const items = []
          // Same list while the indent is deeper (a nested item) or the marker
          // kind matches; a "1." right after a "-" list starts a new list.
          const sameList = (candidate) =>
            !items.length || candidate.indent > items[0].indent || candidate.ordered === items[0].ordered
          while (i < lines.length) {
            const item = listItem(lines[i])
            if (item) {
              if (!sameList(item)) break
              items.push(item)
              i += 1
              continue
            }
            if (!lines[i].trim()) {
              const next = lines[i + 1] ? listItem(lines[i + 1]) : null
              if (next && sameList(next)) {
                i += 1
                continue
              }
              break
            }
            if (items.length) items[items.length - 1].text += ` ${lines[i].trim()}`
            i += 1
          }
          blocks.push(renderList(items, nextKey))
          continue
        }

        const body = []
        while (i < lines.length && lines[i].trim() && !listItem(lines[i]) && !BLOCK_START.test(lines[i])) {
          body.push(lines[i])
          i += 1
        }
        if (!body.length) {
          body.push(lines[i])
          i += 1
        }
        const paragraph = body.join('\n')
        blocks.push(
          h(
            'p',
            { key: nextKey() },
            // One enormous line would make the inline scan expensive; show it as
            // plain text instead of formatting it.
            paragraph.length > 20000 ? paragraph : renderInline(paragraph, `p${counter}`),
          ),
        )
      }
      return blocks
    }

    // --------------------------------------------------------------- apply

    function apply(ctx) {
      let lang = /^zh\b/i.test(navigator.language) ? 'zh' : 'en'
      const listeners = new Set()
      const setLang = (next) => {
        if (next === lang) return
        lang = next
        for (const listener of [...listeners]) listener(next)
      }
      const t = (key, values) => fill((DICT[lang] || DICT.zh)[key] ?? DICT.zh[key] ?? key, values)

      ctx.effect(() => {
        const style = document.createElement('style')
        style.dataset.pluginCss = 'dsh-link-library/link-library.css'
        style.textContent = CSS
        document.head.appendChild(style)
        return () => style.remove()
      }, 'dsh-link-library: styles')

      ctx.inject(['locale'], (scope) => {
        const push = (snapshot) => {
          const active = snapshot && snapshot.active
          setLang(active === 'zh' ? 'zh' : 'en')
        }
        try {
          push(scope.locale.getSnapshot())
        } catch {
          /* keep the browser-language default */
        }
        scope.on('locale/change', push)
      })

      function useLang() {
        const [, bump] = React.useState(lang)
        React.useEffect(() => {
          const listener = () => bump(lang)
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        }, [])
        return lang
      }

      // ------------------------------------------------------------ data

      async function readBody(response) {
        try {
          return await response.json()
        } catch {
          return null
        }
      }

      async function callList() {
        const response = await fetch(API, { cache: 'no-store' })
        const body = await readBody(response)
        if (!response.ok || !body || body.ok === false) {
          throw new Error((body && body.error) || `HTTP ${response.status}`)
        }
        return body
      }

      async function callAct(action, payload) {
        const response = await fetch(ACT, {
          method: 'POST',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, ...(payload || {}) }),
        })
        const body = await readBody(response)
        if (!response.ok || !body || body.ok === false) {
          throw new Error((body && body.error) || `HTTP ${response.status}`)
        }
        return body
      }

      async function copyText(text) {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text)
          return
        }
        throw new Error(t('link.toast.copyFailed', { url: text }))
      }

      const when = (iso) => {
        const at = Date.parse(String(iso || ''))
        if (!Number.isFinite(at)) return ''
        const delta = Date.now() - at
        const minute = 60000
        const hour = 60 * minute
        const day = 24 * hour
        if (delta < minute) return t('when.now')
        if (delta < hour) return t('when.minutes', { n: Math.round(delta / minute) })
        if (delta < day) return t('when.hours', { n: Math.round(delta / hour) })
        if (delta < 7 * day) return t('when.days', { n: Math.round(delta / day) })
        try {
          return new Date(at).toLocaleDateString(lang === 'en' ? 'en' : 'zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        } catch {
          return new Date(at).toISOString().slice(0, 10)
        }
      }

      const upsertBy = (list, next) => {
        const index = list.findIndex((entry) => entry.id === next.id)
        if (index < 0) return [next, ...list]
        const copy = list.slice()
        copy[index] = { ...copy[index], ...next }
        return copy
      }

      /** Keeps the body in the list: reopening an article must never lose text. */
      function entryOf(article) {
        return {
          ...article,
          body: typeof article.body === 'string' ? article.body : '',
          excerpt: article.excerpt ?? '',
          chars: article.chars ?? String(article.body || '').length,
        }
      }

      const orderTodos = (todos) => {
        const open = todos.filter((todo) => !todo.done).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        const done = todos
          .filter((todo) => todo.done)
          .sort((a, b) => String(b.doneAt || b.updatedAt).localeCompare(String(a.doneAt || a.updatedAt)))
        return [...open, ...done]
      }

      // ------------------------------------------------------------ shell

      function ShelfPage() {
        useLang()
        const [tab, setTab] = React.useState('links')
        const [status, setStatus] = React.useState('loading')
        const [error, setError] = React.useState('')
        const [links, setLinks] = React.useState([])
        const [todos, setTodos] = React.useState([])
        const [articles, setArticles] = React.useState([])
        const [notice, setNotice] = React.useState(null)
        const [stale, setStale] = React.useState(false)
        const [everLoaded, setEverLoaded] = React.useState(false)
        const alive = React.useRef(true)

        const notify = React.useCallback((kind, text, undo) => {
          setNotice({ kind, text, undo })
        }, [])

        React.useEffect(() => {
          alive.current = true
          return () => {
            alive.current = false
          }
        }, [])

        const load = React.useCallback(async (quiet = false) => {
          try {
            const body = await callList()
            if (!alive.current) return
            setLinks(Array.isArray(body.links) ? body.links : [])
            setTodos(Array.isArray(body.todos) ? body.todos : [])
            setArticles(Array.isArray(body.articles) ? body.articles : [])
            setStale(!Array.isArray(body.todos))
            setEverLoaded(true)
            setError('')
            setStatus('ready')
            if (typeof body.warning === 'string' && body.warning) {
              setNotice({ kind: 'error', text: t('toast.salvaged', { path: body.warning }) })
            }
          } catch (failure) {
            if (!alive.current) return
            const message = failure.message || String(failure)
            if (quiet) setNotice({ kind: 'error', text: message })
            else {
              setError(message)
              setStatus('error')
            }
          }
        }, [])

        React.useEffect(() => {
          void load()
        }, [load])

        React.useEffect(() => {
          const refresh = () => {
            if (document.visibilityState === 'visible') void load(true)
          }
          document.addEventListener('visibilitychange', refresh)
          window.addEventListener('focus', refresh)
          return () => {
            document.removeEventListener('visibilitychange', refresh)
            window.removeEventListener('focus', refresh)
          }
        }, [load])

        React.useEffect(() => {
          if (!notice) return undefined
          const timer = setTimeout(() => setNotice(null), notice.undo ? 9000 : 3600)
          return () => clearTimeout(timer)
        }, [notice])

        const linkCounts = React.useMemo(() => {
          let unread = 0
          for (const link of links) if (link.status === 'unread') unread += 1
          return { all: links.length, unread, read: links.length - unread }
        }, [links])

        const todoCounts = React.useMemo(() => {
          let done = 0
          for (const todo of todos) if (todo.done) done += 1
          return { all: todos.length, open: todos.length - done, done }
        }, [todos])

        const navButton = (key, label, count) =>
          h(
            'button',
            {
              type: 'button',
              className: 'll-navtab',
              'aria-pressed': tab === key,
              onClick: () => setTab(key),
            },
            h('span', null, label),
            h('span', { className: 'll-navcount' }, String(count)),
          )

        const panel = (key, children) =>
          h('div', { key, style: tab === key ? undefined : { display: 'none' } }, children)

        return h(
          'div',
          { className: 'll-page' },
          h(
            'div',
            { className: 'll-scroll' },
            h(
              'div',
              { className: 'll-content' },
              h(
                'header',
                { className: 'll-heading' },
                h(
                  'div',
                  null,
                  h('h1', null, t('title')),
                  h('p', { className: 'll-sub' }, t('subtitle')),
                ),
                h(
                  'div',
                  { className: 'll-heading-tools' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'll-icon',
                      title: t('refresh'),
                      'aria-label': t('refresh'),
                      onClick: () => {
                        setStatus('loading')
                        void load()
                      },
                    },
                    h(RefreshIcon),
                  ),
                ),
              ),
              h(
                'nav',
                { className: 'll-nav', role: 'group' },
                navButton('links', t('tab.links'), linkCounts.all),
                navButton('todos', t('tab.todos'), todoCounts.open),
                navButton('articles', t('tab.articles'), articles.length),
              ),
              stale
                ? h(
                    'div',
                    { className: 'll-warn', role: 'status' },
                    h('span', null, t('stale.banner')),
                  )
                : null,
              notice
                ? h(
                    'div',
                    { className: 'll-notice', 'data-kind': notice.kind, role: 'status' },
                    h('span', { className: 'll-notice-text' }, notice.text),
                    notice.undo
                      ? h(
                          'button',
                          {
                            type: 'button',
                            className: 'll-undo',
                            onClick: () => void notice.undo.run(),
                          },
                          t('undo'),
                        )
                      : null,
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'll-notice-close',
                        'aria-label': t('dismiss'),
                        onClick: () => setNotice(null),
                      },
                      '×',
                    ),
                  )
                : null,
              // The panels stay mounted across refreshes: unmounting them would
              // close the article editor and drop its unsaved text (#5).
              !everLoaded && status === 'loading' ? h('p', { className: 'll-empty' }, t('loading')) : null,
              status === 'error'
                ? h(
                    'div',
                    { className: 'll-error', role: 'alert' },
                    h('span', null, t('error.load', { message: error })),
                    h('button', { type: 'button', onClick: () => void load() }, t('retry')),
                  )
                : null,
              everLoaded
                ? [
                    panel('links', h(LinksTab, { links, setLinks, notify })),
                    panel(
                      'todos',
                      stale ? h('p', { className: 'll-empty' }, t('stale.banner')) : h(TodosTab, { todos, setTodos, notify }),
                    ),
                    panel(
                      'articles',
                      stale
                        ? h('p', { className: 'll-empty' }, t('stale.banner'))
                        : h(ArticlesTab, { articles, setArticles, notify }),
                    ),
                  ]
                : null,
            ),
          ),
        )
      }

      // ------------------------------------------------------------ links

      function LinksTab(props) {
        useLang()
        const { links, setLinks, notify } = props
        const [filter, setFilter] = React.useState('all')
        const [query, setQuery] = React.useState('')
        const [draft, setDraft] = React.useState('')
        const [busy, setBusy] = React.useState(false)

        const counts = React.useMemo(() => {
          let unread = 0
          for (const link of links) if (link.status === 'unread') unread += 1
          return { all: links.length, unread, read: links.length - unread }
        }, [links])

        const visible = React.useMemo(() => {
          const needle = query.trim().toLowerCase()
          return links.filter((link) => {
            if (filter === 'unread' && link.status !== 'unread') return false
            if (filter === 'read' && link.status !== 'read') return false
            if (!needle) return true
            return [link.title, link.url, link.note, link.host].some(
              (field) => typeof field === 'string' && field.toLowerCase().includes(needle),
            )
          })
        }, [links, filter, query])

        const submit = async (event) => {
          if (event) event.preventDefault()
          const url = draft.trim()
          if (!url || busy) return
          setBusy(true)
          try {
            const body = await callAct('add', { url, source: 'ui' })
            setLinks((current) => upsertBy(current, body.link))
            setDraft('')
            notify('ok', body.duplicate ? t('link.toast.duplicate') : t('link.toast.added'))
          } catch (failure) {
            notify('error', failure.message || String(failure))
          } finally {
            setBusy(false)
          }
        }

        const toggle = async (link) => {
          try {
            const body = await callAct('update', { id: link.id, status: link.status === 'read' ? 'unread' : 'read' })
            setLinks((current) => upsertBy(current, body.link))
          } catch (failure) {
            notify('error', failure.message || String(failure))
          }
        }

        const remove = async (link) => {
          try {
            const body = await callAct('remove', { id: link.id })
            setLinks((current) => current.filter((entry) => entry.id !== link.id))
            notify('ok', t('link.toast.removed'), {
              run: async () => {
                const restored = await callAct('restore', { link: body.removed })
                setLinks((current) => upsertBy(current, restored.link))
                notify('ok', t('link.toast.restored'))
              },
            })
          } catch (failure) {
            notify('error', failure.message || String(failure))
          }
        }

        const open = async (link, event) => {
          const plain = !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
          if (!plain) return
          event.preventDefault()
          try {
            const body = await callAct('open', { id: link.id })
            if (body.link) setLinks((current) => upsertBy(current, body.link))
          } catch (failure) {
            const message = failure.message || String(failure)
            try {
              await copyText(link.url)
              notify('error', t('link.toast.openFailedCopied', { message }))
            } catch {
              notify('error', t('link.toast.openFailed', { message }))
            }
          }
        }

        const copy = async (link) => {
          try {
            await copyText(link.url)
            notify('ok', t('link.toast.copied'))
          } catch (failure) {
            notify('error', failure.message || String(failure))
          }
        }

        const tab = (key, label) =>
          h(
            'button',
            { type: 'button', className: 'll-tab', 'aria-pressed': filter === key, onClick: () => setFilter(key) },
            label,
          )

        const body = () => {
          if (visible.length === 0) {
            return h('p', { className: 'll-empty' }, links.length === 0 ? t('link.empty') : t('link.emptyFilter'))
          }
          return h(
            'ul',
            { className: 'll-list' },
            visible.map((link) =>
              h(
                'li',
                { key: link.id, className: 'll-row', 'data-read': link.status === 'read' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'll-check',
                    'aria-pressed': link.status === 'read',
                    title: link.status === 'read' ? t('link.markUnread') : t('link.markRead'),
                    'aria-label': link.status === 'read' ? t('link.markUnread') : t('link.markRead'),
                    onClick: () => void toggle(link),
                  },
                  link.status === 'read' ? h(CheckIcon) : null,
                ),
                h(
                  'div',
                  { className: 'll-body' },
                  h(
                    'a',
                    {
                      className: 'll-link',
                      href: /^https?:\/\//i.test(link.url) ? link.url : undefined,
                      target: '_blank',
                      rel: 'noopener noreferrer',
                      onClick: (event) => void open(link, event),
                    },
                    link.title || link.url,
                  ),
                  h(
                    'div',
                    { className: 'll-meta' },
                    h('span', null, link.host || ''),
                    h('span', null, '·'),
                    h('span', null, t('link.added', { when: when(link.createdAt) })),
                    link.note ? h('span', { className: 'll-note' }, link.note) : null,
                  ),
                ),
                h(
                  'div',
                  { className: 'll-actions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'll-icon',
                      title: t('link.copy'),
                      'aria-label': t('link.copy'),
                      onClick: () => void copy(link),
                    },
                    h(CopyIcon),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'll-icon ll-danger',
                      title: t('link.remove'),
                      'aria-label': t('link.remove'),
                      onClick: () => void remove(link),
                    },
                    h(TrashIcon),
                  ),
                ),
              ),
            ),
          )
        }

        return h(
          'div',
          { className: 'll-panel' },
          h(
            'form',
            { className: 'll-add', onSubmit: submit },
            h('input', {
              className: 'll-add-input',
              type: 'text',
              value: draft,
              placeholder: t('link.add'),
              'aria-label': t('link.add'),
              spellCheck: false,
              autoComplete: 'off',
              onChange: (event) => setDraft(event.target.value),
            }),
            h(
              'button',
              { className: 'll-add-button', type: 'submit', disabled: busy || draft.trim() === '' },
              busy ? t('link.adding') : t('link.addBtn'),
            ),
          ),
          h(
            'div',
            { className: 'll-toolbar' },
            h(
              'div',
              { className: 'll-tabs', role: 'group' },
              tab('all', t('link.all', { n: counts.all })),
              tab('unread', t('link.unread', { u: counts.unread })),
              tab('read', t('link.read', { n: counts.read })),
            ),
            h(
              'label',
              { className: 'll-search' },
              h(SearchIcon),
              h('input', {
                type: 'search',
                value: query,
                placeholder: t('link.search'),
                'aria-label': t('link.search'),
                onChange: (event) => setQuery(event.target.value),
              }),
            ),
          ),
          body(),
        )
      }

      // ------------------------------------------------------------ todos

      function TodosTab(props) {
        useLang()
        const { todos, setTodos, notify } = props
        const [filter, setFilter] = React.useState('all')
        const [query, setQuery] = React.useState('')
        const [draft, setDraft] = React.useState('')
        const [busy, setBusy] = React.useState(false)
        const [editingId, setEditingId] = React.useState(null)
        const [editingText, setEditingText] = React.useState('')
        const escaped = React.useRef(false)

        const counts = React.useMemo(() => {
          let done = 0
          for (const todo of todos) if (todo.done) done += 1
          return { all: todos.length, open: todos.length - done, done }
        }, [todos])

        const visible = React.useMemo(() => {
          const needle = query.trim().toLowerCase()
          const filtered = todos.filter((todo) => {
            if (filter === 'open' && todo.done) return false
            if (filter === 'done' && !todo.done) return false
            if (!needle) return true
            return todo.text.toLowerCase().includes(needle)
          })
          return orderTodos(filtered)
        }, [todos, filter, query])

        const submit = async (event) => {
          if (event) event.preventDefault()
          const text = draft.trim()
          if (!text || busy) return
          setBusy(true)
          try {
            const body = await callAct('todo.add', { text })
            setTodos((current) => upsertBy(current, body.todo))
            setDraft('')
            notify('ok', body.duplicate ? t('todo.toast.duplicate') : t('todo.toast.added'))
          } catch (failure) {
            notify('error', failure.message || String(failure))
          } finally {
            setBusy(false)
          }
        }

        const toggle = async (todo) => {
          try {
            const body = await callAct('todo.update', { id: todo.id, status: todo.done ? 'open' : 'done' })
            setTodos((current) => upsertBy(current, body.todo))
          } catch (failure) {
            notify('error', failure.message || String(failure))
          }
        }

        const remove = async (todo) => {
          try {
            const body = await callAct('todo.remove', { id: todo.id })
            setTodos((current) => current.filter((entry) => entry.id !== todo.id))
            notify('ok', t('todo.toast.removed'), {
              run: async () => {
                const restored = await callAct('todo.restore', { todo: body.removed })
                setTodos((current) => upsertBy(current, restored.todo))
                notify('ok', t('todo.toast.restored'))
              },
            })
          } catch (failure) {
            notify('error', failure.message || String(failure))
          }
        }

        const startEdit = (todo) => {
          escaped.current = false
          setEditingText(todo.text)
          setEditingId(todo.id)
        }

        const commitEdit = async () => {
          if (escaped.current) return
          const id = editingId
          const text = editingText.trim()
          setEditingId(null)
          if (!id || !text) return
          const existing = todos.find((todo) => todo.id === id)
          if (!existing || existing.text === text) return
          try {
            const body = await callAct('todo.update', { id, text })
            setTodos((current) => upsertBy(current, body.todo))
          } catch (failure) {
            notify('error', failure.message || String(failure))
          }
        }

        const tab = (key, label) =>
          h(
            'button',
            { type: 'button', className: 'll-tab', 'aria-pressed': filter === key, onClick: () => setFilter(key) },
            label,
          )

        const body = () => {
          if (visible.length === 0) {
            return h('p', { className: 'll-empty' }, todos.length === 0 ? t('todo.empty') : t('todo.emptyFilter'))
          }
          return h(
            'ul',
            { className: 'll-list' },
            visible.map((todo) =>
              h(
                'li',
                { key: todo.id, className: 'll-row', 'data-done': todo.done },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'll-check',
                    'aria-pressed': todo.done,
                    title: todo.done ? t('todo.markOpen') : t('todo.markDone'),
                    'aria-label': todo.done ? t('todo.markOpen') : t('todo.markDone'),
                    onClick: () => void toggle(todo),
                  },
                  todo.done ? h(CheckIcon) : null,
                ),
                h(
                  'div',
                  { className: 'll-body' },
                  editingId === todo.id
                    ? h('input', {
                        className: 'll-todo-edit',
                        value: editingText,
                        autoFocus: true,
                        onChange: (event) => setEditingText(event.target.value),
                        onBlur: () => void commitEdit(),
                        onKeyDown: (event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void commitEdit()
                          } else if (event.key === 'Escape') {
                            escaped.current = true
                            setEditingId(null)
                          }
                        },
                      })
                    : h(
                        'button',
                        {
                          type: 'button',
                          className: 'll-todo-text',
                          title: t('todo.edit'),
                          onClick: () => startEdit(todo),
                        },
                        todo.text,
                      ),
                  h(
                    'div',
                    { className: 'll-meta' },
                    h(
                      'span',
                      null,
                      todo.done && todo.doneAt
                        ? t('todo.doneAt', { when: when(todo.doneAt) })
                        : t('todo.added', { when: when(todo.createdAt) }),
                    ),
                    h('span', null, '·'),
                    h('span', null, todo.done ? t('todo.doneLabel') : t('todo.openLabel')),
                  ),
                ),
                h(
                  'div',
                  { className: 'll-actions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'll-icon',
                      title: t('todo.remove'),
                      'aria-label': t('todo.remove'),
                      onClick: () => void remove(todo),
                    },
                    h(TrashIcon),
                  ),
                ),
              ),
            ),
          )
        }

        return h(
          'div',
          { className: 'll-panel' },
          h(
            'form',
            { className: 'll-add', onSubmit: submit },
            h('input', {
              className: 'll-add-input',
              type: 'text',
              value: draft,
              placeholder: t('todo.add'),
              'aria-label': t('todo.add'),
              autoComplete: 'off',
              onChange: (event) => setDraft(event.target.value),
            }),
            h(
              'button',
              { className: 'll-add-button', type: 'submit', disabled: busy || draft.trim() === '' },
              busy ? t('todo.adding') : t('todo.addBtn'),
            ),
          ),
          h(
            'div',
            { className: 'll-toolbar' },
            h(
              'div',
              { className: 'll-tabs', role: 'group' },
              tab('all', t('todo.all', { n: counts.all })),
              tab('open', t('todo.open', { o: counts.open })),
              tab('done', t('todo.done', { d: counts.done })),
            ),
            h(
              'label',
              { className: 'll-search' },
              h(SearchIcon),
              h('input', {
                type: 'search',
                value: query,
                placeholder: t('todo.search'),
                'aria-label': t('todo.search'),
                onChange: (event) => setQuery(event.target.value),
              }),
            ),
          ),
          body(),
        )
      }

      // --------------------------------------------------------- articles

      function ArticlesTab(props) {
        useLang()
        const { articles, setArticles, notify } = props
        const [query, setQuery] = React.useState('')
        const [draft, setDraft] = React.useState(null)
        const [view, setView] = React.useState('edit')
        const [dirty, setDirty] = React.useState(false)
        const [saving, setSaving] = React.useState(false)
        const [savedOnce, setSavedOnce] = React.useState(false)
        const draftRef = React.useRef(null)
        const dirtyRef = React.useRef(false)
        const versionRef = React.useRef(0)
        const goneRef = React.useRef(new Set())

        draftRef.current = draft
        dirtyRef.current = dirty

        const visible = React.useMemo(() => {
          const needle = query.trim().toLowerCase()
          if (!needle) return articles
          return articles.filter(
            (article) =>
              String(article.title || '').toLowerCase().includes(needle) ||
              String(article.excerpt || '').toLowerCase().includes(needle) ||
              String(article.body || '').toLowerCase().includes(needle),
          )
        }, [articles, query])

        const persist = React.useCallback(
          async (current) => {
            if (!current) return true
            const version = versionRef.current
            setSaving(true)
            try {
              const body = await callAct('article.update', {
                id: current.id,
                title: current.title,
                body: current.body,
                mode: 'replace',
              })
              // Only this save's content is confirmed; text typed while the
              // request was in flight keeps the draft dirty for the next save.
              if (versionRef.current === version) {
                setDirty(false)
                setSavedOnce(true)
                // Store exactly what this save wrote, so reopening the editor
                // shows the same text (#1) and an older response cannot win (#6).
                setArticles((list) => upsertBy(list, { ...entryOf(body.article), body: current.body }))
              }
              return true
            } catch (failure) {
              if (!goneRef.current.has(current.id)) notify('error', failure.message || String(failure))
              return false
            } finally {
              setSaving(false)
            }
          },
          [setArticles, notify],
        )

        // Debounced auto-save while the draft is dirty.
        React.useEffect(() => {
          if (!draft || !dirty) return undefined
          const timer = setTimeout(() => {
            void persist(draftRef.current)
          }, 700)
          return () => clearTimeout(timer)
        }, [draft, dirty, persist])

        // Flush an unsaved draft when the tab unmounts.
        React.useEffect(
          () => () => {
            if (dirtyRef.current && draftRef.current) void persist(draftRef.current)
          },
          [persist],
        )

        // A page that is being closed or hidden cannot await a fetch; a beacon
        // is the only transport that still lands.
        React.useEffect(() => {
          const flush = () => {
            const current = draftRef.current
            if (!dirtyRef.current || !current) return
            try {
              const payload = JSON.stringify({
                action: 'article.update',
                id: current.id,
                title: current.title,
                body: current.body,
                mode: 'replace',
              })
              navigator.sendBeacon(ACT, new Blob([payload], { type: 'application/json' }))
            } catch {
              /* nothing else can be done while the page is going away */
            }
          }
          const onVisibility = () => {
            if (document.visibilityState === 'hidden') flush()
          }
          window.addEventListener('pagehide', flush)
          document.addEventListener('visibilitychange', onVisibility)
          return () => {
            window.removeEventListener('pagehide', flush)
            document.removeEventListener('visibilitychange', onVisibility)
          }
        }, [])

        const openArticle = async (article) => {
          let full = article
          if (typeof full.body !== 'string') {
            // Defensive: an older host may list articles without bodies.
            try {
              const body = await callAct('article.get', { id: article.id, limit: 60000 })
              full = body.article
            } catch (failure) {
              notify('error', failure.message || String(failure))
              return
            }
          }
          versionRef.current += 1
          setDraft({ id: full.id, title: full.title || '', body: full.body || '' })
          setDirty(false)
          setSavedOnce(false)
          setView('edit')
        }

        const closeArticle = async () => {
          const snapshot = draftRef.current
          if (dirtyRef.current && snapshot) {
            const saved = await persist(snapshot)
            // Never throw away text: keep the editor open if the save failed,
            // and stay if the user kept typing while it was in flight (#2).
            if (!saved) return
            if (draftRef.current !== snapshot) return
          }
          setDraft(null)
          setDirty(false)
        }

        const updateDraft = (patch) => {
          versionRef.current += 1
          setDraft((current) => (current ? { ...current, ...patch } : current))
          setDirty(true)
        }

        const create = async () => {
          if (dirtyRef.current && draftRef.current) {
            const saved = await persist(draftRef.current)
            if (!saved) return
          }
          try {
            const body = await callAct('article.create', { body: '' })
            setArticles((list) => upsertBy(list, entryOf(body.article)))
            await openArticle(body.article)
            notify('ok', t('article.toast.created'))
          } catch (failure) {
            notify('error', failure.message || String(failure))
          }
        }

        const remove = async (article) => {
          try {
            goneRef.current.add(article.id)
            versionRef.current += 1
            const body = await callAct('article.remove', { id: article.id })
            setArticles((list) => list.filter((entry) => entry.id !== article.id))
            if (draft && draft.id === article.id) {
              setDraft(null)
              setDirty(false)
            }
            notify('ok', t('article.toast.removed'), {
              run: async () => {
                const restored = await callAct('article.restore', { article: body.removed })
                goneRef.current.delete(restored.article.id)
                setArticles((list) => upsertBy(list, entryOf(restored.article)))
                notify('ok', t('article.toast.restored'))
              },
            })
          } catch (failure) {
            notify('error', failure.message || String(failure))
          }
        }

        if (draft) {
          return h(
            'div',
            { className: 'll-editor' },
            h(
              'div',
              { className: 'll-editor-bar' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'll-icon',
                  title: t('article.back'),
                  'aria-label': t('article.back'),
                  onClick: () => void closeArticle(),
                },
                h(BackIcon),
              ),
              h('input', {
                className: 'll-editor-title',
                value: draft.title,
                placeholder: t('article.titlePlaceholder'),
                'aria-label': t('article.titlePlaceholder'),
                onChange: (event) => updateDraft({ title: event.target.value }),
              }),
              h('span', { className: 'll-save' }, saving ? t('article.saving') : dirty ? t('article.unsaved') : savedOnce ? t('article.saved') : ''),
              h(
                'div',
                { className: 'll-editor-tools' },
                h(
                  'div',
                  { className: 'll-tabs', role: 'group' },
                  h(
                    'button',
                    { type: 'button', className: 'll-tab', 'aria-pressed': view === 'edit', onClick: () => setView('edit') },
                    t('article.edit'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'll-tab',
                      'aria-pressed': view === 'preview',
                      onClick: () => setView('preview'),
                    },
                    t('article.preview'),
                  ),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'll-icon ll-danger',
                    title: t('article.remove'),
                    'aria-label': t('article.remove'),
                    onClick: () => void remove(draft),
                  },
                  h(TrashIcon),
                ),
              ),
            ),
            view === 'edit'
              ? h('textarea', {
                  className: 'll-editor-body',
                  value: draft.body,
                  placeholder: t('article.bodyPlaceholder'),
                  spellCheck: false,
                  onChange: (event) => updateDraft({ body: event.target.value }),
                })
              : h(
                  'div',
                  { className: 'll-editor-preview' },
                  draft.body.trim()
                    ? h('div', { className: 'md' }, renderMarkdown(draft.body))
                    : h('p', { className: 'll-empty' }, t('article.emptyPreview')),
                ),
            h('div', { className: 'll-editor-foot' }, t('article.foot', { n: draft.body.length })),
          )
        }

        return h(
          'div',
          { className: 'll-panel' },
          h(
            'div',
            { className: 'll-toolbar', style: { marginTop: '4px' } },
            h(
              'button',
              { type: 'button', className: 'll-new', onClick: () => void create() },
              h(PlusIcon),
              t('article.new'),
            ),
            h(
              'label',
              { className: 'll-search' },
              h(SearchIcon),
              h('input', {
                type: 'search',
                value: query,
                placeholder: t('article.search'),
                'aria-label': t('article.search'),
                onChange: (event) => setQuery(event.target.value),
              }),
            ),
          ),
          visible.length === 0
            ? h('p', { className: 'll-empty' }, articles.length === 0 ? t('article.empty') : t('article.emptyFilter'))
            : h(
                'ul',
                { className: 'll-art' },
                visible.map((article) =>
                  h(
                    'li',
                    { key: article.id, className: 'll-art-row' },
                    h(
                      'button',
                      { type: 'button', className: 'll-art-open', onClick: () => openArticle(article) },
                      h('div', { className: 'll-art-title' }, article.title || t('article.untitled')),
                      h(
                        'div',
                        { className: 'll-meta' },
                        h('span', null, t('article.chars', { n: article.chars ?? 0 })),
                        h('span', null, '·'),
                        h('span', null, t('article.updated', { when: when(article.updatedAt) })),
                      ),
                      article.excerpt ? h('div', { className: 'll-art-excerpt' }, article.excerpt) : null,
                    ),
                    h(
                      'div',
                      { className: 'll-actions' },
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'll-icon ll-danger',
                          title: t('article.remove'),
                          'aria-label': t('article.remove'),
                          onClick: () => void remove(article),
                        },
                        h(TrashIcon),
                      ),
                    ),
                  ),
                ),
              ),
        )
      }

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register({ name: 'sidebar.panellist', id: PANEL, order: 30, label: () => t('panel') }, ShelfIcon),
      )
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL }, ShelfPage))
    }

    return { inject: ['slots'], apply }
  },
})
