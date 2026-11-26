/**
 * dsh-link-library — Host half.
 *
 * One JSON file under `$DSH_HOME/link-library/library.json` holds the user's
 * shelf: links (read later), todos, and Markdown articles. The Client page and
 * the three agent tools share one implementation, reached through `act()`.
 *
 * Routes (authenticated, mounted by `ctx.connection.fetch`):
 *   GET  /api/link-library        → { ok, links, todos, articles, counts, warning }
 *   POST /api/link-library.act    → { ok, message, ... }  (body.action selects it)
 *
 * Storage version 2 adds `todos` and `articles`. A version-1 `links.json` is
 * read once and carried over on the next write; the old file is never touched.
 */
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync, writeSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const PLUGIN = 'dsh-link-library'
const ROUTE = '/api/link-library'
const ACT_ROUTE = `${ROUTE}.act`

const TITLE_MAX = 200
const NOTE_MAX = 500
const TODO_MAX = 500
const ARTICLE_BODY_MAX = 200_000
const TITLE_TIMEOUT_MS = 6000
const LIST_LIMIT_DEFAULT = 30
const LIST_LIMIT_MAX = 200
const EXCERPT_MAX = 160
const ARTICLE_GET_DEFAULT = 12000
const ARTICLE_GET_MAX = 60000

const DEFAULTS = {
  /** Best-effort page title for a link saved without one. */
  fetchTitle: true,
  /** Directory holding library.json; empty means `$DSH_HOME/link-library`. */
  dataDir: '',
}

/** @type {{ fetchTitle: boolean, dataDir: string }} */
let config = { ...DEFAULTS }
/** @type {any} */
let logger
/** Set by `apply`; used to resolve the optional `web` service lazily. */
/** @type {(() => any) | undefined} */
let getWeb
/** Damaged store moved aside; reported to the page once so the user knows. */
/** @type {string | null} */
let pendingSalvage = null

// ---------------------------------------------------------------- storage

function dshHome() {
  const fromEnv = process.env.DSH_HOME?.trim()
  return fromEnv ? fromEnv : join(homedir(), '.dsh')
}

function dataDir() {
  const configured = typeof config.dataDir === 'string' ? config.dataDir.trim() : ''
  return configured || join(dshHome(), 'link-library')
}

function statePath() {
  return join(dataDir(), 'library.json')
}

/** Version-1 store: only `links`, read once so nothing is lost on upgrade. */
function legacyStatePath() {
  return join(dataDir(), 'links.json')
}

function emptyState() {
  return { version: 2, links: [], todos: [], articles: [] }
}

