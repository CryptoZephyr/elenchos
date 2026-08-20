# Security policy

## Supported version

Security fixes currently target the latest release of Elenchos. The npm package may lag the GitHub repository between releases. Check the package version before relying on a fix.

## Trust boundary

Elenchos runs a configured coding-agent command, starts a configured application, and passes the application URL to a browser verifier. It has access to the local operating system and the repository. A repository, agent, application, Kane account, or MCP client should be treated as untrusted until you review it.

The local MCP server exposes read-only inspection tools by default. The `elenchos_verify` tool is disabled unless the local config sets `mcp.allowVerify` to `true` or the MCP process has `ELENCHOS_MCP_VERIFY_ENABLED=1`. Each call also requires `confirm: true`. Enabling it can start processes, make network requests, consume Kane credits, and write `.elenchos` evidence. Review `application.start`, `application.url`, and `verification` before enabling it.

Application readiness URLs must use HTTP or HTTPS and point to localhost or a loopback address by default. Set `application.allowRemoteUrl` only for a remote target you trust. Use a container, virtual machine, or separate operating-system account when the agent or repository is not trusted.

Keep Kane, coding-agent, GitHub, npm, and other credentials in their own supported login or secret store. Never place them in `.elenchos/config.json`, task files, source code, logs, planning files, or commits. Elenchos applies best-effort redaction to persisted output, so treat local evidence and application logs as sensitive even after redaction.

The maintainer Kane workflow is manual-only and uses a `kane-verification` environment that should require reviewer approval. Its Kane credentials are scoped to the credential check and authentication steps, and are not available to checkout, dependency installation, or pull request jobs.

## Reporting a vulnerability

Please report vulnerabilities through GitHub's private security advisory form. Include the affected version, a short reproduction, and the impact you observed. Don't open a public issue for an unpatched vulnerability.

You should receive an initial response within five business days. We may ask for more detail while confirming the report and preparing a fix.

## Credential handling

Elenchos doesn't need Kane or coding-agent credentials in its repository configuration. Authenticate each CLI through its own login flow. Keep tokens, session files, `.env` files, `.elenchos`, and `.testmuai` data out of source control.

Redaction covers common credential keys and text patterns, but it can't guarantee removal of every secret an application or agent may print. Treat local run evidence as sensitive.

## Threat boundary

A detached Git worktree protects the verification contract from ordinary repository edits and gives each run a known code state. It does not restrict the coding agent's operating-system permissions. The agent can still access anything allowed by its process credentials, including files outside the worktree and the network.

Use a separate container, virtual machine, or operating-system sandbox when running untrusted agents or repositories. Elenchos v0.1.x should not be treated as a credential or host-isolation boundary.
