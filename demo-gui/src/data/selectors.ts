import type { DemoData, Subcategory, TypeIdT } from './schema'

export interface SubcatInfo {
  sub: Subcategory
  categoryId: string
  categoryName: string
  type: TypeIdT
}

const cache = new WeakMap<DemoData, Map<string, SubcatInfo>>()

/** Every subcategory of the taxonomy by id, with its category and type. */
export const subcatIndex = (d: DemoData) => {
  let m = cache.get(d)
  if (!m) {
    m = new Map()
    for (const c of d.taxonomy.categories)
      for (const s of c.subcategories) m.set(s.id, { sub: s, categoryId: c.id, categoryName: c.name, type: c.type })
    cache.set(d, m)
  }
  return m
}

export const typeLabel = (d: DemoData, t: TypeIdT) => d.taxonomy.types.find((x) => x.id === t)?.label ?? t

export const dbById = (d: DemoData, id: string) => d.databases.find((x) => x.id === id)

export const agentById = (d: DemoData, id: string) => d.models.agents.find((a) => a.id === id)

export const shortModel = (name: string) => name.replace(/-Instruct.*$|-IT$|-FP8$/i, '').replace(/^NVIDIA-/, '')