function asText(value, max) {
  if (typeof value !== 'string') return ''
  const text = value.trim().replace(/\s+/g, ' ')
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** Accepts `example.com/x` and `localhost:3000/x` as well as a full URL; only http(s) is kept. */
function normalizeUrl(raw) {
  const text = String(raw ?? '').trim()
  if (!text) throw new Error('需要一个网址')
  let candidate = text
  const scheme = text.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):([\s\S]*)$/)
  if (scheme) {
    const name = scheme[1].toLowerCase()
    if (name === 'http' || name === 'https') candidate = text
    else if (/^\d+(\/|$|\?|#)/.test(scheme[2])) candidate = `https://${text}` // localhost:3000/x
    else throw new Error('只收藏 http / https 链接')
  } else if (text.startsWith('//')) {
    candidate = `https:${text}`
  } else {
    candidate = `https://${text}`
  }
  let url
  try {
    url = new URL(candidate)
  } catch {
    throw new Error(`这不是一个有效的网址：${text}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('只收藏 http / https 链接')
  }
  // Never keep credentials: the URL is echoed into the model context and the UI.
  url.username = ''
  url.password = ''
  return { href: url.href, host: url.hostname.replace(/^www\./, '') }
}

function newId() {
  return randomUUID().replace(/-/g, '').slice(0, 12)
}

function freshId(state, table = 'links') {
  const taken = new Set((state[table] ?? []).map((entry) => entry.id))
  for (;;) {
    const id = newId()
    if (!taken.has(id)) return id
  }
}

function asTime(value, fallback) {
  return typeof value === 'string' && value ? value : fallback
}

function coerceLink(raw) {
  if (!raw || typeof raw !== 'object') return null
  const rawUrl = typeof raw.url === 'string' && raw.url.trim() ? raw.url.trim() : ''
  if (!rawUrl) return null
  let normalized
  try {
    normalized = normalizeUrl(rawUrl)
  } catch {
    return null // a stored record whose target is not an http(s) link is dropped
  }
  const createdAt = asTime(raw.createdAt, new Date().toISOString())
  const status = raw.status === 'read' ? 'read' : 'unread'
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    url: normalized.href,
    title: asText(raw.title, TITLE_MAX),
    host: normalized.host,
    note: asText(raw.note, NOTE_MAX),
    status,
    createdAt,
    updatedAt: asTime(raw.updatedAt, createdAt),
    readAt: status === 'read' && typeof raw.readAt === 'string' ? raw.readAt : null,
    source: raw.source === 'ui' ? 'ui' : 'agent',
  }
}

function coerceTodo(raw) {
  if (!raw || typeof raw !== 'object') return null
  const text = asText(raw.text, TODO_MAX)
  if (!text) return null
  const createdAt = asTime(raw.createdAt, new Date().toISOString())
  const done = raw.done === true
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    text,
    done,
    createdAt,
    updatedAt: asTime(raw.updatedAt, createdAt),
    doneAt: done && typeof raw.doneAt === 'string' ? raw.doneAt : null,
  }
}

function titleFromBody(body) {
  const text = String(body || '')
  const heading = text.match(/^\s{0,3}#\s+(.+)$/m)
  const candidate = heading ? heading[1] : text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || ''
  return asText(candidate.replace(/^#+\s*/, ''), 80)
}

function excerptOf(body) {
  const text = String(body || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+[.)]\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX - 1)}…` : text
}

function coerceArticle(raw) {
  if (!raw || typeof raw !== 'object') return null
  const body = typeof raw.body === 'string' ? raw.body.slice(0, ARTICLE_BODY_MAX) : ''
  // An empty title is allowed: the page shows a localized placeholder and the
  // title is derived from the first heading once there is one.
  const title = asText(raw.title, TITLE_MAX) || titleFromBody(body) || ''
  const createdAt = asTime(raw.createdAt, new Date().toISOString())
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    title,
    body,
    createdAt,
    updatedAt: asTime(raw.updatedAt, createdAt),
  }
}

/** Full article for the editor: adds the derived excerpt and length. */
function articleView(article) {
  return { ...article, excerpt: excerptOf(article.body), chars: article.body.length }
}

/** Article without its body, for lists that go into the model's context. */
function articleSummary(article) {
  return {
    id: article.id,
    title: article.title,
    excerpt: excerptOf(article.body),
    chars: article.body.length,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  }
}

function coerceState(parsed) {
  const list = (value) => (Array.isArray(value) ? value : [])
  return {
    version: 2,
    links: list(parsed?.links).map(coerceLink).filter(Boolean),
    todos: list(parsed?.todos).map(coerceTodo).filter(Boolean),
    articles: list(parsed?.articles).map(coerceArticle).filter(Boolean),
  }
}

/** Renames a damaged store aside, so the next write cannot erase it. */
function salvageFile(file, reason) {
  const target = `${file}.broken-${Date.now()}`
  try {
    renameSync(file, target)
  } catch (renameError) {
    const failure = new Error(`链接收藏的存档读不出来（${reason}），也无法备份到 ${target}：${renameError.message}`)
    failure.code = 'EIO' // report as an internal failure, not a bad request
    throw failure
  }
  logger?.warn?.(`${PLUGIN}: ${file} 有问题（${reason}），已备份到 ${target}`)
  pendingSalvage = target
}

/** One-shot marker: a v1 `links.json` is imported at most once, ever. */
function legacyMarkerPath() {
  return join(dataDir(), 'library.json.imported')
}

function readState() {
  const file = statePath()
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return readLegacyState()
    throw error
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    salvageFile(file, error.message)
    return emptyState()
  }
  // Check the envelope BEFORE normalising: a valid-JSON but wrong-shaped file
  // (or one written by a newer version) must never be coerced and written back.
  const problem =
    !parsed || typeof parsed !== 'object'
      ? '内容不是一个对象'
      : Number(parsed.version) > 2
        ? `版本 ${parsed.version} 比插件支持的（2）新`
        : ['links', 'todos', 'articles'].some((key) => parsed[key] !== undefined && !Array.isArray(parsed[key]))
          ? 'links / todos / articles 里有字段不是数组'
          : null
  if (problem) {
    salvageFile(file, problem)
    return emptyState()
  }
  const state = coerceState(parsed)
  const dropped =
    (parsed.links?.length ?? 0) - state.links.length +
    (parsed.todos?.length ?? 0) - state.todos.length +
    (parsed.articles?.length ?? 0) - state.articles.length
  if (dropped > 0) {
    // Keep the readable records on screen, but back the original up first: the
    // records we could not read must not disappear on the next write.
    salvageFile(file, `有 ${dropped} 条记录读不出来`)
  }
  return state
}

/**
 * The v1 shelf, held in memory between the first read and the write that
 * persists it. The durable marker is only written by `writeState`, so several
 * reads before that write keep seeing the imported links.
 * @type {{ version: number, links: any[], todos: any[], articles: any[] } | null}
 */
let legacyState = null

/** Version-1 `links.json` → carried over in memory; written as v2 on the next change. */
function readLegacyState() {
  if (legacyState) return legacyState
  if (existsSync(legacyMarkerPath())) return emptyState()
  const legacy = legacyStatePath()
  let text
  try {
    text = readFileSync(legacy, 'utf8')
  } catch {
    return emptyState()
  }
  try {
    const incoming = coerceState(JSON.parse(text))
    if (!incoming.links.length) return emptyState()
    legacyState = incoming
    logger?.info?.(`${PLUGIN}: 从 ${legacy} 迁入 ${incoming.links.length} 条链接（下次写入存到 ${statePath()}）`)
    return incoming
  } catch (error) {
    logger?.warn?.(`${PLUGIN}: 旧的 ${legacy} 读不出来：${error.message}`)
    return emptyState()
  }
}

function writeState(state) {
  const file = statePath()
  mkdirSync(dirname(file), { recursive: true })
  const payload = JSON.stringify(
    { version: 2, links: state.links, todos: state.todos, articles: state.articles },
    null,
    2,
  )
  // Unique temp name + fsync: a crash cannot leave a half-written store, and two
  // processes sharing dataDir cannot clobber each other's temp file.
  const temp = `${file}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`
  const fd = openSync(temp, 'w')
  try {
    writeSync(fd, `${payload}\n`)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(temp, file)
  if (legacyState) {
    // The migrated links are now in library.json; record that so the v1 file is
    // never imported again, even if library.json is later removed.
    try {
      writeFileSync(legacyMarkerPath(), `imported ${new Date().toISOString()} from ${legacyStatePath()}\n`, 'utf8')
    } catch {
      /* best effort */
    }
    legacyState = null
  }
}

/** Serializes read-modify-write cycles so two callers cannot drop an entry. */
let queue = Promise.resolve()
function mutate(change) {
  const run = queue.then(async () => {
    const state = readState()
    const value = await change(state)
    writeState(state)
    return value
  })
  queue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

// ---------------------------------------------------------------- counters

function linkCounts(state) {
  const all = state.links.length
  const unread = state.links.filter((link) => link.status === 'unread').length
  return { all, unread, read: all - unread }
}

function todoCounts(state) {
  const all = state.todos.length
  const done = state.todos.filter((todo) => todo.done).length
  return { all, open: all - done, done }
}

function articleCounts(state) {
  return { all: state.articles.length }
}

function shelfCounts(state) {
  return { links: linkCounts(state), todos: todoCounts(state), articles: articleCounts(state) }
}

function limitOf(value) {
  const numeric = Number(value)
  const wanted = Number.isFinite(numeric) && numeric > 0 ? numeric : LIST_LIMIT_DEFAULT
  return Math.min(Math.max(Math.round(wanted), 1), LIST_LIMIT_MAX)
}

function byNewest(left, right) {
  return String(right ?? '').localeCompare(String(left ?? ''))
}

// ---------------------------------------------------------------- links

function listLinks(input = {}) {
  const state = readState()
  let links = state.links
  const status = input.status === 'read' || input.status === 'unread' ? input.status : null
  if (status) links = links.filter((link) => link.status === status)
  const query = asText(input.query, 120).toLowerCase()
  if (query) {
    links = links.filter((link) =>
      [link.title, link.url, link.note, link.host].some((field) => field && field.toLowerCase().includes(query)),
    )
  }
  return {
    links: [...links].sort((a, b) => byNewest(a.createdAt, b.createdAt)).slice(0, limitOf(input.limit)),
    counts: linkCounts(state),
  }
}

async function fetchPageTitle(url, signal) {
  if (!config.fetchTitle) return ''
  let web
  try {
    web = getWeb?.()
  } catch {
    web = undefined
  }
  if (!web || typeof web.fetch !== 'function') return ''
  let combined = AbortSignal.timeout(TITLE_TIMEOUT_MS)
  try {
    if (signal && typeof AbortSignal.any === 'function') {
      combined = AbortSignal.any([signal, AbortSignal.timeout(TITLE_TIMEOUT_MS)])
    }
  } catch {
    combined = AbortSignal.timeout(TITLE_TIMEOUT_MS)
  }
  try {
    const result = await web.fetch({ url }, combined)
    if (!result || !result.body || Number(result.statusCode) >= 400) return ''
    const content = String(result.body.content ?? '')
    if (!content) return ''
    if (result.body.kind === 'html') {
      const candidates = [
        content.match(/<title[^>]*>([\s\S]*?)<\/title>/i),
        content.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i),
        content.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i),
        content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i),
      ]
      for (const candidate of candidates) {
        const title = cleanTitle(candidate?.[1])
        if (title) return title
      }
      return ''
    }
    const firstLine = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 1 && !/^https?:\/\//i.test(line))
    return cleanTitle(firstLine)
  } catch {
    return ''
  }
}

