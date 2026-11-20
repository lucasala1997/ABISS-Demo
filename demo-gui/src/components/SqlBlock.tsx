import hljs from 'highlight.js/lib/core'
import sql from 'highlight.js/lib/languages/sql'
import { useMemo } from 'react'
import { cx } from './styles'

hljs.registerLanguage('sql', sql)

/** SQL with syntax highlighting. highlight.js escapes the input, so visitor SQL is safe to render. */
export function SqlBlock({ sql: code, className, label }: { sql: string; className?: string; label?: string }) {
  const html = useMemo(() => hljs.highlight(code.trim(), { language: 'sql' }).value, [code])
  return (
    <figure className={cx('overflow-hidden rounded-lg border border-line bg-[var(--sql-bg)]', className)}>
      {label && (
        <figcaption className="border-b border-line px-3 py-1 text-[0.72rem] font-semibold tracking-wide text-ink-3 uppercase">
          {label}
        </figcaption>
      )}
      <pre className="sql px-3 py-2.5 break-words whitespace-pre-wrap font-mono text-[0.8rem] leading-relaxed text-ink">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </figure>
  )
}
