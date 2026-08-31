import type { Metadata } from "next"
import { DocsShell, PageIntro } from "@/components/docs-shell"
import { CodeBlock } from "@/components/code-block"
import { Callout, H2, P, Table, Ul, Li } from "@/components/prose"
import { GlareHover } from "@/components/glare-hover"
import { SpotlightCard } from "@/components/spotlight-card"

export const metadata: Metadata = {
  title: "How verification works",
}

const tiles = [
  {
    id: "01",
    title: "Isolate",
    body: "A detached Git worktree holds the agent edits.",
  },
  {
    id: "03",
    title: "Repair",
    body: "A confirmed product FAIL comes back to the agent, bounded.",
  },
  {
    id: "04",
    title: "Evidence",
    body: "Each attempt stores Kane events, logs, and a workspace snapshot.",
  },
]

export default function VerificationPage() {
  return (
    <DocsShell current="/verification">
      <PageIntro
        title="We've locked the contract."
        accent="contract"
        lead="The task and Kane test are hashed before the run. Changing either one during implementation, repair, or Kane execution stops the run."
      />

      <div className="mb-14 grid gap-4 md:grid-cols-[1fr_1.2fr_1fr] md:items-stretch">
        <SpotlightCard>
          <article className="flex h-full min-h-[12rem] flex-col justify-between p-5">
            <h3 className="text-lg font-semibold">{tiles[0].title}</h3>
            <p className="font-mono text-5xl text-ink/15">{tiles[0].id}</p>
            <p className="text-sm text-muted">{tiles[0].body}</p>
          </article>
        </SpotlightCard>
        <GlareHover className="rounded-[1.25rem] border border-line bg-chrome">
          <article className="flex h-full min-h-[16rem] flex-col justify-between p-5">
            <div className="h-24 overflow-hidden rounded-xl">
              <img
                src="/wave.jpg"
                alt=""
                className="h-full w-full object-cover object-center"
              />
            </div>
            <h3 className="text-xl font-semibold tracking-tight">
              Kane decides
              <span className="text-accent"> pass or fail</span>
            </h3>
            <p className="text-sm text-muted">
              Structured Kane events map each acceptance criterion. An unmapped
              criterion stays UNVERIFIED and cannot produce VERIFIED.
            </p>
          </article>
        </GlareHover>
        <div className="grid gap-4">
          {tiles.slice(1).map((tile) => (
            <SpotlightCard key={tile.id}>
              <article className="flex min-h-[7.5rem] items-start justify-between p-5">
                <div>
                  <h3 className="font-semibold">{tile.title}</h3>
                  <p className="mt-1 text-sm text-muted">{tile.body}</p>
                </div>
                <p className="font-mono text-3xl text-ink/15">{tile.id}</p>
              </article>
            </SpotlightCard>
          ))}
        </div>
      </div>

      <H2>A normal run</H2>
      <Ul>
        <Li>Requires a clean Git worktree.</Li>
        <Li>
          Creates a detached worktree under
          `.elenchos/workspaces/&lt;run-id&gt;`.
        </Li>
        <Li>Sends the task to the configured agent in that worktree.</Li>
        <Li>Starts the application and waits for the configured URL.</Li>
        <Li>Runs `kane-cli testmd run &lt;test&gt; --agent`.</Li>
        <Li>Compares Git HEAD and working content before and after Kane.</Li>
        <Li>Repairs a confirmed product FAIL up to `maxRepairAttempts`.</Li>
        <Li>
          Removes the detached worktree after evidence capture unless you retain
          it.
        </Li>
      </Ul>

      <H2>Task format</H2>
      <P>
        A task needs an id, a title, and at least one acceptance criterion.
        Explicit criterion IDs map Kane observations back to the contract.
      </P>
      <CodeBlock
        label="demo/tasks/add-task.json"
        code={`{
  "id": "add-task",
  "title": "Add a task",
  "description": "A user can add a task from the main screen.",
  "acceptanceCriteria": [
    { "id": "AC-001", "description": "The task form is visible" },
    { "id": "AC-002", "description": "The new task appears in the list" }
  ],
  "verification": {
    "testFile": "tests/add-task_test.md"
  }
}`}
      />

      <H2>Run states</H2>
      <Table
        headers={["State", "Meaning"]}
        rows={[
          [
            "VERIFIED",
            "Kane completed the contract and the repository stayed stable.",
          ],
          [
            "FAILED",
            "Kane confirmed a product failure, or verify mode finished without a pass.",
          ],
          ["ERROR", "The verifier could not establish a product result."],
        ]}
      />

      <H2>Kane statuses inside an attempt</H2>
      <Table
        headers={["Status", "Meaning"]}
        rows={[
          [
            "PASS",
            "Structured Kane output passed, and every declared criterion mapped to pass.",
          ],
          ["FAIL", "Kane confirmed a product failure."],
          [
            "VERIFIER_ERROR",
            "Kane itself could not complete a trustworthy result.",
          ],
          [
            "INCONCLUSIVE",
            "The response was incomplete, contradictory, or unusable.",
          ],
        ]}
      />

      <Callout title="Verifier failure is not a product failure">
        An incomplete or contradictory Kane response does not become FAIL just
        because the process exited. Elenchos keeps those cases in ERROR or
        VERIFIER_ERROR so a repair loop is not fed garbage evidence.
      </Callout>

      <H2>Stability checks</H2>
      <Ul>
        <Li>Task JSON and Kane test hashes must match the pre-run contract.</Li>
        <Li>Git HEAD and working content must match across the Kane window.</Li>
        <Li>
          An overall Kane pass is accepted only when every criterion has a
          mapped pass.
        </Li>
      </Ul>
    </DocsShell>
  )
}