function cleanTitle(raw) {
  if (typeof raw !== 'string') return ''
  const text = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  return asText(text, TITLE_MAX)
}

async function addLink(input = {}, options = {}) {
  const { href, host } = normalizeUrl(input.url)
  const title = asText(input.title, TITLE_MAX)
  const note = asText(input.note, NOTE_MAX)
  const status = input.status === 'read' ? 'read' : 'unread'
  const source = input.source === 'ui' ? 'ui' : 'agent'
  const saved = await mutate((state) => {
    const now = new Date().toISOString()
    const existing = state.links.find((link) => link.url === href)
    if (existing) {
      if (title && !existing.title) existing.title = title
      if (note) existing.note = note
      existing.updatedAt = now
      return { link: { ...existing }, duplicate: true }
    }
    const link = {
      id: freshId(state, 'links'),
      url: href,
      title,
      host,
      note,
      status,
      createdAt: now,
      updatedAt: now,
      readAt: status === 'read' ? now : null,
      source,
    }
    state.links.push(link)
    return { link: { ...link }, duplicate: false }
  })
  if (!saved.link.title) {
    if (options.awaitTitle === false) {
      fillTitleLater(saved.link.id, saved.link.url)
    } else {
      const fetched = await fetchPageTitle(saved.link.url, options.signal)
      if (fetched) {
        const updated = await updateLink(saved.link.id, { title: fetched, onlyIfEmpty: true })
        if (updated) saved.link = updated
      }
    }
  }
  return saved
}

/** Background title fill for a page saved from the UI, so the add returns at once. */
function fillTitleLater(id, url) {
  void fetchPageTitle(url)
    .then((fetched) => (fetched ? updateLink(id, { title: fetched, onlyIfEmpty: true }) : null))
    .catch(() => undefined)
}

function updateLink(id, patch = {}) {
  const key = String(id ?? '').trim()
  if (!key) throw new Error('缺少链接 id')
  return mutate((state) => {
    const link = state.links.find((entry) => entry.id === key)
    if (!link) return null
    if (patch.onlyIfEmpty && link.title) return { ...link }
    const now = new Date().toISOString()
    if (patch.title !== undefined) link.title = asText(patch.title, TITLE_MAX)
    if (patch.note !== undefined) link.note = asText(patch.note, NOTE_MAX)
    if (patch.status !== undefined) {
      const status = patch.status === 'read' ? 'read' : 'unread'
      if (status !== link.status) {
        link.status = status
        link.readAt = status === 'read' ? now : null
      }
    }
    link.updatedAt = now
    return { ...link }
  })
}

function removeLink(id) {
  const key = String(id ?? '').trim()
  if (!key) throw new Error('缺少链接 id')
  return mutate((state) => {
    const index = state.links.findIndex((link) => link.id === key)
    if (index < 0) return null
    return state.links.splice(index, 1)[0]
  })
}

/** Puts a removed entry back, keeping its id and timestamps (the UI's Undo). */
function restoreLink(record) {
  const link = coerceLink(record)
  if (!link) throw new Error('这条链接记录不完整，或者网址不是 http / https')
  return mutate((state) => {
    const existing = state.links.find((entry) => entry.id === link.id || entry.url === link.url)
    if (existing) return { ...existing }
    state.links.push(link)
    return { ...link }
  })
}

