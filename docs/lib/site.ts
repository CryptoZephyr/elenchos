export const SITE = {
  name: "Elenchos",
  tagline: "Independent proof for coding agents",
  description:
    "Elenchos gives an AI coding agent a task, isolates the work in a detached Git worktree, then asks Kane CLI to check the user flow in a real browser.",
  github: "https://github.com/CryptoZephyr/elenchos",
  npm: "https://www.npmjs.com/package/elenchos",
  license: "https://github.com/CryptoZephyr/elenchos/blob/main/LICENSE",
  version: "0.1.5",
} as const

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/quickstart", label: "Quickstart" },
  { href: "/verification", label: "Verification" },
  { href: "/kane", label: "Kane" },
  { href: "/mcp", label: "MCP" },
  { href: "/agents", label: "Agents" },
  { href: "/evidence", label: "Evidence" },
  { href: "/security", label: "Security" },
] as const

export const DOCS = NAV.filter((item) => item.href !== "/")

export const OUTCOMES = [
  {
    state: "VERIFIED",
    meaning:
      "Kane completed the locked contract and the repository stayed stable while Kane ran.",
  },
  {
    state: "FAILED",
    meaning:
      "Kane confirmed a product failure and repair attempts were exhausted, or you used verify mode.",
  },
  {
    state: "ERROR",
    meaning:
      "Elenchos could not establish a product result. Incomplete Kane output, a changed contract, a dirty worktree, or a startup failure land here. They are not product FAILs.",
  },
] as const

export const LOOP = [
  {
    id: "01",
    title: "Task",
    accent: "contract",
    body: "A JSON task with stable acceptance criteria and a Kane _test.md file. Both are hashed before the run.",
  },
  {
    id: "02",
    title: "Isolate",
    accent: "worktree",
    body: "The coding agent works in a detached Git worktree. It cannot mark criteria as passed.",
  },
  {
    id: "03",
    title: "Kane",
    accent: "browser",
    body: "Kane CLI runs the locked Functional test. Structured output is the only pass signal.",
  },
] as const
