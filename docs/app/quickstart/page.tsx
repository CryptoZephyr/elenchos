import type { Metadata } from "next"
import { DocsShell, PageIntro } from "@/components/docs-shell"
import { CodeBlock } from "@/components/code-block"
import { Callout, H2, P, Ul, Li, C } from "@/components/prose"
import { SpotlightCard } from "@/components/spotlight-card"

export const metadata: Metadata = {
  title: "Quickstart",
}

const steps = [
  {
    title: "init",
    body: "Inspects the repository and writes .elenchos/config.json. Ambiguous start commands, URLs, or agents stay unresolved until you pass them.",
    code: "npx elenchos init",
  },
  {
    title: "author",
    body: "Sends the task to Kane generate --agent, then saves exactly one Functional _test.md file. Elenchos will not invent a test during a run.",
    code: "npx elenchos author demo/tasks/add-task.json --output demo/tests/add-task_test.md",
  },
  {
    title: "run",
    body: "Creates a detached worktree, sends the task to the agent, starts the app, and asks Kane to check the locked contract.",
    code: "npx elenchos run demo/tasks/add-task.json",
  },
]

export default function QuickstartPage() {
  return (
    <DocsShell current="/quickstart">
      <PageIntro
        title="Install and run."
        accent="run"
        lead="Start with a global CLI install. Kane login is only required when you want a real browser pass."
      />

      <CodeBlock code="npm install -g elenchos" />

      <H2>Requirements</H2>
      <Ul>
        <Li>Node.js 20 or newer</Li>
        <Li>Git</Li>
        <Li>
          A coding-agent CLI for a full run: agy, claude, gemini, or codex
        </Li>
        <Li>Kane CLI, authenticated, when you want browser verification</Li>
      </Ul>

      <H2>Confirm the binary</H2>
      <CodeBlock code="elenchos --help" />
      <P>
        Use <C>npx elenchos</C> if the global binary is not on PATH. Windows,
        macOS, and Linux are supported.
      </P>

      <H2>Doctor</H2>
      <P>
        Doctor reports MCP handshake status, project configuration, Kane
        install, authentication, credits, and the selected task or test. It does
        not start a run.
      </P>
      <CodeBlock code="npx elenchos doctor --repo . demo/tasks/add-task.json" />
      <P>
        Add <C>--json</C> for machine output. Add <C>--strict</C> when a script
        should fail unless Kane verification is ready.
      </P>

      <div className="my-10 grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <SpotlightCard
            key={step.title}
            className={
              index === 1
                ? "md:translate-y-6"
                : index === 2
                  ? "md:translate-y-12"
                  : ""
            }
          >
            <article className="flex h-full flex-col gap-3 p-5">
              <p className="font-mono text-sm text-accent">
                {index + 1}. {step.title}
              </p>
              <p className="text-sm leading-relaxed text-muted">{step.body}</p>
              <p className="mt-auto font-mono text-xs text-ink">{step.code}</p>
            </article>
          </SpotlightCard>
        ))}
      </div>

      <H2>Init with explicit choices</H2>
      <P>
        When init finds more than one start command, URL, or agent, pass the
        choice yourself and rerun with <C>--force</C>.
      </P>
      <CodeBlock code='npx elenchos init --force --start "npm run dev" --url http://127.0.0.1:5173 --agent agy' />

      <H2>Kane, only for real verification</H2>
      <CodeBlock
        code={
          "npm install -g @testmuai/kane-cli\nkane-cli login\nkane-cli whoami\nkane-cli balance"
        }
      />
      <Callout title="Credentials stay in Kane">
        Do not copy Kane, AGY, Gemini, Claude, Codex, GitHub, or npm secrets
        into <C>.elenchos/config.json</C>. Authenticate each tool through its
        own login.
      </Callout>

      <H2>Verify without an agent</H2>
      <P>
        Use verify when the code is already implemented and you want Kane to
        check the current worktree. This mode does not isolate a worktree or
        enter repair.
      </P>
      <CodeBlock code="npx elenchos verify demo/tasks/add-task.json" />

      <H2>Inspect a run</H2>
      <CodeBlock code="npx elenchos status <run-id>" />
      <P>
        The CLI exits successfully only when run or verify ends in VERIFIED.
      </P>
    </DocsShell>
  )
}
