import { parseDemoData, type ParseResult } from './schema'

/** Fetches and validates the demo JSON. Network and syntax errors become issues too. */
export async function loadDemoData(url: string): Promise<ParseResult> {
  let res: Response
  try {
    res = await fetch(url, { cache: 'no-store' })
  } catch (e) {
    return { ok: false, issues: [{ path: '(file)', message: `cannot fetch ${url}: ${String(e)}` }] }
  }
  if (!res.ok) return { ok: false, issues: [{ path: '(file)', message: `HTTP ${res.status} for ${url}` }] }
  let json: unknown
  try {
    json = JSON.parse(await res.text())
  } catch (e) {
    return { ok: false, issues: [{ path: '(file)', message: `not valid JSON: ${e instanceof Error ? e.message : String(e)}` }] }
  }
  return parseDemoData(json)
}
