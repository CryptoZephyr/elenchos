# Elenchos

Elenchos is a local verification loop for AI coding agents. It gives an agent a task, lets it implement or repair that task in an isolated Git worktree, then asks Kane CLI to check the user flow in a real browser.

The run is accepted only when the fixed task contract and Kane test are unchanged, the code state stays stable while Kane is running, and Kane produces a usable result.

- [GitHub repository](https://github.com/CryptoZephyr/elenchos)
- [npm package](https://www.npmjs.com/package/elenchos)
- [MIT license](LICENSE)
- [Security policy](SECURITY.md)
- [Recorded closed-loop evidence](EVIDENCE.md)

The current published version is 0.1.2. The repository also contains the next MCP onboarding improvements, which are not in the published package yet. Elenchos was built for the Kane CLI online hackathon and uses the real Kane CLI flow. It does not replace Kane with a mock verifier.

## Why it exists

An agent can report that a feature is complete while the browser flow still fails. Elenchos separates implementation from verification:

    task JSON
        |
        v
    isolated Git worktree -> coding agent -> application
                                          |
                                          v
                                  Kane browser test
                                          |
                        +-----------------+-----------------+
                        |                                   |
                     product FAIL                       product PASS
                        |                                   |
                        v                                   v
                 bounded repair                       verified code state

The agent's summary is useful context, but it never decides whether the run passed. Elenchos makes that decision from Kane's structured output and from repository-state checks.

## What Elenchos does

- Detects common project types, application start commands, local URL candidates, available agent CLIs, and Kane readiness during init.
- Keeps ambiguous project choices visible instead of guessing between multiple commands or agents.
- Runs an implementation agent in a detached Git worktree for a normal run.
- Starts the target application and waits for its configured URL to return successfully.
- Runs a fixed Kane Functional _test.md contract with structured output.
- Hashes the normalized task and Kane test before the run and rejects changes to either one.
- Compares Git HEAD and working content before and after browser verification.
- Sends confirmed product-failure evidence to the agent for a bounded repair loop.
- Records application logs, Kane output, status transitions, criterion observations, and workspace evidence under .elenchos/runs.
- Removes detached worktrees after evidence capture unless you ask to retain one.

## What it does not do

- It does not sandbox an agent from the operating system.
- It does not make a dirty worktree safe for run.
- It does not hand-write a Kane test during verification.
- It does not treat agent narration as proof.
- It does not turn an incomplete Kane response into a product failure.
- It does not provide a hosted service, a multi-agent comparison report, GitHub comments, or a replacement for Kane's own assurance workflows.

Use a container, virtual machine, or other operating-system boundary when the repository or agent is not trusted. See [SECURITY.md](SECURITY.md) for the threat boundary.

## Requirements

- Node.js 20 or newer
- Git

The basic MCP tools work without a Kane account, GitHub configuration, or coding-agent CLI. Kane authentication and credits are required only when you run real browser verification. A full agent run also needs one supported coding-agent CLI:

    agy
    claude
    gemini
    codex

A full verification run needs a local application that can be started by a command, a URL to check, and a Kane Functional test whose filename ends in _test.md.

Elenchos runs on Windows, macOS, and Linux. On Windows, AGY is configured to launch from the authenticated system directory when that directory is available. The isolated worktree is passed to AGY through {{cwd}} so the launch location and edit location can be different.

## Install

Install the published CLI:

    npm install -g elenchos
    elenchos --help

The published package is currently 0.1.2. To use the current MCP and doctor source before the next npm release, work from a repository checkout:

    npm install
    npm run doctor -- --repo .

Install and authenticate Kane only when you want real browser verification:

    npm install -g @testmuai/kane-cli
    kane-cli login
    kane-cli whoami
    kane-cli balance

whoami and balance are useful readiness checks before the first Elenchos run. Kane credentials stay in Kane's own local session. Do not copy them into an Elenchos config file or repository.

Install the official Kane coding-agent skill only when you want Kane to author or debug browser tests from an agent workflow:

    npx @testmuai/kane-cli-skill

Authenticate the coding agent through its own CLI. Elenchos detects supported commands on PATH, but it does not create or store agent credentials.

## Quick start

### Basic MCP onboarding

Run these commands inside the repository that the coding agent will inspect:

    npm install
    npm run doctor -- --repo .
    node src/cli.mjs mcp --repo .

The MCP process waits for the coding agent over stdio. Configure the client to launch the same command, then restart the client. The read-only inspection and contract tools are available before Kane login.

The doctor command reports MCP handshake status, project configuration, Kane installation and authentication, available credits, and task or Kane test files. Pass a task path when you want the contract checked too:

    npm run doctor -- --repo . demo/tasks/add-task.json

Use --json for machine-readable output. Use --strict when a script should fail unless Kane verification is ready.

### Full Kane verification

After the basic MCP setup, run these commands when you want the agent and Kane loop:

    elenchos init
    elenchos author path/to/task.json --output path/to/feature_test.md
    elenchos run path/to/task.json
    elenchos status <run-id>

Use npx elenchos in place of elenchos after the next npm release includes the MCP and doctor commands.

### 1. Initialize the repository

init inspects the repository and writes .elenchos/config.json. It also adds .elenchos/ and .testmuai/ to the repository's local Git exclude file. Those entries stay local to the checkout and do not change the shared .gitignore.

    npx elenchos init

The command reports:

- detected project type;
- application start candidates;
- local URL candidates;
- detected coding-agent CLIs;
- Kane installation and authentication readiness;
- values that still need an explicit choice.

When there is more than one possible value, pass the choice yourself and rerun with --force:

    npx elenchos init --force --start "npm run dev" --url http://127.0.0.1:5173 --agent agy

The supported agent overrides are agy, claude, gemini, and codex. An unsupported value is rejected.

### 2. Author a Kane test

Elenchos expects a stable Kane test to be part of the verification contract. The optional author command uses Kane's structured generation flow to create that test:

    npx elenchos author path/to/task.json --output tests/feature_test.md

The command:

1. sends the task and its acceptance criteria to kane-cli generate ... --agent;
2. preserves Kane's structured scenarios, cases, request ID, and clarification state;
3. asks Kane to save the generated Functional test with generate --save --req ... --agent;
4. copies exactly one generated _test.md file to the requested output path.

It stops when Kane saves no Functional test or more than one. That leaves the selection decision with you instead of silently choosing a test.

If Kane asks a clarification, continue the same request:

    npx elenchos author path/to/task.json --refine "Use the local task list page" --request-id <request-id> --output tests/feature_test.md

--refine requires the request ID returned by the earlier authoring result. An existing test is preserved unless you pass --force.

For larger requirement documents, use Kane's assurance flow to ingest the requirements and design tests, then give Elenchos the accepted saved Functional test:

    kane-cli context ingest ./PRD.md --mode agent
    kane-cli design tests --use-case <use-case-id> --mode agent
    kane-cli testmd run tests/feature_test.md --agent

The verification path still requires a saved _test.md contract. Elenchos will not create one by editing a failing test during a run.

### 3. Run the implementation and verification loop

    npx elenchos run path/to/task.json

For a normal run, Elenchos:

1. requires the current Git worktree to be clean;
2. creates a detached worktree under .elenchos/workspaces/<run-id>;
3. sends the task to the configured agent in that worktree;
4. checks that the task and Kane test were not changed;
5. starts the application and waits for the configured URL;
6. runs kane-cli testmd run <test> --agent;
7. compares repository state before and after Kane verification;
8. repairs a confirmed product failure up to maxRepairAttempts;
9. preserves evidence and removes the detached worktree by default.

If verification.verifyBeforeImplement is true, the first Kane run checks the baseline before the implementation step. This is useful for a demo that intentionally starts with a known defect.

### 4. Verify an existing implementation

Use verify when the code is already implemented and you want Kane to check it without sending it to an agent:

    npx elenchos verify path/to/task.json

verify runs against the current repository state. It does not create an isolated worktree, implement code, or enter a repair loop. This makes it useful for checking a candidate change before you commit it.

### 5. Inspect a run

The normal output includes the run ID, agent, status, attempts, Kane summary, actions, URLs, credit information when Kane reports it, evidence availability, and criterion-level results.

    npx elenchos status <run-id>
    npx elenchos status <run-id> --json

Use --json with run, verify, and author when another tool needs the structured record.

## Run outcomes

The run state is one of the following:

| State | Meaning |
| --- | --- |
| VERIFIED | Kane completed the contract successfully and the repository state stayed stable during verification. |
| FAILED | Kane confirmed a product failure and the allowed repair attempts were exhausted, or the run was verify mode. |
| ERROR | The verifier could not establish a product result. This includes missing structured output, incomplete TestMD output, application startup failure, cancellation, timeout without a confirmed product verdict, authentication failure, and a changed contract or repository state. |

Inside an attempt, Kane results can be PASS, FAIL, VERIFIER_ERROR, or INCONCLUSIVE. Elenchos keeps verifier failures separate from product failures. An incomplete or contradictory Kane response does not become a product FAIL just because the process exited.

The CLI exits successfully only when run or verify ends in VERIFIED. author exits successfully only when Kane authoring completes and one Functional test is saved.

## Task format

A task needs an ID, a title, and at least one acceptance criterion. Use explicit criterion IDs so Kane observations can be mapped back to the task:

    {
      "id": "add-task",
      "title": "Add a task",
      "description": "A user can add a task from the main screen.",
      "setup": [
        "Start the local application"
      ],
      "preconditions": {
        "page": "/"
      },
      "acceptanceCriteria": [
        {
          "id": "AC-001",
          "description": "The task form is visible"
        },
        {
          "id": "AC-002",
          "description": "The new task appears in the list"
        }
      ],
      "verification": {
        "testFile": "tests/add-task_test.md"
      }
    }

acceptanceCriteria can contain strings, and Elenchos will assign AC-001, AC-002, and so on. Explicit IDs are better for long-lived contracts. Duplicate IDs are rejected.

setup and preconditions are kept in the normalized task, included in the agent prompt, and hashed into the verification contract. verification.testFile must point to an existing file ending in _test.md. If the task does not set it, Elenchos can use verification.testFile from the local config.

## Kane test format

The test file is a normal Kane Functional test. Put each criterion ID in the matching step heading or step text:

    ---
    mode: testing
    max_steps: 50
    timeout: 60
    target: chrome
    headless: true
    ---

    # Session: add-task

    ## AC-001 AC-002 Add and display a task
    Go to http://127.0.0.1:3000, add a task named "Ship the invoice export", and assert that it is visible in the task list.

Elenchos maps a criterion only when structured Kane events or the matching result step identify that criterion. A criterion that cannot be mapped remains UNVERIFIED.

The task and test are hashed before the run. Changing either file during implementation, repair, or browser verification stops the run.

## Configuration

init creates .elenchos/config.json. The repository includes a credential-free [config.example.json](config.example.json) with the main fields:

    {
      "repository": ".",
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
      },
      "application": {
        "start": "npm run dev",
        "url": "http://127.0.0.1:5173",
        "readinessTimeoutMs": 60000,
        "env": {}
      },
      "verification": {
        "maxRepairAttempts": 2,
        "verifyBeforeImplement": false,
        "retainWorkspace": false,
        "timeoutSeconds": 300,
        "headless": true
      }
    }

### Repository

repository selects the target repository relative to the directory where the command runs. The default is .

### Agent

agent.command is the CLI to launch. agent.args accepts two placeholders:

- {{prompt}} becomes the implementation or repair prompt;
- {{cwd}} becomes the isolated worktree path.

agent.launchCwd changes the directory used to start the agent. This is useful when an agent keeps authentication state per launch directory. The agent still receives {{cwd}} as its edit location.

The default configurations are:

| Detected command | Provider | Default invocation |
| --- | --- | --- |
| agy | Gemini through AGY | JSON output, accepted edits, isolated worktree access, 330 second timeout |
| claude | Claude | Print mode, JSON output, accepted edits |
| gemini | Gemini | Prompt mode |
| codex | Codex | exec --full-auto |

The defaults are starting points. Review the command's own permission model before running it on a repository.

### Application

application.start can be a command string or an argument array. It runs from the verification workspace. application.url is polled until it returns a successful response or the readiness timeout expires.

application.env is passed to the application process. Keep secrets in the local configuration or environment, never in a committed example. Application stdout and stderr are saved per attempt and receive best-effort redaction before persistence.

### Verification

- command can point to a Kane executable or JavaScript entry file.
- maxRepairAttempts is an integer from 0 through 10. The default is 2.
- verifyBeforeImplement runs the baseline check before the implementation step.
- retainWorkspace leaves the detached worktree in place for inspection.
- timeoutSeconds is passed to Kane. The detected demo config uses 300 seconds.
- headless is enabled unless set to false.
- testFile can provide a fallback Kane test path when the task does not include one.

If the Kane command shim is not on PATH, set KANE_CLI_PATH to the installed Kane entry file. Elenchos also checks the global Kane package and has an npx fallback for readiness detection.

Do not put Kane, AGY, Gemini, Claude, Codex, GitHub, or npm credentials in this file. Authenticate each tool through its own supported login flow.

## Evidence and local state

Each run is stored at:

    .elenchos/
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
            └── workspace-evidence/

The exact contents vary by run. Elenchos records state transitions, attempt metadata, Kane structured events, mapped criteria, screenshots or dashboard references when Kane reports them, and a workspace patch and manifest after a detached worktree run.

Raw evidence can contain project details, local paths, or secrets printed in unexpected formats. Elenchos redacts common credential keys and patterns, but the redaction is best effort. Treat .elenchos, .testmuai, Kane evidence packs, and application logs as sensitive. They are excluded from the Git index and from the npm package.

The public [EVIDENCE.md](EVIDENCE.md) contains a sanitized record of a local FAIL to repair to PASS loop. It does not contain the private Kane session bundle.

## Supported agent launch model

The implementation agent receives a prompt that says to work only in the isolated worktree, keep acceptance criteria and the Kane test stable, and run relevant local checks. A repair prompt includes structured Kane failure evidence and the repair attempt number.

Elenchos checks agent process failures and structured error output. Authentication failures are reported as agent authentication failures. Refresh the agent's own credentials before retrying. Elenchos does not log a replacement token or attempt to bypass authentication.

On Windows, AGY can be launched from a separately authenticated directory while --add-dir {{cwd}} grants access to the temporary worktree. This handles launch-directory-specific authentication without storing that session in the repository.

## Demo

The repository includes a small Proofboard-style app and task. The demo can start with a deterministic browser-visible defect when initialized as the Elenchos demo fixture. Kane checks the fixed contract, the agent receives the structured failure, and a bounded repair can be verified against the same contract.

From a clean checkout:

    npm install
    npm run build
    npm test
    npx elenchos init --force --start "node demo/target-app.mjs" --url http://127.0.0.1:3000 --agent agy
    npx elenchos run demo/tasks/add-task.json

The included task is demo/tasks/add-task.json and its Kane contract is demo/tests/add-task_test.md. To check the current implementation without an agent:

    npx elenchos verify demo/tasks/add-task.json

The demo's application process is managed by Elenchos during a run. You can also start it directly with npm run demo when you want to inspect the target app by itself.

## Architecture

Elenchos is a local Node.js CLI. It has no application backend and does not host a verification service.

| Module | Responsibility |
| --- | --- |
| src/cli.mjs | Parses commands, flags, JSON output, and process cancellation. |
| src/config.mjs | Detects project choices, writes local config, and checks Kane readiness. |
| src/task.mjs and src/domain.mjs | Loads tasks, normalizes criteria, and enforces run states. |
| src/author.mjs | Consumes Kane's structured test-authoring flow and saves one selected Functional test. |
| src/contract.mjs | Hashes the task and Kane test and detects contract changes. |
| src/orchestrator.mjs | Coordinates worktrees, the agent, application lifecycle, Kane, repairs, and cleanup. |
| src/kane.mjs | Runs Kane, parses structured events, classifies outcomes, and maps criterion evidence. |
| src/mcp-server.mjs | Exposes repository inspection, contract, run status, and explicit verification tools over local stdio MCP. |
| src/doctor.mjs | Checks MCP handshake, project setup, Kane readiness, credits, and task or test files. |
| src/workspace.mjs | Captures Git state, writes workspace evidence, and safely removes detached worktrees. |
| src/report.mjs | Prints human-readable and JSON run summaries. |

## Development

Clone the repository, install dependencies, and run the checks:

    git clone https://github.com/CryptoZephyr/elenchos.git
    cd elenchos
    npm install
    npm run build
    npm test
    npm audit --omit=dev
    npm pack --dry-run

The package scripts are:

| Command | Purpose |
| --- | --- |
| npm run build | Checks source syntax. |
| npm test | Runs the Node test suite with coverage. |
| npm run demo | Starts the included demo application. |
| npm run doctor -- --repo . | Checks basic MCP setup and optional Kane verification readiness. |
| npm run mcp -- --repo . | Starts the local stdio MCP server for the selected repository. |
| npm run proof | Runs the demo task through Elenchos using the local config. |
| npm audit --omit=dev | Checks production dependency vulnerabilities. |
| npm pack --dry-run | Previews the public npm package contents. |

Before committing a change, check the public boundary:

    git diff --check
    git status --short --ignored
    git diff --cached --name-status

Keep private planning files, local run bundles, credentials, session data, logs, and browser evidence out of commits and package contents.

## MCP, onboarding, and GitHub Actions

The repository includes a local stdio MCP server for coding agents. From a checkout, start it with:

    node src/cli.mjs mcp --repo .

An MCP client can launch that process with a configuration like this, replacing the paths with absolute paths for the local machine:

    {
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
    }

The read-only tools inspect the repository, load a task, inspect the task and Kane test contract, and read a sanitized run summary. These tools need no GitHub setup and do not need Kane authentication. The explicit verification tool runs the existing Elenchos verify mode. It can start the application, consume Kane credits, and write local .elenchos evidence. It never launches a coding agent or edits source files through the MCP surface. Repository-relative paths are required, and raw Kane output, local evidence paths, and credential-bearing fields are filtered from MCP responses.

### Maintainer-only GitHub verification

The included .github/workflows/verification.yml workflow belongs to the Elenchos maintainer repository. End users do not need these settings to use the MCP server. The workflow runs syntax, test, and whitespace checks on pull requests and manual runs. Its Kane job is opt-in. A maintainer can enable it with the repository variable ELENCHOS_KANE_ENABLED set to true and add these repository secrets:

    KANE_USERNAME
    KANE_ACCESS_KEY

KANE_PROJECT_ID and KANE_FOLDER_ID are optional secrets for selecting a Kane project or folder. The workflow passes these values to the official Kane CLI login flags. It does not print the secrets, post pull request comments, or request GitHub write permissions. Pull requests from forks run the repository checks and skip the Kane job because GitHub does not provide repository secrets to them.

## Roadmap

The next product milestone is a two-agent comparison flow with the same task and Kane contract, isolated candidate workspaces, repair-round metrics, and a comparison report.

Later work may add:

- shareable reports and badges;
- richer multi-step diagnosis and repair policies;
- multi-task and multi-repository execution;
- optional container or virtual-machine isolation.

The current repository verifies one configured agent per run, provides a local MCP adapter, and includes an opt-in GitHub verification workflow. It still uses repository worktree isolation only, and the two-agent comparison remains the next product milestone.

## License and security

Elenchos is released under the [MIT License](LICENSE).

For a vulnerability report, use GitHub's private security advisory process described in [SECURITY.md](SECURITY.md). Do not publish an unpatched vulnerability in a public issue.
