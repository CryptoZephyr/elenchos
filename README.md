# Elenchos

Elenchos is a verification loop for AI coding agents. A coding agent builds or repairs a task in an isolated Git worktree. Kane CLI then checks the requested behavior in a real browser. Elenchos accepts the result only when the task, Kane test, and code revision stayed unchanged during verification.

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

The demo starts with a deterministic browser-visible defect. The coding agent receives the task in a detached worktree. Kane runs [the fixed verification contract](demo/tests/add-task_test.md), returns structured failure evidence, and reruns the same contract after repair.

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

Elenchos doesn't generate this test. Author it with Kane so the system that builds the code can't rewrite the success criteria.

## Evidence and trust boundary

Every run is stored under `.elenchos/runs/<run-id>`. Each attempt has separate application logs and Kane structured output. Sensitive fields are redacted before persistence.

`PASS` means Kane completed the browser contract against one recorded code state. `FAIL` means Kane found a product failure. Browser, platform, timeout, incomplete output, and stale evidence are recorded as `VERIFIER_ERROR`.

Local run data may still contain project details, so `.elenchos`, `.testmuai`, and Kane output folders are excluded from Git and npm packages.

## Configuration

`elenchos init` writes `.elenchos/config.json` and checks whether Kane is installed and authenticated. [config.example.json](config.example.json) documents the supported fields without credentials or machine session data.

The `repository` field selects the target repository. Agent arguments use `{{prompt}}` as the prompt placeholder. `KANE_CLI_PATH` can point to the installed Kane entry file when the command shim isn't on `PATH`.

## Development

```bash
npm run build
npm test
npm pack --dry-run
```

The project is available under the [MIT License](LICENSE). Please report security issues through the process in [SECURITY.md](SECURITY.md).
