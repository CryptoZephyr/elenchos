# Closed-loop evidence

Verified locally on August 20, 2026 with Kane CLI 0.8.4 and AGY 1.1.16 using Gemini.

```text
Run status: VERIFIED
Attempts: 2
Attempt 1: FAIL
Repair attempts: 1
Attempt 2: PASS
Changed file: demo/target-app.mjs
Baseline commit: eaa25ba6d727a45aa09194e4f13fdb9f7986af8c
Kane contract SHA-256: 3e6a018b105155ee470451b74e17ae74080f14dbcdfb8d6da4140835c84ab739
Verified diff SHA-256: 61fb47f7ccd6b50bc8b5157a501e957341f95e5ec5dfa2f50b3617477aeaf184
```

Kane's first browser attempt confirmed that the add action accepted the task name but didn't place the task in the list or update the count. All three acceptance criteria were marked `FAIL`. Elenchos sent that structured product-failure evidence to AGY. The agent removed the faulty branch in the isolated worktree, then Kane reran the unchanged `_test.md` contract and marked all three criteria `PASS`.

The private run bundle contains separate application logs and structured Kane output for each attempt. It stays outside Git and the npm package because it contains local paths and Kane session metadata. The summary above contains the stable hashes needed to identify the contract and verified code state without exposing that data.

Repository checks at the proof baseline:

- 33 of 33 Node tests passed
- Source syntax checks passed
- `npm audit --omit=dev` found 0 vulnerabilities
- The v0.1.1 npm package dry run contained only the intended 23 files
- The repaired worktree passed `git diff --check` and `node --check demo/target-app.mjs`
