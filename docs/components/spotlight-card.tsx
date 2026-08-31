"use client"

import { useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export function SpotlightCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [opacity, setOpacity] = useState(0)

  return (
    <div
      ref={ref}
      onMouseMove={(event) => {
        const rect = ref.current?.getBoundingClientRect()
        if (!rect) return
        setPosition({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        })
      }}
      onMouseEnter={() => setOpacity(0.7)}
      onMouseLeave={() => setOpacity(0)}
      className={cn(
        "relative overflow-hidden rounded-[1.25rem] border border-line bg-chrome",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          opacity,
          background: `radial-gradient(circle at ${position.x}px ${position.y}px, rgba(28, 122, 116, 0.16), transparent 70%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}
