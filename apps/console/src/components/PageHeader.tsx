import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-[22px] flex flex-wrap items-end justify-between gap-6">
      <div>
        <h1>{title}</h1>
        {description ? <p className="mt-1.5 max-w-[62ch] text-ink-2">{description}</p> : null}
      </div>
      {actions}
    </div>
  )
}
