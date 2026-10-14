import type { ReactNode } from 'react'

interface PanelProps {
  id: string
  title: string
  aside?: ReactNode
  children: ReactNode
}

/** The demo's .panel: a titled box on the page, with room in the head for a count or buttons. */
export function Panel({ id, title, aside, children }: PanelProps) {
  return (
    <section aria-labelledby={id} className="mb-5 rounded-md border border-line bg-paper">
      <div className="flex items-center justify-between gap-3 border-b border-line-2 px-[18px] py-3.5">
        <h2 id={id}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}
