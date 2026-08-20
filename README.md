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

Run `elenchos init` inside the repository you want to verify. It identifies the project type, reports detected application and agent choices, creates an ignored local configuration, and checks whether Kane is installed and authenticated. Elenchos leaves the configuration incomplete when it cannot choose safely. Resolve the reported values explicitly:

```bash
npx elenchos init --force --start "npm run dev" --url http://127.0.0.1:5173 --agent agy
```

The init step does not guess between multiple start commands or multiple supported agent CLIs. The application start command and URL must be configured before a run can begin.

Install Kane and sign in before running Elenchos:

```bash
npm install -g @testmuai/kane-cli
kane-cli login
kane-cli whoami
kane-cli balance
```

Install the official Kane coding-agent skill when you want Kane to author or debug browser tests from an agent workflow:

```bash
npx @testmuai/kane-cli-skill
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

Each task has stable acceptance criteria and points to a Kane-authored `_test.md` file. Optional `setup` and `preconditions` values are included in the implementation prompt and locked into the verification contract:

```json
{
  "id": "add-task",
  "title": "Add a task",
  "description": "A user can add a task from the main screen.",
  "setup": ["Start the local application"],
  "preconditions": { "page": "/" },
  "acceptanceCriteria": [
    { "id": "AC-001", "description": "The new task appears in the list" }
  ],
  "verification": {
    "testFile": "tests/add-task_test.md"
  }
}
```

Elenchos doesn't hand-write this test. For a quick task, use Kane's supported generation flow through the Elenchos author command:

```bash
npx elenchos author demo/tasks/add-task.json --output demo/tests/add-task_test.md
```

That command runs `kane-cli generate`, consumes the structured authoring result, then runs the official `generate --save --req ... --agent` step. If Kane saves more than one Functional test, Elenchos stops and asks you to select the test that belongs in the task contract. A clarification is also returned for you to answer before saving.

For requirement documents and coverage accounting, use Kane's assurance flow instead. In that case ingest the PRD or specification with `kane-cli context ingest ... --mode agent`, design tests with `kane-cli design tests --use-case ... --mode agent`, and run each accepted saved test with `kane-cli testmd run ... --agent`. Never hand-write a Kane test case to make a failing requirement pass.

Put each criterion ID in the matching Kane step heading, such as `AC-001 Page loads`. Elenchos leaves a criterion `UNVERIFIED` when structured Kane events don't identify it explicitly.

## Evidence and trust boundary

Every run is stored under `.elenchos/runs/<run-id>`. Each attempt has separate application logs and Kane structured output. Human-readable summaries include the final Kane result, duration, step count, key actions, mapped criterion observations, failure details, and whether Kane supplied an evidence pack. Elenchos applies best-effort redaction to common credential fields and patterns before persistence.

`PASS` means Kane completed the browser contract against one recorded code state. `FAIL` means Kane found a product failure. Browser, platform, timeout, incomplete output, and stale evidence are recorded as `VERIFIER_ERROR`.

Local run data may still contain project details or secrets printed in unexpected formats, so `.elenchos`, `.testmuai`, and Kane output folders are excluded from Git and npm packages.

After a run, Elenchos saves a binary Git patch, a changed-file snapshot, and a manifest under the run directory. Detached worktrees are then removed by default. Set `verification.retainWorkspace` to `true` when you need to inspect the live worktree.

## Security boundary

The worktree separates repository state. It does not sandbox the coding agent from your machine. The agent still inherits the permissions, filesystem access, credentials, and network access of its process. Run untrusted agents or repositories inside a container, virtual machine, or another operating-system sandbox.

The sanitized [closed-loop evidence](EVIDENCE.md) records the verified demo run without publishing Kane session data.

## Configuration

`elenchos init` writes `.elenchos/config.json`, adds `.elenchos/` and `.testmuai/` to Git's local exclude file, and checks whether Kane is installed and authenticated. [config.example.json](config.example.json) documents the supported fields without credentials or machine session data.

The `repository` field selects the target repository. Agent arguments can use `{{prompt}}` and `{{cwd}}` placeholders. If an agent keeps authentication per launch directory, set `agent.launchCwd` to that authenticated directory and pass the isolated worktree with an argument such as `--add-dir {{cwd}}`. The implementation prompt still restricts edits to the isolated worktree. `KANE_CLI_PATH` can point to the installed Kane entry file when the command shim isn't on `PATH`.

## Development

```bash
npm run build
npm test
npm pack --dry-run
```

The project is available under the [MIT License](LICENSE). Please report security issues through the process in [SECURITY.md](SECURITY.md).
