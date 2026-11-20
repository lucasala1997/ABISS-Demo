import { describe, expect, it } from 'vitest'
import { fetchDetail } from './detail'
import { parseQuestionsFile } from './detailSchema'

const respond = (status: number, body: string, type = 'application/json') => (async () => new Response(body, { status, headers: { 'Content-Type': type } })) as typeof fetch
const good = JSON.stringify({ collection: 'BIRD', db_id: 'db', subcategory: 'scope', source: 's', questions: [] })

describe('fetchDetail', () => {
  it('gives the parsed file', async () => {
    expect(await fetchDetail('u', parseQuestionsFile, respond(200, good))).toMatchObject({ status: 'ok', data: { db_id: 'db' } })
  })

  it('reports a file that is not there as missing', async () => {
    expect(await fetchDetail('u', parseQuestionsFile, respond(404, 'not found'))).toEqual({ status: 'missing' })
  })

  it('takes the page a static server sends in place of a missing file as missing', async () => {
    expect(await fetchDetail('u', parseQuestionsFile, respond(200, '<!doctype html><html></html>', 'text/html'))).toEqual({ status: 'missing' })
  })

  it('reports a file that is not JSON, with the reason', async () => {
    const r = await fetchDetail('u', parseQuestionsFile, respond(200, '{"collection": '))
    expect(r.status).toBe('invalid')
    if (r.status === 'invalid') expect(r.issues[0].path).toBe('(file)')
  })

  it('reports the field of a file that does not follow the schema', async () => {
    const r = await fetchDetail('u', parseQuestionsFile, respond(200, JSON.stringify({ collection: 'BIRD', db_id: 'db', subcategory: 'scope', source: 's' })))
    expect(r).toMatchObject({ status: 'invalid', issues: [{ path: 'questions' }] })
  })

  it('reports a file the disk or the network does not give', async () => {
    const failing = (async () => {
      throw new Error('offline')
    }) as typeof fetch
    const r = await fetchDetail('u', parseQuestionsFile, failing)
    expect(r).toMatchObject({ status: 'invalid', issues: [{ path: '(file)' }] })
  })
})
