"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { List, X, ArrowUpRight } from "@phosphor-icons/react"
import { NAV, SITE } from "@/lib/site"
import { cn } from "@/lib/utils"
import { Mark } from "@/components/mark"
import { Button, buttonVariants } from "@/components/ui/button"

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="relative z-[var(--z-header)] flex h-[var(--header)] items-center justify-between gap-4 border-b border-line px-5 md:px-8">
      <Link
        href="/"
        className="flex items-center gap-2.5 text-sm font-semibold tracking-tight"
      >
        <Mark />
        {SITE.name}
      </Link>

      <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-2.5 py-1.5 text-[13px] transition-colors",
                active ? "bg-surface text-ink" : "text-muted hover:text-ink"
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="flex items-center gap-2">
        <a
          href={SITE.github}
          target="_blank"
          rel="noreferrer"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "hidden sm:inline-flex"
          )}
        >
          GitHub
          <ArrowUpRight />
        </a>
        <Link href="/quickstart" className={buttonVariants({ size: "sm" })}>
          Install
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <List />}
          <span className="sr-only">Menu</span>
        </Button>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="absolute top-full right-0 left-0 z-[var(--z-sheet)] border-b border-line bg-chrome p-4 lg:hidden"
        >
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2 text-sm text-ink hover:bg-surface"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  )
}
