import type { ReactNode } from "react"
import Link from "next/link"
import { DOCS } from "@/lib/site"
import { cn } from "@/lib/utils"

export function DocsShell({
  current,
  children,
}: {
  current: string
  children: ReactNode
}) {
  return (
    <div className="grid-field min-h-[70dvh]">
      <div className="mx-auto grid max-w-6xl gap-0 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-line bg-chrome/70 px-4 py-10 lg:block">
          <p className="px-3 pb-3 text-xs font-medium text-muted">Docs</p>
          <nav className="flex flex-col gap-1" aria-label="Documentation">
            {DOCS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm",
                  current === item.href
                    ? "bg-surface font-medium text-ink"
                    : "text-muted hover:bg-chrome hover:text-ink"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex gap-2 overflow-x-auto border-b border-line bg-chrome/60 px-5 py-3 lg:hidden">
          {DOCS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                current === item.href
                  ? "bg-ink text-chrome"
                  : "border border-line bg-chrome text-muted hover:text-ink"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="bg-chrome/40 px-5 py-10 md:px-10 md:py-14">
          {children}
        </div>
      </div>
    </div>
  )
}

export function PageIntro({
  title,
  accent,
  lead,
}: {
  title: string
  accent: string
  lead: string
}) {
  const pieces = title.split(accent)
  return (
    <header className="mb-12 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)] lg:items-end">
      <h1 className="max-w-[14ch] text-4xl font-semibold tracking-tight text-pretty md:text-5xl lg:text-[3.4rem] lg:leading-[1.08]">
        {pieces[0]}
        <span className="text-accent">{accent}</span>
        {pieces[1]}
      </h1>
      <p className="max-w-[38ch] text-base leading-relaxed text-muted">
        {lead}
      </p>
    </header>
  )
}
