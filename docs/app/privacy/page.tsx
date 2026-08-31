import type { Metadata } from "next"
import { DocsShell, PageIntro } from "@/components/docs-shell"
import { Callout, H2, P, Ul, Li } from "@/components/prose"
import { SpotlightCard } from "@/components/spotlight-card"

export const metadata: Metadata = {
  title: "Privacy Policy",
}

export default function PrivacyPage() {
  return (
    <DocsShell current="/privacy">
      <PageIntro
        title="Privacy and data handling."
        accent="data handling"
        lead="Elenchos runs locally on your machine. We do not collect your source code, task files, agent prompts, or test results."
      />

      <SpotlightCard className="mb-12">
        <article className="grid gap-6 p-6 md:grid-cols-[12rem_minmax(0,1fr)] md:p-8">
          <h3 className="text-lg font-semibold tracking-tight">
            Local-first principle
          </h3>
          <p className="text-sm leading-relaxed text-muted">
            Elenchos is an open-source command-line tool. It does not run a
            central backend, does not collect telemetry, and does not store your
            project files on remote servers.
          </p>
        </article>
      </SpotlightCard>

      <H2>Documentation website</H2>
      <P>
        This documentation website is delivered as static pages. Like standard
        web hosts, the hosting infrastructure may record basic technical details
        in server logs (such as IP addresses, browser user agents, and requested
        URLs) to maintain site security.
      </P>
      <Ul>
        <Li>
          No tracking cookies, marketing pixels, or analytics trackers are used
          on this site.
        </Li>
        <Li>
          No personal profiles or visitor tracking databases are maintained.
        </Li>
        <Li>
          Your theme preference (light or dark mode) is stored locally in your
          browser.
        </Li>
      </Ul>

      <H2>CLI data flow</H2>
      <P>
        When you run Elenchos on your workstation or in CI, all operations
        happen inside your local environment:
      </P>
      <Ul>
        <Li>
          <strong>Repository files:</strong> Elenchos creates isolated Git
          worktrees on your local disk. Your source code never leaves your
          machine through Elenchos.
        </Li>
        <Li>
          <strong>Run artifacts:</strong> Evidence, command logs, and test
          output generated during verification are written to your local{" "}
          <code className="font-mono text-[0.92em] text-ink">
            .elenchos/runs
          </code>{" "}
          folder.
        </Li>
        <Li>
          <strong>Configuration:</strong> Project settings in{" "}
          <code className="font-mono text-[0.92em] text-ink">
            .elenchos/config.json
          </code>{" "}
          remain on your local disk.
        </Li>
      </Ul>

      <H2>Third-party tools and services</H2>
      <P>
        Elenchos coordinates with external tools that you configure. These tools
        operate under their own privacy policies:
      </P>
      <Ul>
        <Li>
          <strong>Kane CLI:</strong> When Kane runs browser verification,
          requests and test execution data pass through Kane CLI according to
          your Kane account settings.
        </Li>
        <Li>
          <strong>Coding Agents:</strong> Any coding agent CLI (such as Claude
          Code, Codex, or custom tools) communicates with its respective API
          provider using your credentials.
        </Li>
        <Li>
          <strong>Package Registries:</strong> Installing Elenchos via npm
          connects directly to npm registry infrastructure.
        </Li>
      </Ul>

      <H2>Credentials and API keys</H2>
      <P>
        Elenchos never asks you to submit API keys or credentials to a remote
        Elenchos service. Store your Kane and agent keys in environment
        variables or your system credential manager.
      </P>

      <Callout title="Questions and reports">
        For privacy questions or security reports, open an issue or private
        advisory on GitHub at{" "}
        <a
          href="https://github.com/CryptoZephyr/elenchos"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-ink"
        >
          github.com/CryptoZephyr/elenchos
        </a>
        .
      </Callout>

      <H2>Policy updates</H2>
      <P>
        If we update how the documentation site or tool handles data, changes
        will be published directly in this repository.
      </P>
    </DocsShell>
  )
}
