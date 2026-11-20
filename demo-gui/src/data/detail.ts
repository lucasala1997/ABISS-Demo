import { useEffect, useMemo, useState } from 'react'
import { useData } from './context'
import { parseDialoguesFile, parseQuestionsFile, type DetailParse, type DialoguesFile, type QuestionsFile } from './detailSchema'
import { detailUrls, type Selection } from './questions'
import type { Issue } from './schema'

/* Detail files are loaded when a database and a subcategory are chosen, validated, and kept for the session. */

export type DetailResult<T> = { status: 'ok'; data: T } | { status: 'missing' } | { status: 'invalid'; issues: Issue[] }

export type DetailState<T> =
  | { status: 'idle' | 'loading' }
  | { status: 'ok'; data: T[] }
  | { status: 'missing'; urls: string[] }
  | { status: 'invalid'; url: string; issues: Issue[] }

const fileIssue = (message: string): DetailResult<never> => ({ status: 'invalid', issues: [{ path: '(file)', message }] })

export async function fetchDetail<T>(url: string, parse: (x: unknown) => DetailParse<T>, fetcher: typeof fetch = fetch): Promise<DetailResult<T>> {
  let res: Response
  try {
    res = await fetcher(url, { cache: 'no-store' })
  } catch (e) {
    return fileIssue(`cannot read ${url}: ${e instanceof Error ? e.message : String(e)}`)
  }
  // a static server may answer a missing file with its own page
  if (res.status === 404 || (res.headers.get('Content-Type') ?? '').includes('text/html')) return { status: 'missing' }
  if (!res.ok) return fileIssue(`HTTP ${res.status} for ${url}`)
  let json: unknown
  try {
    json = JSON.parse(await res.text())
  } catch (e) {
    return fileIssue(`not valid JSON: ${e instanceof Error ? e.message : String(e)}`)
  }
  const parsed = parse(json)
  return parsed.ok ? { status: 'ok', data: parsed.data } : { status: 'invalid', issues: parsed.issues }
}

const cache = new Map<string, Promise<DetailResult<unknown>>>()

function useDetail<T>(urls: string[], parse: (x: unknown) => DetailParse<T>): DetailState<T> {
  const key = urls.join('\n')
  const [state, setState] = useState<{ key: string; value: DetailState<T> }>({ key: '', value: { status: 'idle' } })
  useEffect(() => {
    if (!urls.length) return
    let current = true
    Promise.all(
      urls.map((u) => {
        if (!cache.has(u)) cache.set(u, fetchDetail(u, parse))
        return cache.get(u) as Promise<DetailResult<T>>
      }),
    ).then((results) => {
      if (!current) return
      const bad = results.findIndex((r) => r.status === 'invalid')
      const found = results.flatMap((r) => (r.status === 'ok' ? [r.data] : []))
      let value: DetailState<T>
      if (bad >= 0) value = { status: 'invalid', url: urls[bad], issues: (results[bad] as { issues: Issue[] }).issues }
      else if (!found.length) value = { status: 'missing', urls }
      else value = { status: 'ok', data: found }
      setState({ key, value })
    })
    return () => {
      current = false
    }
    // the list of files is in the key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, parse])
  if (!urls.length) return { status: 'idle' }
  return state.key === key ? state.value : { status: 'loading' }
}

/** The candidates of the chosen database(s) and subcategory, with their traces. */
export function useQuestions(sel: Selection): DetailState<QuestionsFile> {
  const d = useData()
  const urls = useMemo(() => detailUrls(d, sel, 'questions'), [d, sel])
  return useDetail(urls, parseQuestionsFile)
}

/** The recorded dialogues on the questions of the chosen database(s) and subcategory. */
export function useDialogues(sel: Selection): DetailState<DialoguesFile> {
  const d = useData()
  const urls = useMemo(() => detailUrls(d, sel, 'dialogues'), [d, sel])
  return useDetail(urls, parseDialoguesFile)
}