function readLink(id) {
  const key = String(id ?? '').trim()
  if (!key) return null
  return readState().links.find((link) => link.id === key) ?? null
}

function openInBrowser(url) {
  let href
  try {
    href = normalizeUrl(url).href
  } catch (error) {
    return Promise.reject(error)
  }
  const platform = process.platform
  // Never through a shell or `cmd /c start`: a URL's `&`/`|` would become a
  // command separator there. rundll32 takes the URL as one argv element.
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'rundll32.exe' : 'xdg-open'
  const args = platform === 'win32' ? ['url.dll,FileProtocolHandler', href] : [href]
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawn(command, args, { stdio: 'ignore', detached: true })
    } catch (error) {
      reject(error)
      return
    }
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

// ---------------------------------------------------------------- todos

/** Unfinished first (newest first), then finished (most recently finished first). */
function orderTodos(todos) {
  const open = todos.filter((todo) => !todo.done).sort((a, b) => byNewest(a.createdAt, b.createdAt))
  const done = todos.filter((todo) => todo.done).sort((a, b) => byNewest(a.doneAt || a.updatedAt, b.doneAt || b.updatedAt))
  return [...open, ...done]
}

function listTodos(input = {}) {
  const state = readState()
  let todos = state.todos
  const status = input.status === 'done' ? 'done' : input.status === 'open' ? 'open' : null
  if (status === 'done') todos = todos.filter((todo) => todo.done)
  else if (status === 'open') todos = todos.filter((todo) => !todo.done)
  const query = asText(input.query, 120).toLowerCase()
  if (query) todos = todos.filter((todo) => todo.text.toLowerCase().includes(query))
  return { todos: orderTodos(todos).slice(0, limitOf(input.limit)), counts: todoCounts(state) }
}

function addTodo(input = {}) {
  const text = asText(input.text, TODO_MAX)
  if (!text) throw new Error('待办内容不能为空')
  return mutate((state) => {
    const now = new Date().toISOString()
    const existing = state.todos.find((todo) => !todo.done && todo.text === text)
    if (existing) return { todo: { ...existing }, duplicate: true }
    const todo = {
      id: freshId(state, 'todos'),
      text,
      done: false,
      createdAt: now,
      updatedAt: now,
      doneAt: null,
    }
    state.todos.push(todo)
    return { todo: { ...todo }, duplicate: false }
  })
}

function updateTodo(id, patch = {}) {
  const key = String(id ?? '').trim()
  if (!key) throw new Error('缺少待办 id')
  return mutate((state) => {
    const todo = state.todos.find((entry) => entry.id === key)
    if (!todo) return null
    const now = new Date().toISOString()
    if (patch.text !== undefined) {
      const text = asText(patch.text, TODO_MAX)
      if (!text) throw new Error('待办内容不能为空')
      todo.text = text
    }
    if (patch.done !== undefined || patch.status !== undefined) {
      const done = patch.done !== undefined ? patch.done === true : patch.status === 'done'
      if (done !== todo.done) {
        todo.done = done
        todo.doneAt = done ? now : null
      }
    }
    todo.updatedAt = now
    return { ...todo }
  })
}

function removeTodo(id) {
  const key = String(id ?? '').trim()
  if (!key) throw new Error('缺少待办 id')
  return mutate((state) => {
    const index = state.todos.findIndex((todo) => todo.id === key)
    if (index < 0) return null
    return state.todos.splice(index, 1)[0]
  })
}

function restoreTodo(record) {
  const todo = coerceTodo(record)
  if (!todo) throw new Error('这条待办记录不完整')
  return mutate((state) => {
    const existing = state.todos.find((entry) => entry.id === todo.id)
    if (existing) return { ...existing }
    state.todos.push(todo)
    return { ...todo }
  })
}

// ---------------------------------------------------------------- articles

function sortedArticles(state) {
  return [...state.articles].sort((a, b) => byNewest(a.updatedAt, b.updatedAt))
}

function listArticles(input = {}) {
  const state = readState()
  let articles = sortedArticles(state)
  const query = asText(input.query, 120).toLowerCase()
  if (query) {
    articles = articles.filter(
      (article) => article.title.toLowerCase().includes(query) || article.body.toLowerCase().includes(query),
    )
  }
  return { articles: articles.slice(0, limitOf(input.limit)).map(articleSummary), counts: articleCounts(state) }
}

/** Reads a body window, so a long article cannot flood the conversation. */
function getArticle(id, options = {}) {
  const key = String(id ?? '').trim()
  if (!key) throw new Error('缺少文章 id')
  const article = readState().articles.find((entry) => entry.id === key)
  if (!article) throw new Error('没有找到这篇文章，可能已经删掉了')
  const total = article.body.length
  const offset = Math.min(Math.max(Number(options.offset) || 0, 0), total)
  const limit = Math.min(Math.max(Number(options.limit) || ARTICLE_GET_DEFAULT, 1), ARTICLE_GET_MAX)
  return {
    ...articleView(article),
    body: article.body.slice(offset, offset + limit),
    bodyTotal: total,
    bodyOffset: offset,
    bodyTruncated: offset > 0 || offset + limit < total,
  }
}

function createArticle(input = {}) {
  const title = asText(input.title, TITLE_MAX)
  const body = typeof input.body === 'string' ? input.body : ''
  // An empty title and body are allowed: the page creates blank drafts.
  if (body.length > ARTICLE_BODY_MAX) throw new Error(`文章太长了（上限 ${ARTICLE_BODY_MAX} 字）`)
  return mutate((state) => {
    const now = new Date().toISOString()
    const article = {
      id: freshId(state, 'articles'),
      title: title || titleFromBody(body) || '',
      body,
      createdAt: now,
      updatedAt: now,
    }
    state.articles.push(article)
    return { article: articleView(article) }
  })
}

