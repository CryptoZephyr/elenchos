import type { Metadata } from "next"
import { DocsShell, PageIntro } from "@/components/docs-shell"
import { CodeBlock } from "@/components/code-block"
import { Callout, H2, P, Ul, Li } from "@/components/prose"
import { SpotlightCard } from "@/components/spotlight-card"

export const metadata: Metadata = {
  title: "Evidence and example runs",
}

const timeline = [
  {
    label: "Attempt 1",
    status: "FAIL",
    body: "Kane confirmed the add action accepted the name but did not place the task in the list or update the count. AC-001, AC-002, and AC-003 mapped to FAIL.",
  },
  {
    label: "Repair 1",
    status: "Gemini",
    body: "Elenchos sent that structured product-failure evidence to AGY using Gemini. The agent changed only demo/target-app.mjs in the detached worktree.",
  },
  {
    label: "Attempt 2",
    status: "PASS",
    body: "Kane reran the unchanged _test.md contract. All three criteria mapped to PASS. The detached worktree was cleaned after evidence capture.",
  },
]

export default function EvidencePage() {
  return (
    <DocsShell current="/evidence">
      <PageIntro
        title="Every attempt leaves a record."
        accent="record"
        lead="Runs live under .elenchos/runs. The public evidence page is a sanitized FAIL to repair to PASS loop. Private Kane session bundles stay local."
      />

      <H2>Where evidence lives</H2>
      <CodeBlock
        label=".elenchos/runs/<run-id>/"
        code={`.elenchos/
└── runs/
    └── <run-id>/
        ├── run.json
        ├── attempts/
        │   ├── 01/
        │   │   ├── application.stdout.log
        │   │   ├── application.stderr.log
        │   │   ├── kane.stdout.ndjson
        │   │   └── kane.stderr.log
        │   └── ...
        └── workspace-evidence/`}
      />
      <P>
        Elenchos records state transitions, attempt metadata, Kane structured
        events, mapped criteria, screenshot or dashboard references when Kane
        reports them, and a workspace patch after a detached worktree run.
      </P>

      <H2>Closed-loop proof</H2>
      <P>
        Verified locally on August 20, 2026 with Kane CLI 0.8.4 and AGY 1.1.16
        using Gemini.
      </P>
      <div className="my-8 flex flex-col gap-4">
        {timeline.map((item) => (
          <SpotlightCard key={item.label}>
            <article className="grid gap-2 p-5 md:grid-cols-[8rem_6rem_minmax(0,1fr)] md:items-baseline">
              <h3 className="font-medium text-ink">{item.label}</h3>
              <p className="font-mono text-sm text-accent">{item.status}</p>
              <p className="text-sm leading-relaxed text-muted">{item.body}</p>
            </article>
          </SpotlightCard>
        ))}
      </div>
      <CodeBlock
        label="Public hashes"
        code={`Run status: VERIFIED
Attempts: 2
Changed file: demo/target-app.mjs
Baseline commit: eaa25ba6d727a45aa09194e4f13fdb9f7986af8c
Kane contract SHA-256: 3e6a018b105155ee470451b74e17ae74080f14dbcdfb8d6da4140835c84ab739
Verified diff SHA-256: 61fb47f7ccd6b50bc8b5157a501e957341f95e5ec5dfa2f50b3617477aeaf184`}
      />

      <H2>What is public, what is not</H2>
      <Ul>
        <Li>
          EVIDENCE.md in the repository is a sanitized summary with stable
          hashes.
        </Li>
        <Li>
          `.elenchos` and `.testmuai` stay out of Git and out of the npm
          package.
        </Li>
        <Li>Human summaries omit raw evidence paths.</Li>
        <Li>MCP status responses are redacted in the same way.</Li>
      </Ul>
      <Callout title="Redaction is best effort">
        Raw evidence can contain project details, local paths, or secrets
        printed in unexpected formats. Treat `.elenchos`, `.testmuai`, Kane
        evidence packs, and application logs as sensitive even after redaction.
      </Callout>

      <H2>Included demo</H2>
      <P>
        The repository ships a small Proofboard-style app. From a clean
        checkout:
      </P>
      <CodeBlock
        code={
          'npm install\nnpm run build\nnpm test\nnpx elenchos init --force --start "node demo/target-app.mjs" --url http://127.0.0.1:3000 --agent agy\nnpx elenchos run demo/tasks/add-task.json'
        }
      />
    </DocsShell>
  )
}
