# Security policy

## Supported version

Security fixes currently target the latest release of Elenchos.

## Reporting a vulnerability

Please report vulnerabilities through GitHub's private security advisory form. Include the affected version, a short reproduction, and the impact you observed. Don't open a public issue for an unpatched vulnerability.

You should receive an initial response within five business days. We may ask for more detail while confirming the report and preparing a fix.

## Credential handling

Elenchos doesn't need Kane or coding-agent credentials in its repository configuration. Authenticate each CLI through its own login flow. Keep tokens, session files, `.env` files, `.elenchos`, and `.testmuai` data out of source control.