function updateArticle(id, patch = {}) {
  const key = String(id ?? '').trim()
  if (!key) throw new Error('缺少文章 id')
  const mode = patch.mode === 'append' ? 'append' : 'replace'
  return mutate((state) => {
    const article = state.articles.find((entry) => entry.id === key)
    if (!article) return null
    if (patch.title === undefined && patch.body === undefined) return { article: articleView(article) }
    const now = new Date().toISOString()
    if (patch.body !== undefined) {
      const incoming = typeof patch.body === 'string' ? patch.body : ''
      if (mode === 'append') {
        const addition = incoming.trim()
        if (addition) {
          const base = article.body.replace(/\s+$/, '')
          article.body = base ? `${base}\n\n${addition}` : addition
        }
      } else {
        article.body = incoming
      }
      if (article.body.length > ARTICLE_BODY_MAX) throw new Error(`文章太长了（上限 ${ARTICLE_BODY_MAX} 字）`)
      if (!article.title) {
        const derived = titleFromBody(article.body)
        if (derived) article.title = derived
      }
    }
    if (patch.title !== undefined) {
      // Clearing the field clears the title; it is re-derived from the first
      // heading of the body that was just written, so list and editor agree.
      const title = asText(patch.title, TITLE_MAX)
      article.title = title || titleFromBody(article.body) || ''
    }
    article.updatedAt = now
    return { article: articleView(article) }
  })
}

function removeArticle(id) {
  const key = String(id ?? '').trim()
  if (!key) throw new Error('缺少文章 id')
  return mutate((state) => {
    const index = state.articles.findIndex((article) => article.id === key)
    if (index < 0) return null
    return state.articles.splice(index, 1)[0]
  })
}

function restoreArticle(record) {
  const article = coerceArticle(record)
  if (!article) throw new Error('这条文章记录不完整')
  return mutate((state) => {
    const existing = state.articles.find((entry) => entry.id === article.id)
    if (existing) return articleView(existing)
    state.articles.push(article)
    return articleView(article)
  })
}

// ---------------------------------------------------------------- transport

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

const MAX_BODY_BYTES = 2 * 1024 * 1024

async function readJson(request) {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new Error('请求体太大')
  const text = await request.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) throw new Error('请求体太大')
  if (!text.trim()) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('请求体不是合法 JSON')
  }
}

function describeLink(link) {
  const head = link.title ? `《${link.title}》 ${link.url}` : link.url
  const parts = [head, link.host || '未知站点', link.status === 'read' ? '已看' : '待看', `id: ${link.id}`]
  if (link.note) parts.push(`备注：${link.note}`)
  return parts.join(' · ')
}

function describeTodo(todo) {
  return `${todo.done ? '✓' : '○'} ${todo.text} · id: ${todo.id}`
}

function describeArticle(article) {
  return `《${article.title || '（未命名）'}》 · id: ${article.id} · 约 ${article.chars} 字 · 更新于 ${String(article.updatedAt).slice(0, 10)}`
}

const notFound = (what) => new Error(`没有找到这${what}，可能已经删掉了`)

/**
 * One implementation of every operation. The tool paths and the browser paths
 * both land here, so they report the same results and the same failures.
 */
async function act(action, body = {}, options = {}) {
  const after = () => shelfCounts(readState())
  switch (action) {
    // ---- links
    case 'add': {
      const result = await addLink(body, { signal: options.signal, awaitTitle: options.waitTitle !== false })
      return {
        link: result.link,
        duplicate: result.duplicate,
        counts: after(),
        message: result.duplicate
          ? `这个链接已经收藏过了：${describeLink(result.link)}`
          : `已收藏：${describeLink(result.link)}`,
      }
    }
    case 'update': {
      const link = await updateLink(body.id, body)
      if (!link) throw notFound('条链接')
      return { link, counts: after(), message: `已更新：${describeLink(link)}` }
    }
    case 'remove': {
      const removed = await removeLink(body.id)
      if (!removed) throw notFound('条链接')
      return { removed, counts: after(), message: `已删除：${describeLink(removed)}` }
    }
    case 'restore': {
      const link = await restoreLink(body.link ?? body.record ?? body)
      return { link, counts: after(), message: `已恢复：${describeLink(link)}` }
    }
    case 'open': {
      const target = body.id ? readLink(body.id) : null
      if (body.id && !target) throw notFound('条链接')
      const url = target ? target.url : normalizeUrl(body.url).href
      await openInBrowser(url) // validates the scheme again before spawning
      if (target && target.status !== 'read') {
        const link = await updateLink(target.id, { status: 'read' })
        return { link, counts: after(), message: `已用浏览器打开：${url}` }
      }
      return { link: target, counts: after(), message: `已用浏览器打开：${url}` }
    }

    // ---- todos
    case 'todo.add': {
      const result = await addTodo(body)
      return {
        todo: result.todo,
        duplicate: result.duplicate,
        counts: after(),
        message: result.duplicate ? `这条待办已经在清单里了：${describeTodo(result.todo)}` : `已加进待办：${describeTodo(result.todo)}`,
      }
    }
    case 'todo.update': {
      const todo = await updateTodo(body.id, body)
      if (!todo) throw notFound('条待办')
      const statusTouched = body.status !== undefined || body.done !== undefined
      const tail = statusTouched ? (todo.done ? '（标为已完成）' : '（改回未完成）') : ''
      return { todo, counts: after(), message: `已更新：${describeTodo(todo)}${tail}` }
    }
    case 'todo.remove': {
      const removed = await removeTodo(body.id)
      if (!removed) throw notFound('条待办')
      return { removed, counts: after(), message: `已删掉待办：${describeTodo(removed)}` }
    }
    case 'todo.restore': {
      const todo = await restoreTodo(body.todo ?? body.record ?? body)
      return { todo, counts: after(), message: `已恢复待办：${describeTodo(todo)}` }
    }

    // ---- articles
    case 'article.get': {
      const article = getArticle(body.id, { offset: body.offset, limit: body.limit })
      const tail = article.bodyTruncated
        ? `（正文共 ${article.bodyTotal} 字，这里显示第 ${article.bodyOffset + 1}~${article.bodyOffset + article.body.length} 字；要后面的，带 offset 再读）`
        : ''
      return { article, counts: after(), message: `已读取文章正文${tail}` }
    }
    case 'article.create': {
      const result = await createArticle(body)
      return {
        article: result.article,
        counts: after(),
        message: `已新建文章《${result.article.title || '（未命名）'}》（id: ${result.article.id}，约 ${result.article.chars} 字），正文是 Markdown。`,
      }
    }
    case 'article.update': {
      const result = await updateArticle(body.id, body)
      if (!result) throw notFound('篇文章')
      const appended = body.mode === 'append' && typeof body.body === 'string' && body.body.trim() !== ''
      return {
        article: result.article,
        counts: after(),
        message: appended
          ? `已把新内容追加到《${result.article.title || '（未命名）'}》末尾（现在约 ${result.article.chars} 字）。`
          : `已更新文章《${result.article.title || '（未命名）'}》（约 ${result.article.chars} 字）。`,
      }
    }
    case 'article.remove': {
      const removed = await removeArticle(body.id)
      if (!removed) throw notFound('篇文章')
      return {
        removed: articleView(removed),
        counts: after(),
        message: `已删掉文章《${removed.title || '（未命名）'}》（id: ${removed.id}）。`,
      }
    }
    case 'article.restore': {
      const article = await restoreArticle(body.article ?? body.record ?? body)
      return { article, counts: after(), message: `已恢复文章《${article.title || '（未命名）'}》（id: ${article.id}）。` }
    }
    default:
      throw new Error(`不认识的 action：${action || '(空)'}`)
  }
}

