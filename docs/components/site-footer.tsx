import Link from "next/link"
import { Mark } from "@/components/mark"

export function SiteFooter() {
  return (
    <footer className="flex flex-col gap-3 border-t border-line px-5 py-6 text-sm text-muted md:flex-row md:items-center md:justify-between md:px-8">
      <div className="flex items-center gap-2.5">
        <Mark className="size-6 shrink-0 rounded-md p-1" />
        <p>
          Elenchos is a local CLI. Kane is the independent browser verifier.
        </p>
      </div>
      <nav className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/privacy" className="hover:text-ink">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:text-ink">
          Terms and Conditions
        </Link>
      </nav>
    </footer>
  )
}
