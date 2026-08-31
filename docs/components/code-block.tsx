"use client"

import { useState } from "react"
import { Check, Copy } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

export function CodeBlock({
  code,
  label = "Terminal",
  className,
}: {
  code: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const highlighted = highlight(code)

  return (
    <figure
      className={cn(
        "overflow-hidden rounded-[1.25rem] border border-line bg-chrome",
        className
      )}
    >
      <figcaption className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span className="flex gap-1" aria-hidden="true">
            <span className="size-2 rounded-full bg-ink/15" />
            <span className="size-2 rounded-full bg-ink/15" />
            <span className="size-2 rounded-full bg-ink/15" />
          </span>
          {label}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-ink hover:bg-surface"
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-ink">
        <code>{highlighted}</code>
      </pre>
    </figure>
  )
}

function highlight(code: string) {
  const parts = code.split(/(\s+)/)
  return parts.map((part, index) => {
    if (
      part === "-g" ||
      part === "--force" ||
      part === "--json" ||
      part === "--strict"
    ) {
      return (
        <span key={index} className="text-accent">
          {part}
        </span>
      )
    }
    if (part === "$") {
      return (
        <span key={index} className="text-muted">
          {part}
        </span>
      )
    }
    return <span key={index}>{part}</span>
  })
}
