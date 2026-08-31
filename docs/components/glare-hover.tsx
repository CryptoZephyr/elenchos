"use client"

import { useRef, type CSSProperties, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export function GlareHover({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const overlay = useRef<HTMLDivElement>(null)

  function enter() {
    const el = overlay.current
    if (!el) return
    el.style.transition = "none"
    el.style.backgroundPosition = "-100% -100%, 0 0"
    el.style.transition = "650ms cubic-bezier(0.32, 0.72, 0, 1)"
    el.style.backgroundPosition = "100% 100%, 0 0"
  }

  function leave() {
    const el = overlay.current
    if (!el) return
    el.style.transition = "650ms cubic-bezier(0.32, 0.72, 0, 1)"
    el.style.backgroundPosition = "-100% -100%, 0 0"
  }

  const overlayStyle: CSSProperties = {
    background:
      "linear-gradient(-45deg, transparent 60%, rgba(255,255,255,0.45) 70%, transparent 100%)",
    backgroundSize: "250% 250%, 100% 100%",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "-100% -100%, 0 0",
  }

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
      <div
        ref={overlay}
        className="pointer-events-none absolute inset-0"
        style={overlayStyle}
      />
      {children}
    </div>
  )
}
