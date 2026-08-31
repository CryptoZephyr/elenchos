import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export function ChromeFrame({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className="px-3 py-3 md:px-6 md:py-6">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[var(--z-sheet)] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-chrome"
      >
        Skip to content
      </a>
      <div className={cn("chrome overflow-hidden", className)}>
        <SiteHeader />
        <main id="content">{children}</main>
        <SiteFooter />
      </div>
    </div>
  )
}
