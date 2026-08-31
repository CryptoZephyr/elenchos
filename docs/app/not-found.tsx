import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="grid-field flex min-h-[60dvh] flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">
        This page is not in the contract.
      </h1>
      <p className="mt-3 max-w-[40ch] text-muted">
        The docs cover install, verification, Kane, MCP, agents, evidence, and
        security.
      </p>
      <Link href="/" className={buttonVariants({ className: "mt-8" })}>
        Back to home
      </Link>
    </div>
  )
}