function registerRoutes(fetchRoutes) {
  fetchRoutes.register({
    path: ROUTE,
    methods: ['GET', 'HEAD'],
    requestBody: 'buffered',
    fetch: async () => {
      try {
        const state = readState()
        const warning = pendingSalvage
        pendingSalvage = null
        return json({
          ok: true,
          links: [...state.links].sort((a, b) => byNewest(a.createdAt, b.createdAt)),
          todos: orderTodos(state.todos),
          articles: sortedArticles(state).map(articleView),
          counts: shelfCounts(state),
          warning,
        })
      } catch (error) {
        return json({ ok: false, error: error.message }, 500)
      }
    },
  })
  fetchRoutes.register({
    path: ACT_ROUTE,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      let body
      try {
        body = await readJson(request)
      } catch (error) {
        return json({ ok: false, error: error.message }, 400)
      }
      const action = String(body?.action ?? '').trim()
      try {
        // The page must not wait on a slow page-title fetch; the tool path does.
        return json({ ok: true, ...(await act(action, body, { signal: request.signal, waitTitle: false })) })
      } catch (error) {
        const status = typeof error?.code === 'string' ? 500 : 400
        return json({ ok: false, error: error.message }, status)
      }
    },
  })
}

// ---------------------------------------------------------------- agent tools

const objectSchema = { type: 'object', additionalProperties: true }
const arraySchema = { type: 'array', items: objectSchema }

const linkLibraryTool = {
  name: 'link_library',
  description: [
    '保存和管理用户的「链接收藏」（侧栏「链接与笔记」→ 链接标签页）：看过的和准备以后看的网址都记在这里，用户点一下就能打开。',
    '用户发来一个网址，或者让你「记一下 / 收藏 / 稍后看 / 待看 / 保存这个链接」时，用 action "add"。',
    '用户问收藏了什么、还有什么没看时用 action "list"。',
    '用户说某条已经看过了用 action "update" 并把 status 设为 "read"；要删掉某条用 action "remove" 并带上从 list 里拿到的 id。',
    'add 时 url 必填；知道页面讲什么就补一个简短的 title；用户说了为什么收藏就写进 note。只是你自己回答里的引用链接不要收藏。',
  ].join(' '),
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['action'],
    properties: {
      action: {
        type: 'string',
        description: 'add：收藏一条链接；list：看收藏了什么；update：改标题 / 备注 / 待看已看；remove：删掉一条。',
        enum: ['add', 'list', 'update', 'remove'],
      },
      url: { type: 'string', description: '要收藏的网址。不写 https:// 也接受。' },
      title: {
        type: 'string',
        description: '链接标题。知道页面讲什么就写一句短的；不确定就留空，插件会自己去抓页面标题（抓不到就显示网址）。',
      },
      note: { type: 'string', description: '一句备注：用户为什么收藏、之后要拿它做什么。' },
      id: { type: 'string', description: 'update / remove 要改的那条链接的 id（从 list 的结果里拿）。' },
      status: {
        type: 'string',
        description: 'update：把链接标成待看（unread）或已看（read）。list：只列这种状态，不填就都列。',
        enum: ['unread', 'read'],
      },
      query: { type: 'string', description: 'list 时按关键词筛选标题、网址或备注。' },
      limit: { type: 'integer', description: 'list 最多返回几条，默认 30，最多 200。' },
    },
  },
  timeoutMs: 30_000,
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['ok', 'message'],
      properties: {
        ok: { type: 'boolean' },
        message: { type: 'string' },
        link: objectSchema,
        links: arraySchema,
        counts: objectSchema,
        duplicate: { type: 'boolean' },
        removed: objectSchema,
      },
    },
    render: (_args, value) => [{ type: 'text', text: String(value?.message ?? '') }],
  },
  async execute(args, exec) {
    const action = String(args?.action ?? '').trim()
    const signal = exec?.signal
    if (action === 'add') {
      const result = await act('add', { ...(args ?? {}), source: 'agent' }, { signal })
      const links = result.counts.links
      const tail = links.unread > 0 ? `（共 ${links.all} 条，${links.unread} 条待看）` : `（共 ${links.all} 条）`
      return { ok: true, message: `${result.message}${tail}`, link: result.link, duplicate: result.duplicate }
    }
    if (action === 'list') {
      const { links: rows, counts: linkSummary } = listLinks(args ?? {})
      const header =
        linkSummary.all === 0 ? '链接收藏还是空的。' : `链接收藏共 ${linkSummary.all} 条，${linkSummary.unread} 条待看。`
      const lines = rows.map((link, index) => `${index + 1}. ${describeLink(link)}`)
      if (!lines.length) {
        return {
          ok: true,
          message: linkSummary.all === 0 ? '链接收藏还是空的。' : '没有符合筛选条件的链接。',
          links: [],
        }
      }
      return { ok: true, message: `${header}\n${lines.join('\n')}`, links: rows }
    }
    if (action === 'update' || action === 'remove') {
      let result
      try {
        result = await act(action, args ?? {}, { signal })
      } catch (error) {
        if (String(error.message).includes('没有找到')) {
          throw new Error(`${error.message}（先用 action "list" 拿到正确的 id）`)
        }
        throw error
      }
      return action === 'update'
        ? { ok: true, message: result.message, link: result.link }
        : { ok: true, message: result.message, removed: result.removed }
    }
    throw new Error(`action 只能是 add / list / update / remove，收到的是：${action || '(空)'}`)
  },
}

