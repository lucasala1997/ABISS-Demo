import { useData } from '../data/context'
import { TYPE_STYLE, cx } from './styles'

/** The taxonomy as a tree: one row per type, its categories inside, the subcategories next to each category. */
export function TaxonomyTree() {
  const d = useData()
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      {d.taxonomy.types.map((t, i) => {
        const st = TYPE_STYLE[t.id]
        const categories = d.taxonomy.categories.filter((c) => c.type === t.id)
        return (
          <div key={t.id} className={cx('grid grid-cols-[9.5rem_minmax(0,1fr)]', i > 0 && 'border-t border-line')}>
            <div className={cx('flex items-center gap-1.5 border-l-4 px-3 py-2.5 font-bold', st.border, st.bg, st.text)}>
              <st.Icon className="size-4" aria-hidden /> {t.label}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-3 py-2.5">
              {categories.map((c) => {
                const subs = c.subcategories.filter((s) => s.name !== c.name)
                return (
                  <span key={c.id} className="text-[0.85rem]">
                    <b>{c.name}</b>
                    {subs.length > 0 && <span className="text-ink-3"> {subs.map((s) => s.name.toLowerCase()).join(' · ')}</span>}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
