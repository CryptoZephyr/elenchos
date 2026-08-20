# Security policy

## Supported version

Security fixes currently target the latest release of Elenchos.

## Reporting a vulnerability

Please report vulnerabilities through GitHub's private security advisory form. Include the affected version, a short reproduction, and the impact you observed. Don't open a public issue for an unpatched vulnerability.

You should receive an initial response within five business days. We may ask for more detail while confirming the report and preparing a fix.

## Credential handling

Elenchos doesn't need Kane or coding-agent credentials in its repository configuration. Authenticate each CLI through its own login flow. Keep tokens, session files, `.env` files, `.elenchos`, and `.testmuai` data out of source control.

Redaction covers common credential keys and text patterns, but it can't guarantee removal of every secret an application or agent may print. Treat local run evidence as sensitive.

## Threat boundary

A detached Git worktree protects the verification contract from ordinary repository edits and gives each run a known code state. It does not restrict the coding agent's operating-system permissions. The agent can still access anything allowed by its process credentials, including files outside the worktree and the network.

Use a separate container, virtual machine, or operating-system sandbox when running untrusted agents or repositories. Elenchos v0.1.x should not be treated as a credential or host-isolation boundary.
