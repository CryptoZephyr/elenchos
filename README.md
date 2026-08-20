# Elenchos

Elenchos is a verification loop for AI coding agents. A coding agent builds or repairs a task in a detached Git worktree. Kane CLI then checks the requested behavior in a real browser. Elenchos accepts the result only when the task, Kane test, Git HEAD, and working content stayed unchanged during verification.

```text
task -> coding agent -> application -> Kane browser test
                          |                 |
                          +---- repair <----+ FAIL
                                            PASS -> verified revision
```

## Why it exists

Coding agents can say a task is done without proving the user flow works. Elenchos keeps the builder and verifier separate, stores evidence for every attempt, and distinguishes product failures from verifier failures.

## Requirements

- Node.js 20 or newer
- Git
- An authenticated [Kane CLI](https://www.testmu.ai/kane-ai)
- A supported coding-agent CLI. The included example uses AGY with Gemini

## Install

Install the published CLI from npm:

```bash
npm install -g elenchos
elenchos --help
```

Run `elenchos init` inside the repository you want to verify. It creates an ignored local configuration and checks whether Kane is installed and authenticated.

Install Kane and sign in before running Elenchos:

```bash
npm install -g @testmuai/kane-cli
kane-cli login
kane-cli whoami
kane-cli balance
```

## Run the included proof

Clone the repository, install dependencies, and create local configuration:

```bash
npm install
npm run build
npm test
npx elenchos init
npx elenchos run demo/tasks/add-task.json
```

The demo starts with a deterministic browser-visible defect and enables `verifyBeforeImplement`. Kane runs [the fixed verification contract](demo/tests/add-task_test.md) against that baseline, returns structured failure evidence to the coding agent, and reruns the same contract after repair in a detached worktree.

Use `verify` when the implementation already exists and no code changes are needed:

```bash
npx elenchos verify demo/tasks/add-task.json
```

## Task format

Each task has stable acceptance criteria and points to a Kane-authored `_test.md` file:

```json
{
  "id": "add-task",
  "title": "Add a task",
  "description": "A user can add a task from the main screen.",
  "acceptanceCriteria": [
    { "id": "AC-001", "description": "The new task appears in the list" }
  ],
  "verification": {
    "testFile": "tests/add-task_test.md"
  }
}
```

Elenchos doesn't generate this test. Author it with Kane so the system that builds the code can't rewrite the success criteria. Put each criterion ID in the matching Kane step heading, such as `AC-001 Page loads`. Elenchos leaves a criterion `UNVERIFIED` when structured Kane events don't identify it explicitly.

## Evidence and trust boundary

Every run is stored under `.elenchos/runs/<run-id>`. Each attempt has separate application logs and Kane structured output. Elenchos applies best-effort redaction to common credential fields and patterns before persistence.

`PASS` means Kane completed the browser contract against one recorded code state. `FAIL` means Kane found a product failure. Browser, platform, timeout, incomplete output, and stale evidence are recorded as `VERIFIER_ERROR`.

Local run data may still contain project details or secrets printed in unexpected formats, so `.elenchos`, `.testmuai`, and Kane output folders are excluded from Git and npm packages.

After a run, Elenchos saves a binary Git patch, a changed-file snapshot, and a manifest under the run directory. Detached worktrees are then removed by default. Set `verification.retainWorkspace` to `true` when you need to inspect the live worktree.

## Security boundary

The worktree separates repository state. It does not sandbox the coding agent from your machine. The agent still inherits the permissions, filesystem access, credentials, and network access of its process. Run untrusted agents or repositories inside a container, virtual machine, or another operating-system sandbox.

The sanitized [closed-loop evidence](EVIDENCE.md) records the verified demo run without publishing Kane session data.

## Configuration

`elenchos init` writes `.elenchos/config.json`, adds `.elenchos/` and `.testmuai/` to Git's local exclude file, and checks whether Kane is installed and authenticated. [config.example.json](config.example.json) documents the supported fields without credentials or machine session data.

The `repository` field selects the target repository. Agent arguments use `{{prompt}}` as the prompt placeholder. `KANE_CLI_PATH` can point to the installed Kane entry file when the command shim isn't on `PATH`.

## Development

```bash
npm run build
npm test
npm pack --dry-run
```

The project is available under the [MIT License](LICENSE). Please report security issues through the process in [SECURITY.md](SECURITY.md).
