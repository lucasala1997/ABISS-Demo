import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Connect, Plugin } from 'vite'

/**
 * Serves ../demo_data/abiss_demo_data.json at /data/abiss_demo_data.json (dev + preview)
 * and emits it into dist/ at build time. The JSON is never copied into src/.
 * ABISS_DATA=<path> serves another file instead (to try a candidate JSON before replacing the real one).
 * The detail files next to it (questions/ and dialogues/, loaded when a database and a subcategory are chosen)
 * are served at /data/questions/... and /data/dialogues/... and copied into dist/data/ as well.
 * Test fixtures (tests/fixtures/*.json) are served at /fixtures/ for the broken-JSON check.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url))
export const DATA_FILE = process.env.ABISS_DATA
  ? path.resolve(process.env.ABISS_DATA)
  : path.resolve(HERE, '../../demo_data/abiss_demo_data.json')
const FIXTURES_DIR = path.resolve(HERE, '../tests/fixtures')
const DATA_DIR = path.dirname(DATA_FILE)
const DETAIL_KINDS = ['questions', 'dialogues']
const DETAIL_URL = /\/data\/((?:questions|dialogues)(?:\/[\w.-]+)+\.json)$/

/** Every file under a folder, as paths relative to it. */
function walk(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p, base) : e.name.endsWith('.json') ? [path.relative(base, p)] : []
  })
}

function middleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = (req.url ?? '').split('?')[0]
    let file: string | null = null
    if (url.endsWith('/data/abiss_demo_data.json')) file = DATA_FILE
    const m = url.match(/\/fixtures\/([\w.-]+\.json)$/)
    if (m) file = path.join(FIXTURES_DIR, m[1])
    const detail = decodeURIComponent(url).match(DETAIL_URL)
    if (detail && !detail[1].includes('..')) file = path.join(DATA_DIR, detail[1])
    if (!file) return next()
    if (!fs.existsSync(file)) {
      res.statusCode = 404
      res.end(`not found: ${file}`)
      return
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(fs.readFileSync(file))
  }
}

export function demoData(): Plugin {
  return {
    name: 'abiss-demo-data',
    configureServer(server) {
      server.watcher.add(DATA_FILE)
      server.watcher.on('change', (f) => {
        if (path.resolve(f) === DATA_FILE) server.ws.send({ type: 'full-reload' })
      })
      server.middlewares.use(middleware())
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware())
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'data/abiss_demo_data.json', source: fs.readFileSync(DATA_FILE) })
      for (const kind of DETAIL_KINDS)
        for (const rel of walk(path.join(DATA_DIR, kind)))
          this.emitFile({ type: 'asset', fileName: `data/${kind}/${rel.split(path.sep).join('/')}`, source: fs.readFileSync(path.join(DATA_DIR, kind, rel)) })
    },
  }
}
