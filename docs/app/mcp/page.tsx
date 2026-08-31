import type { Metadata } from "next"
import { DocsShell, PageIntro } from "@/components/docs-shell"
import { CodeBlock } from "@/components/code-block"
import { Callout, H2, P, Table, Ul, Li } from "@/components/prose"
import { SpotlightCard } from "@/components/spotlight-card"

export const metadata: Metadata = {
  title: "MCP integration",
}

const tools = [
  {
    name: "elenchos_inspect",
    role: "Read-only",
    body: "Inspect the repository, application candidates, agent candidates, and Kane readiness. Writes nothing.",
  },
  {
    name: "elenchos_load_task",
    role: "Read-only",
    body: "Load and normalize a repository-local task JSON file without exposing its absolute source path.",
  },
  {
    name: "elenchos_contract",
    role: "Read-only",
    body: "Return task and Kane test hashes for a repository-local contract. Does not run Kane.",
  },
  {
    name: "elenchos_status",
    role: "Read-only",
    body: "Read a sanitized run summary. Raw Kane output, local evidence paths, and credential-bearing fields are omitted.",
  },
  {
    name: "elenchos_verify",
    role: "Opt-in",
    body: "Run Kane against the current implementation. Disabled by default. Requires confirm: true. Does not launch a coding agent or edit source.",
  },
]

export default function McpPage() {
  return (
    <DocsShell current="/mcp">
      <PageIntro
        title="Local MCP, default read-only."
        accent="read-only"
        lead="The MCP server speaks stdio to a coding agent. Inspection and contract tools work before Kane login. Verification stays off until you opt in."
      />

      <H2>Start the server</H2>
      <CodeBlock code="node src/cli.mjs mcp --repo ." />
      <P>
        The process waits for the coding agent over stdio. Point the client at
        the same command, then restart the client.
      </P>
      <CodeBlock
        label="MCP client config"
        code={`{
  "mcpServers": {
    "elenchos": {
      "command": "node",
      "args": [
        "/path/to/elenchos/src/cli.mjs",
        "mcp",
        "--repo",
        "/path/to/project"
      ]
    }
  }
}`}
      />

      <H2>Tools</H2>
      <div className="mb-10 grid gap-4">
        {tools.map((tool) => (
          <SpotlightCard key={tool.name}>
            <article className="flex flex-col gap-2 p-5 md:flex-row md:items-baseline md:justify-between md:gap-8">
              <div>
                <h3 className="font-mono text-sm font-medium text-ink">
                  {tool.name}
                </h3>
                <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted">
                  {tool.body}
                </p>
              </div>
              <p className="shrink-0 font-mono text-xs text-accent">
                {tool.role}
              </p>
            </article>
          </SpotlightCard>
        ))}
      </div>

      <H2>Enable verification</H2>
      <P>
        `elenchos_verify` stays disabled unless local config sets
        `mcp.allowVerify` to true or the MCP process has
        `ELENCHOS_MCP_VERIFY_ENABLED=1`. Each call also requires `confirm:
        true`.
      </P>
      <Ul>
        <Li>It can start the configured application.</Li>
        <Li>It can make network requests and consume Kane credits.</Li>
        <Li>It writes `.elenchos` evidence.</Li>
        <Li>
          It never launches a coding agent or edits source files through MCP.
        </Li>
      </Ul>
      <Callout title="Review the command and URL first">
        Enable the verify tool only after you trust `application.start`,
        `application.url`, and the Kane contract. Repository-relative paths are
        required. Responses are redacted.
      </Callout>

      <H2>Doctor handshake</H2>
      <P>
        `elenchos doctor` performs a real stdio MCP child-process handshake and
        lists the registered tools. Basic MCP tools do not need Kane
        authentication or GitHub settings.
      </P>
      <CodeBlock code="npx elenchos doctor --repo ." />

      <H2>Maintainer GitHub Actions</H2>
      <P>
        `.github/workflows/verification.yml` belongs to the Elenchos maintainer
        repository. End users do not need those secrets to use MCP. The Kane job
        is manual-only and attached to a `kane-verification` environment.
      </P>
      <Table
        headers={["Setting", "Role"]}
        rows={[
          [
            "ELENCHOS_KANE_ENABLED",
            "Repository variable. Must be true for the Kane job.",
          ],
          ["KANE_USERNAME", "Secret, authentication step only."],
          ["KANE_ACCESS_KEY", "Secret, authentication step only."],
          ["KANE_PROJECT_ID", "Optional secret."],
          ["KANE_FOLDER_ID", "Optional secret."],
        ]}
      />
    </DocsShell>
  )
}
