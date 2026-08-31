import type { Metadata } from "next"
import { DocsShell, PageIntro } from "@/components/docs-shell"
import { Callout, H2, P, Ul, Li } from "@/components/prose"
import { SpotlightCard } from "@/components/spotlight-card"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Terms and Conditions",
}

export default function TermsPage() {
  return (
    <DocsShell current="/terms">
      <PageIntro
        title="Terms and Conditions."
        accent="Conditions"
        lead="Clear, straightforward rules governing the use of the Elenchos documentation website and open-source CLI software."
      />

      <SpotlightCard className="mb-12">
        <article className="grid gap-6 p-6 md:grid-cols-[12rem_minmax(0,1fr)] md:p-8">
          <h3 className="text-lg font-semibold tracking-tight">
            Open source license
          </h3>
          <p className="text-sm leading-relaxed text-muted">
            The Elenchos command-line tool is licensed under the terms of the
            MIT License. You are free to use, modify, distribute, and integrate
            it into your workflows subject to standard MIT conditions.
          </p>
        </article>
      </SpotlightCard>

      <H2>Use of the website and documentation</H2>
      <P>
        This website provides reference guides, architecture explanations, and
        documentation for Elenchos. We provide this material for informational
        purposes and strive to keep it accurate and up to date.
      </P>

      <H2>Local execution and user responsibility</H2>
      <P>
        Elenchos is a developer utility that runs commands and automation
        scripts on your host environment or CI runner:
      </P>
      <Ul>
        <Li>
          <strong>Environment control:</strong> You control the repositories,
          commands, task files, and coding agents that Elenchos executes.
        </Li>
        <Li>
          <strong>Worktree modifications:</strong> While Elenchos isolates tasks
          in detached Git worktrees, the executing agent runs with your local
          user permissions. You are responsible for ensuring agents operate
          safely in your environment.
        </Li>
        <Li>
          <strong>External dependencies:</strong> You are responsible for any
          costs, rate limits, or terms incurred by third-party services you use
          alongside Elenchos, including Kane and LLM agent providers.
        </Li>
      </Ul>

      <H2>Disclaimer of warranties</H2>
      <P>
        The software and documentation are provided &quot;as is&quot;, without
        warranty of any kind, express or implied, including but not limited to
        the warranties of merchantability, fitness for a particular purpose, and
        noninfringement.
      </P>

      <H2>Limitation of liability</H2>
      <P>
        In no event shall the authors or copyright holders be liable for any
        claim, damages, or other liability, whether in an action of contract,
        tort, or otherwise, arising from, out of, or in connection with the
        software or the use or other dealings in the software.
      </P>

      <Callout title="Open source repository">
        View the full license text and source code on GitHub at{" "}
        <a
          href={SITE.github}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-ink"
        >
          github.com/CryptoZephyr/elenchos
        </a>
        .
      </Callout>

      <H2>Modifications</H2>
      <P>
        We may update these terms to reflect changes in the software or
        documentation. Continued use of the documentation and tools constitutes
        acceptance of any revised terms.
      </P>
    </DocsShell>
  )
}
