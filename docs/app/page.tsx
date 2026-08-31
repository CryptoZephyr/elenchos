import Link from "next/link"
import { OUTCOMES, SITE } from "@/lib/site"
import { buttonVariants } from "@/components/ui/button"
import { HubLoop } from "@/components/hub-loop"
import { ThreeHeroMotion } from "@/components/three-hero-motion"
import { cn } from "@/lib/utils"

export default function HomePage() {
  return (
    <>
      <section className="grid-field relative overflow-hidden px-5 pt-12 pb-8 md:px-12 md:pt-16 md:pb-10">
        <ThreeHeroMotion />
        <div className="pointer-events-none absolute right-[-8%] bottom-[-18%] h-[28rem] w-[28rem] animate-ring-slow rounded-full border border-line opacity-60" />
        <div className="pointer-events-none absolute right-[-2%] bottom-[-28%] h-[38rem] w-[38rem] animate-ring-reverse rounded-full border border-line opacity-60" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h1 className="rise text-4xl font-semibold tracking-tight text-balance md:text-6xl md:leading-[1.08]">
            Independent <span className="text-accent">proof</span>
            <br />
            for coding agents
          </h1>
          <p className="rise rise-delay-1 mx-auto mt-5 max-w-[40ch] text-base leading-relaxed text-muted md:text-lg">
            Elenchos isolates the worktree, locks the Kane contract, and accepts
            a run only after Kane passes.
          </p>
          <div className="rise rise-delay-2 mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/quickstart" className={buttonVariants({ size: "lg" })}>
              Install
            </Link>
            <Link
              href="/verification"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      <HubLoop />

      <section className="border-t border-line px-5 py-16 md:px-12 md:py-20">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <h2 className="max-w-[12ch] text-3xl font-semibold tracking-tight md:text-4xl">
              Kane decides. The agent does not.
            </h2>
            <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-muted">
              Agent narration is useful context. It never becomes a pass.
              Elenchos reads Kane&apos;s structured output and the repository
              state.
            </p>
          </div>
          <dl className="flex flex-col">
            {OUTCOMES.map((item) => (
              <div
                key={item.state}
                className="grid gap-2 border-t border-line py-5 first:border-t-0 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-8"
              >
                <dt className="font-mono text-sm font-medium text-accent">
                  {item.state}
                </dt>
                <dd className="text-sm leading-relaxed text-muted">
                  {item.meaning}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-t border-line bg-surface px-5 py-16 md:px-12 md:py-20">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              What it does
            </h2>
            <ul className="mt-6 flex flex-col gap-3 text-sm leading-relaxed text-muted">
              <li>
                Runs an agent in a detached Git worktree for a normal run.
              </li>
              <li>Starts the target app and waits for a loopback URL.</li>
              <li>Executes a fixed Kane Functional _test.md contract.</li>
              <li>Rejects edits to the task or Kane test during the run.</li>
              <li>Sends a confirmed product FAIL back for a bounded repair.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              What it does not do
            </h2>
            <ul className="mt-6 flex flex-col gap-3 text-sm leading-relaxed text-muted">
              <li>It does not sandbox the agent from the operating system.</li>
              <li>It does not treat agent summaries as proof.</li>
              <li>
                It does not rewrite a failing Kane test during verification.
              </li>
              <li>
                It does not turn incomplete Kane output into a product FAIL.
              </li>
              <li>
                It does not host a service or replace Kane&apos;s own workflows.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 md:px-12 md:py-20">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 rounded-[1.5rem] bg-ink px-6 py-10 text-chrome md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Start on the machine that will run Kane.
            </h2>
            <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-chrome/70">
              Node 20+, Git, then npm install -g elenchos. Kane login is only
              required for real browser verification.
            </p>
          </div>
          <Link
            href="/quickstart"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "border-chrome/20 bg-transparent text-chrome hover:bg-chrome/10"
            )}
          >
            Open quickstart
          </Link>
        </div>
        <p className="mx-auto mt-6 max-w-5xl text-xs text-muted">
          {SITE.name} {SITE.version} on npm. MIT licensed.
        </p>
      </section>
    </>
  )
}
