# Elenchos submission notes

Elenchos gives AI coding agents an independent definition of done. It runs the builder in an isolated Git worktree, locks the task and Kane-authored browser contract, and records a code revision for each attempt. Kane CLI provides the structured browser evidence. A confirmed product failure returns to the agent for a bounded repair, then the same contract runs again. The included proof shows that full failure-to-repair-to-pass loop.

## Run command

```bash
npm install
npx elenchos init
npx elenchos run demo/tasks/add-task.json
```

## Kane integration

Kane is the only source of browser verification status. Elenchos consumes Kane's structured `testmd run --agent` output, rejects incomplete or stale results, stores separate evidence for each attempt, and never treats coding-agent narration as proof.
