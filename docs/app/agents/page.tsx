import type { Metadata } from "next"
import { DocsShell, PageIntro } from "@/components/docs-shell"
import { CodeBlock } from "@/components/code-block"
import { Callout, C, H2, P, Table, Ul, Li } from "@/components/prose"

export const metadata: Metadata = {
  title: "Agent configuration",
}

export default function AgentsPage() {
  return (
    <DocsShell current="/agents">
      <PageIntro
        title="AGY, Gemini, Claude, Codex."
        accent="Gemini"
        lead="Elenchos detects agy, claude, gemini, and codex on PATH. It does not store agent credentials. Authenticate each CLI yourself."
      />

      <H2>Supported launch model</H2>
      <Table
        headers={["Command", "Provider", "Default invocation"]}
        rows={[
          [
            "agy",
            "Gemini through AGY",
            "JSON output, accepted edits, isolated worktree access, 330s timeout",
          ],
          ["claude", "Claude", "Print mode, JSON output, accepted edits"],
          ["gemini", "Gemini", "Prompt mode"],
          ["codex", "Codex", "exec --full-auto"],
        ]}
      />
      <P>
        These defaults are starting points. Review each command&apos;s
        permission model before running it on a repository.
      </P>

      <H2>Placeholders</H2>
      <Ul>
        <Li>
          <C>{"{{prompt}}"}</C> becomes the implementation or repair prompt.
        </Li>
        <Li>
          <C>{"{{cwd}}"}</C> becomes the isolated worktree path.
        </Li>
      </Ul>
      <P>
        <C>agent.launchCwd</C> changes the directory used to start the agent.
        This is useful when an agent keeps authentication state per launch
        directory. The agent still receives <C>{"{{cwd}}"}</C> as its edit
        location.
      </P>

      <H2>AGY with Gemini on Windows</H2>
      <P>
        AGY can launch from a separately authenticated directory while{" "}
        <C>--add-dir {"{{cwd}}"}</C> grants access to the temporary worktree.
        That keeps launch-directory authentication without storing the session
        in the repository.
      </P>
      <CodeBlock
        label=".elenchos/config.json"
        code={`{
  "agent": {
    "provider": "gemini",
    "command": "agy",
    "args": [
      "--agent", "gemini",
      "--add-dir", "{{cwd}}",
      "--print", "{{prompt}}",
      "--output-format", "json",
      "--mode", "accept-edits",
      "--print-timeout", "300s"
    ],
    "timeoutMs": 330000
  }
}`}
      />
      <Callout title="Windows PowerShell shims">
        Elenchos can launch npm-installed coding-agent PowerShell shims without
        shell interpolation. Argument arrays are spawned directly. Do not put
        AGY or Gemini tokens in the config file.
      </Callout>

      <H2>What the agent is told</H2>
      <Ul>
        <Li>Work only in the isolated worktree.</Li>
        <Li>Keep acceptance criteria and the Kane test stable.</Li>
        <Li>
          Make the smallest production-quality change and run relevant local
          checks.
        </Li>
        <Li>
          Elenchos will decide verification status from Kane, not from the agent
          summary.
        </Li>
      </Ul>
      <P>
        A repair prompt includes structured Kane failure evidence and the repair
        attempt number. Authentication failures are reported as agent
        authentication failures. Refresh the agent&apos;s own credentials before
        retrying.
      </P>

      <H2>Select an agent at init</H2>
      <CodeBlock code="npx elenchos init --force --agent agy" />
      <P>
        Supported overrides are <C>agy</C>, <C>claude</C>, <C>gemini</C>, and{" "}
        <C>codex</C>. An unsupported value is rejected. If more than one CLI is
        on PATH, init keeps the choice visible instead of guessing.
      </P>
    </DocsShell>
  )
}