const todoTool = {
  name: 'todo',
  description: [
    '用户的个人待办清单（侧栏「链接与笔记」→ 待办标签页），和链接、文章放在同一个面板里。',
    '用户说「加个待办 / 提醒我做 X / 记一下要做 X / 别忘了 X」时用 action "add"，text 写清要做什么（用用户原话，别加自己的评论）。',
    '用户问「还有什么没做 / 我的待办」时用 action "list"；status 不填会列出全部（未完成排在前面），只想看没做完的就把 status 设成 "open"。',
    '用户说做完了用 action "update" 并把 status 设为 "done"；要改文字用 "update" 加 text；要删掉用 "remove"（id 从 list 里拿）。',
  ].join(' '),
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['action'],
    properties: {
      action: {
        type: 'string',
        description: 'add：加一条待办；list：看待办；update：改文字或标完成 / 未完成；remove：删掉一条。',
        enum: ['add', 'list', 'update', 'remove'],
      },
      text: { type: 'string', description: '待办内容，一句话说清要做什么。' },
      id: { type: 'string', description: 'update / remove 要改的那条待办的 id（从 list 的结果里拿）。' },
      status: {
        type: 'string',
        description: 'update：把待办标成未完成（open）或已完成（done）。list：只列这一种状态。',
        enum: ['open', 'done'],
      },
      query: { type: 'string', description: 'list 时按关键词筛选待办内容。' },
      limit: { type: 'integer', description: 'list 最多返回几条，默认 30，最多 200。' },
    },
  },
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['ok', 'message'],
      properties: {
        ok: { type: 'boolean' },
        message: { type: 'string' },
        todo: objectSchema,
        todos: arraySchema,
        counts: objectSchema,
        duplicate: { type: 'boolean' },
        removed: objectSchema,
      },
    },
    render: (_args, value) => [{ type: 'text', text: String(value?.message ?? '') }],
  },
  async execute(args, exec) {
    const action = String(args?.action ?? '').trim()
    const signal = exec?.signal
    if (action === 'add') {
      const result = await act('todo.add', args ?? {}, { signal })
      const counts = result.counts.todos
      return {
        ok: true,
        message: `${result.message}（还有 ${counts.open} 条没做完）`,
        todo: result.todo,
        duplicate: result.duplicate,
      }
    }
    if (action === 'list') {
      const { todos: rows, counts: todoSummary } = listTodos(args ?? {})
      const header =
        todoSummary.all === 0 ? '待办清单还是空的。' : `待办共 ${todoSummary.all} 条，${todoSummary.open} 条没做完。`
      const lines = rows.map((todo, index) => `${index + 1}. ${describeTodo(todo)}`)
      if (!lines.length) {
        return {
          ok: true,
          message: todoSummary.all === 0 ? '待办清单还是空的。' : '没有符合筛选条件的待办。',
          todos: [],
        }
      }
      return { ok: true, message: `${header}\n${lines.join('\n')}`, todos: rows }
    }
    if (action === 'update' || action === 'remove') {
      let result
      try {
        result = await act(`todo.${action}`, args ?? {}, { signal })
      } catch (error) {
        if (String(error.message).includes('没有找到')) {
          throw new Error(`${error.message}（先用 action "list" 拿到正确的 id）`)
        }
        throw error
      }
      return action === 'update'
        ? { ok: true, message: result.message, todo: result.todo }
        : { ok: true, message: result.message, removed: result.removed }
    }
    throw new Error(`action 只能是 add / list / update / remove，收到的是：${action || '(空)'}`)
  },
}

