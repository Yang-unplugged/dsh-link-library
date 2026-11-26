# dsh-link-library · 链接与笔记

一个 DeepSeek Harness 插件：左侧栏的「链接与笔记」面板，把**看过的链接**、**待办**、**Markdown 文章**放在一起。
三件事都能在对话里让我帮你加，也能在面板里自己写。

## 三个标签页

### 链接
- 在对话里发一个网址，或者说「记一下 / 收藏 / 稍后看 / 待看这个链接」，Agent 会存进来（知道页面讲什么会补标题，你说了为什么收藏就记成备注）。
- 面板顶部粘贴网址回车也能收藏；抓不到标题就显示网址。
- 点标题 → 系统浏览器打开，并自动标成「已看」（⌘/Ctrl 点是原生新标签页，不改状态）。
- 全部 / 待看 / 已看筛选 + 搜索；左侧圆圈切换状态；悬停有复制和删除（删除可撤销）。

### 待办
- 对话里说「加个待办：把 X 做完」「提醒我做 X」，或者面板顶部直接写一条回车。
- 点圆圈标完成 / 改回未完成；点文字可以直接改；未完成的排前面，完成的沉到下面并划线。
- 全部 / 未完成 / 已完成筛选 + 搜索；删除可撤销。

### 文章（Markdown）
- 点「新建文章」开始写，或者在对话里说「把这个整理成一篇文章」，Agent 会调用 `article` 工具写进来。
- 正文是 Markdown，编辑器里有「编辑 / 预览」切换，**边写边自动保存**（停手约 0.7 秒后保存，离开面板/切文章也会先保存）。
- 支持：`#` 标题、`-` / `1.` 列表（可嵌套）、`**粗体**`、`*斜体*`、`` `代码` ``、三个反引号代码块、`>` 引用、`[文字](网址)`、`---` 分隔线。渲染是按 React 元素拼的，不走 `innerHTML`，也没有外链图片自动加载。
- 文章列表显示标题、字数、更新时间、正文摘要；删除可撤销。

## 数据放在哪

```
$DSH_HOME/link-library/library.json     # 默认 ~/.dsh/link-library/library.json
```

一个普通 JSON 文件，里面三张表：`links` / `todos` / `articles`，可以直接备份。

升级说明：v1 只有 `links.json`。插件第一次读写时会自动把里面的链接带进 `library.json`，
**旧的 `links.json` 原样留着不动**（等于一份自动备份）。文件读不出来也不会被覆盖：会改名为
`library.json.broken-<时间戳>`，然后在面板顶部提示你。

## 装

```sh
dsh plugin --profile desktop add <这个目录的绝对路径>
```

也可以在 Harness 里用插件管理器安装这个本地目录。装好后左侧栏出现「链接与笔记」图标。

## 配置（可选）

在 `cordis.patch.yml` 里覆盖这一行的 `config`：

```yaml
- id: link-library
  name: dsh-link-library
  config:
    fetchTitle: true      # 收藏链接时抓一次页面标题；设 false 就只用网址
    dataDir: ''           # 换目录，默认 $DSH_HOME/link-library
    promptGuidance: true  # 设 false：系统提示里不再写「个人记录」那段说明，工具 description 照旧
```

## 边界

- 链接只收 `http` / `https`；其它协议直接拒绝，也不会拼进 shell。
- 打开链接走系统默认浏览器（macOS `open` / Linux `xdg-open` / Windows `rundll32`，不经 `cmd`）。
- 文章正文上限 20 万字，标题 200 字，待办 500 字。
- Markdown 是常用子集的渲染器，不支持表格和 HTML 内嵌。
