import type { Metadata } from "next"
import { DocsShell, PageIntro } from "@/components/docs-shell"
import { Callout, H2, P, Ul, Li } from "@/components/prose"
import { SpotlightCard } from "@/components/spotlight-card"

export const metadata: Metadata = {
  title: "Security and trust boundaries",
}

export default function SecurityPage() {
  return (
    <DocsShell current="/security">
      <PageIntro
        title="The worktree is not a sandbox."
        accent="not a sandbox"
        lead="Elenchos runs a configured coding-agent command, starts a configured application, and passes the application URL to Kane. Treat the repository, agent, application, Kane account, and MCP client as untrusted until you review them."
      />

      <SpotlightCard className="mb-12">
        <article className="grid gap-6 p-6 md:grid-cols-[12rem_minmax(0,1fr)] md:p-8">
          <h3 className="text-lg font-semibold tracking-tight">
            Worktree isolation
          </h3>
          <p className="text-sm leading-relaxed text-muted">
            A detached Git worktree protects the verification contract from
            ordinary repository edits and gives each run a known code state. It
            does not restrict the coding agent&apos;s operating-system
            permissions. The agent can still reach files outside the worktree
            and the network.
          </p>
        </article>
      </SpotlightCard>

      <H2>Loopback and MCP</H2>
      <Ul>
        <Li>
          Application readiness URLs must use HTTP or HTTPS and point to
          localhost or a loopback address by default.
        </Li>
        <Li>
          Set `application.allowRemoteUrl` only for a remote target you trust.
        </Li>
        <Li>The local MCP server exposes read-only inspection by default.</Li>
        <Li>
          `elenchos_verify` requires an explicit enable flag and `confirm: true`
          on every call.
        </Li>
      </Ul>

      <H2>Credentials</H2>
      <Ul>
        <Li>
          Keep Kane, coding-agent, GitHub, npm, and other credentials in their
          own login or secret store.
        </Li>
        <Li>
          Never place them in `.elenchos/config.json`, task files, source, logs,
          planning files, or commits.
        </Li>
        <Li>
          Elenchos applies best-effort redaction to persisted output. Treat
          local evidence as sensitive anyway.
        </Li>
      </Ul>

      <H2>Untrusted agents and repositories</H2>
      <P>
        Use a container, virtual machine, or separate operating-system account
        when the agent or repository is not trusted. Elenchos v0.1.x should not
        be treated as a credential or host-isolation boundary.
      </P>

      <H2>MCP threat notes</H2>
      <Ul>
        <Li>
          Paths are confined to the configured repository with realpath checks.
        </Li>
        <Li>Task source paths are omitted from tool responses.</Li>
        <Li>
          Error messages replace the configured repository path with a
          placeholder.
        </Li>
        <Li>
          Enabling verify can start processes, make network requests, consume
          Kane credits, and write `.elenchos` evidence.
        </Li>
      </Ul>

      <H2>Maintainer Kane workflow</H2>
      <P>
        The maintainer Kane GitHub workflow is manual-only and uses a
        `kane-verification` environment that should require reviewer approval.
        Kane credentials are scoped to the credential check and authentication
        steps. They are not available to checkout, dependency installation, or
        pull request jobs.
      </P>

      <Callout title="Report a vulnerability privately">
        Use GitHub&apos;s private security advisory form. Include the affected
        version, a short reproduction, and the impact. Do not open a public
        issue for an unpatched vulnerability. Expect an initial response within
        five business days.
      </Callout>

      <H2>Supported version</H2>
      <P>
        Security fixes currently target the latest release of Elenchos. The npm
        package may lag the GitHub repository between releases. Check the
        package version before relying on a fix.
      </P>
    </DocsShell>
  )
}