const articleTool = {
  name: 'article',
  description: [
    '用户的文章 / 长笔记（侧栏「链接与笔记」→ 文章标签页，正文是 Markdown，面板里可以编辑和预览）。',
    '用户要写一篇文章、把对话或资料整理成长文、或让你改 / 续写已有文章时用这个工具，不要只在回复里给一段文字。',
    'action："create" 新建（title + body）；"list" 看有哪些文章和 id；"get" 读一篇的正文（改之前先读）；"update" 修改（id 必填，mode "replace" 整篇替换，mode "append" 追加到末尾）；"remove" 删掉。',
    'body 用 Markdown：# 一级标题、## 二级标题、- 列表、**粗体**、*斜体*、`代码`、> 引用、[文字](网址)、三个反引号包代码块。别覆盖用户自己写的内容。',
  ].join(' '),
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['action'],
    properties: {
      action: {
        type: 'string',
        description: 'create：新建文章；list：看文章列表；get：读一篇正文；update：改标题或正文；remove：删掉一篇。',
        enum: ['create', 'list', 'get', 'update', 'remove'],
      },
      id: { type: 'string', description: 'get / update / remove 要操作的文章 id（从 list 的结果里拿）。' },
      title: { type: 'string', description: '文章标题。create 时可以不给，会从正文第一个标题或第一行推断。' },
      body: { type: 'string', description: '文章正文，Markdown 格式。' },
      mode: {
        type: 'string',
        description: 'update 时：replace 整篇替换（默认），append 追加到末尾。',
        enum: ['replace', 'append'],
      },
      query: { type: 'string', description: 'list 时按关键词筛选标题和正文。' },
      limit: { type: 'integer', description: 'list 最多返回几条，默认 30，最多 200。' },
      offset: {
        type: 'integer',
        description: 'get 时从第几个字开始读（默认 0）。正文很长、上一次 get 被截断时用它续读。',
      },
    },
  },
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['ok', 'message'],
      properties: {
        ok: { type: 'boolean' },
        message: { type: 'string' },
        article: objectSchema,
        articles: arraySchema,
        counts: objectSchema,
        removed: objectSchema,
      },
    },
    render: (_args, value) => [{ type: 'text', text: String(value?.message ?? '') }],
  },
  async execute(args, exec) {
    const action = String(args?.action ?? '').trim()
    const signal = exec?.signal
    if (action === 'list') {
      const { articles: rows, counts: articleSummary } = listArticles(args ?? {})
      const header = articleSummary.all === 0 ? '还没有文章。' : `共 ${articleSummary.all} 篇文章。`
      const lines = rows.map((article, index) => `${index + 1}. ${describeArticle(article)}`)
      if (!lines.length) {
        return { ok: true, message: articleSummary.all === 0 ? '还没有文章。' : '没有符合筛选条件的文章。', articles: [] }
      }
      return { ok: true, message: `${header}\n${lines.join('\n')}`, articles: rows }
    }
    if (action === 'get') {
      const article = getArticle(args?.id, { offset: args?.offset, limit: args?.limit })
      const head = `《${article.title || '（未命名）'}》（id: ${article.id}，约 ${article.chars} 字）`
      const tail = article.bodyTruncated
        ? `\n\n（正文共 ${article.bodyTotal} 字，上面只显示第 ${article.bodyOffset + 1}~${article.bodyOffset + article.body.length} 字；要看后面的，带 offset=${article.bodyOffset + article.body.length} 再 get 一次）`
        : ''
      return { ok: true, message: `${head}\n\n${article.body || '(正文是空的)'}${tail}`, article }
    }
    if (action === 'create' || action === 'update' || action === 'remove') {
      let result
      try {
        result = await act(`article.${action}`, args ?? {}, { signal })
      } catch (error) {
        if (action === 'create' || !String(error.message).includes('没有找到')) throw error
        throw new Error(`${error.message}（先用 action "list" 拿到正确的 id）`)
      }
      if (action === 'remove') return { ok: true, message: result.message, removed: result.removed }
      return { ok: true, message: result.message, article: result.article }
    }
    throw new Error(`action 只能是 create / list / get / update / remove，收到的是：${action || '(空)'}`)
  },
}

const promptText = [
  '## 个人记录（link_library / todo / article）',
  '用户左侧栏有一个「链接与笔记」面板，分 链接 / 待办 / 文章 三栏，对应 `link_library`、`todo`、`article` 三个工具（各自说明里写了怎么用）。用户明确要留下东西时才调用，不要把你回答里引用的链接收藏起来。',
].join('\n')

// ---------------------------------------------------------------- plugin

/** The tool registry is a hard dependency; the other services are optional. */
export const inject = ['tools']

function resolveConfig(pluginConfig) {
  const input = pluginConfig && typeof pluginConfig === 'object' ? pluginConfig : {}
  return {
    fetchTitle: !(input.fetchTitle === false || input.fetchTitle === 'false'),
    dataDir: typeof input.dataDir === 'string' ? input.dataDir.trim() : '',
    // 是否往系统提示里写「个人记录」那段说明；设 false 就只剩三个工具的 description。
    promptGuidance: !(input.promptGuidance === false || input.promptGuidance === 'false'),
  }
}

export function apply(ctx, pluginConfig = {}) {
  config = resolveConfig(pluginConfig)
  logger = ctx.logger
  getWeb = () => ctx.get('web')

  ctx.effect(() => ctx.tools.register(linkLibraryTool), `${PLUGIN}: link_library tool`)
  ctx.effect(() => ctx.tools.register(todoTool), `${PLUGIN}: todo tool`)
  ctx.effect(() => ctx.tools.register(articleTool), `${PLUGIN}: article tool`)

  ctx.inject?.(['systemPrompt'], (scope) => {
    if (!config.promptGuidance) return
    const service = scope.systemPrompt
    if (typeof service?.section !== 'function') return
    // Sit with the other tool how-to sections instead of ahead of the policy ones.
    let order = 2100
    try {
      const toolOrder = service.getSectionOrder?.('TOOL_WEB_FETCH')
      if (typeof toolOrder === 'number') order = toolOrder + 1
    } catch {
      /* keep the fallback */
    }
    service.section({ name: 'link-library', order, text: promptText })
  })

  ctx.inject?.(['connection'], (scope) => {
    if (typeof scope.connection?.fetch?.register !== 'function') return
    registerRoutes(scope.connection.fetch)
  })
}
