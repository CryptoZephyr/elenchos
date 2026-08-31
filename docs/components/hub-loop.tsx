import { LOOP } from "@/lib/site"
import { SpotlightCard } from "@/components/spotlight-card"
import { cn } from "@/lib/utils"

export function HubLoop() {
  const floatClasses = ["animate-float-1", "animate-float-2", "animate-float-3"]

  return (
    <section className="relative overflow-hidden px-5 py-16 md:px-10 md:py-24">
      <div className="rings pointer-events-none absolute inset-0 animate-rings opacity-80" />
      <div className="relative mx-auto grid max-w-5xl gap-6 md:grid-cols-3 md:gap-8">
        {LOOP.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              index === 1
                ? "md:translate-y-8"
                : index === 2
                  ? "md:translate-y-2"
                  : ""
            )}
          >
            <div
              className={cn(
                "h-full transition-transform",
                floatClasses[index % floatClasses.length]
              )}
            >
              <SpotlightCard className="h-full">
                <article className="flex min-h-[11rem] flex-col justify-between p-5">
                  <p className="font-mono text-xs text-muted">{step.id}</p>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-semibold tracking-tight">
                      {step.title}
                      &nbsp;
                      <span className="font-medium text-accent">
                        {step.accent}
                      </span>
                    </h3>
                    <p className="max-w-[34ch] text-sm leading-relaxed text-muted">
                      {step.body}
                    </p>
                  </div>
                </article>
              </SpotlightCard>
            </div>
          </div>
        ))}
      </div>
      <div className="relative mt-10 flex justify-center">
        <div className="animate-float-1">
          <p className="inline-flex items-center rounded-full border border-ink/10 bg-chrome px-4 py-2 text-sm font-medium shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            <span className="mr-2 inline-flex size-4 items-center justify-center rounded-full bg-accent text-[10px] text-chrome">
              ✓
            </span>
            VERIFIED
          </p>
        </div>
      </div>
    </section>
  )
}
