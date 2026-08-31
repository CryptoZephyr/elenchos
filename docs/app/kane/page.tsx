import type { Metadata } from "next"
import { DocsShell, PageIntro } from "@/components/docs-shell"
import { CodeBlock } from "@/components/code-block"
import { Callout, H2, P, Ul, Li } from "@/components/prose"

export const metadata: Metadata = {
  title: "Kane CLI integration",
}

export default function KanePage() {
  return (
    <DocsShell current="/kane">
      <PageIntro
        title="Kane is the only verifier."
        accent="only"
        lead="Elenchos consumes Kane structured output. It never replaces Kane with a mock, and it never treats coding-agent narration as proof."
      />

      <H2>Install and authenticate</H2>
      <CodeBlock
        code={
          "npm install -g @testmuai/kane-cli\nkane-cli login\nkane-cli whoami\nkane-cli balance"
        }
      />
      <P>
        `whoami` and `balance` are readiness checks. Kane credentials stay in
        Kane&apos;s own local session. If the Kane shim is not on PATH, set
        `KANE_CLI_PATH` to the installed entry file.
      </P>

      <H2>Author a Functional test</H2>
      <P>
        Elenchos expects a stable Kane test as part of the verification
        contract. The author command uses Kane&apos;s structured generation
        flow.
      </P>
      <CodeBlock code="npx elenchos author path/to/task.json --output tests/feature_test.md" />
      <Ul>
        <Li>
          Sends the task and acceptance criteria to `kane-cli generate ...
          --agent`.
        </Li>
        <Li>
          Preserves Kane&apos;s scenarios, cases, request ID, and clarification
          state.
        </Li>
        <Li>Saves with `generate --save --req ... --agent`.</Li>
        <Li>
          Copies exactly one generated `_test.md` file to the output path.
        </Li>
      </Ul>
      <P>
        It stops when Kane saves no Functional test or more than one. That
        leaves the selection with you.
      </P>
      <CodeBlock code='npx elenchos author path/to/task.json --refine "Use the local task list page" --request-id <request-id> --output tests/feature_test.md' />

      <H2>Put criterion IDs in the Kane test</H2>
      <CodeBlock
        label="tests/add-task_test.md"
        code={`---
mode: testing
max_steps: 50
timeout: 60
target: chrome
headless: true
---

# Session: add-task

## AC-001 AC-002 Add and display a task
Go to http://127.0.0.1:3000, add a task named "Ship the invoice export", and assert that it is visible in the task list.`}
      />
      <P>
        Elenchos maps a criterion only when structured Kane events or the
        matching result step identify that criterion. A criterion that cannot be
        mapped remains UNVERIFIED.
      </P>

      <H2>How Elenchos runs Kane</H2>
      <P>
        During run or verify, Elenchos executes `kane-cli testmd run
        &lt;test&gt; --agent`, parses NDJSON events, classifies the outcome, and
        stores per-attempt stdout and stderr under `.elenchos/runs`.
      </P>
      <Ul>
        <Li>
          Failed or incomplete `test_md_done` events take precedence over inner
          `run_end` events.
        </Li>
        <Li>
          A timed-out run needs a confirmed product verdict before it can become
          FAIL.
        </Li>
        <Li>
          Credit, duration, screenshot, and dashboard fields are kept when Kane
          reports them.
        </Li>
        <Li>
          Credential-like strings are scrubbed before JSON is saved or returned.
        </Li>
      </Ul>

      <Callout title="No mock verifier">
        The real execution path always calls Kane. Incomplete Kane output is an
        ERROR, not a chance to invent a pass. Elenchos will not edit a failing
        test during verification to make the run green.
      </Callout>

      <H2>Larger requirement documents</H2>
      <P>
        For a PRD, use Kane&apos;s assurance flow, then hand Elenchos the
        accepted saved Functional test.
      </P>
      <CodeBlock
        code={
          "kane-cli context ingest ./PRD.md --mode agent\nkane-cli design tests --use-case <use-case-id> --mode agent\nkane-cli testmd run tests/feature_test.md --agent"
        }
      />
    </DocsShell>
  )
}
