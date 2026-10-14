import type { ReactNode } from 'react'

/** Brand panel plus a centred card: the layout of the sign-in and reset pages (from the demo's login). */
export function AuthLayout({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] max-[860px]:grid-cols-[minmax(0,1fr)]">
      <div className="flex flex-col justify-between gap-10 bg-graphite p-11 text-white max-[860px]:gap-4 max-[860px]:p-6">
        <div>
          <h1 className="mb-3.5 text-[44px] text-white max-[860px]:text-[30px]">Platform console</h1>
          <p className="max-w-[36ch] text-base text-graphite-text">
            Create and manage tenants, plans, billing, SMS, and support access.
          </p>
        </div>
        <p className="text-[13px] text-graphite-muted">Staff only. Everything you do is recorded.</p>
      </div>
      <main className="flex flex-col items-center justify-center gap-8 px-8 py-11 max-[860px]:px-4 max-[860px]:py-6">
        <div className="w-[min(440px,100%)] rounded-lg border border-line bg-paper p-7">
          <h2 className="mb-1 font-display text-[28px] font-medium">{heading}</h2>
          {children}
        </div>
      </main>
    </div>
  )
}
