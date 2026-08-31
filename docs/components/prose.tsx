import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-12 mb-3 text-2xl font-semibold tracking-tight text-ink first:mt-0">
      {children}
    </h2>
  )
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 max-w-[68ch] text-base leading-relaxed text-muted">
      {children}
    </p>
  )
}

export function Ul({ children }: { children: ReactNode }) {
  return (
    <ul className="mb-6 flex max-w-[68ch] list-disc flex-col gap-2 pl-5 text-base leading-relaxed text-muted">
      {children}
    </ul>
  )
}

export function Li({ children }: { children: ReactNode }) {
  return <li>{children}</li>
}

export function C({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.92em] text-ink">{children}</code>
}

export function Callout({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <aside className="my-8 rounded-[1.25rem] border border-line bg-accent-soft/60 px-5 py-4">
      <p className="text-sm font-medium text-ink">{title}</p>
      <div className="mt-1 text-sm leading-relaxed text-muted">{children}</div>
    </aside>
  )
}

export function Table({
  headers,
  rows,
}: {
  headers: string[]
  rows: string[][]
}) {
  return (
    <div className="my-8 overflow-x-auto rounded-[1.25rem] border border-line bg-chrome">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-medium text-ink">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-line last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cn(
                    "px-4 py-3 align-top leading-relaxed text-muted",
                    cellIndex === 0 && "font-mono text-ink"
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
