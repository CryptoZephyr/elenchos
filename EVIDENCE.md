# Closed-loop evidence

Verified locally on August 20, 2026 with Kane CLI 0.8.4 and AGY 1.1.15 using Gemini.

```text
Run status: VERIFIED
Attempts: 2
Attempt 1: FAIL
Repair attempts: 1
Attempt 2: PASS
Changed file: demo/target-app.mjs
Baseline commit: 3b80a68b7c1621a98929485858e3e6d6e65dcebb
Kane contract SHA-256: 832bb3414bb3f5c214105270f48307e822eeeb37472d9990db6fdfef77a4076b
Verified diff SHA-256: 61fb47f7ccd6b50bc8b5157a501e957341f95e5ec5dfa2f50b3617477aeaf184
```

Kane's first browser attempt confirmed that the add action accepted the task name but didn't place the task in the list or update the count. Elenchos sent that structured product-failure evidence to AGY. The agent removed the faulty branch in the isolated worktree, then Kane reran the unchanged `_test.md` contract and passed.

The private run bundle contains separate application logs and structured Kane output for each attempt. It stays outside Git and the npm package because it contains local paths and Kane session metadata. The summary above contains the stable hashes needed to identify the contract and verified code state without exposing that data.

Repository checks at the proof baseline:

- 17 of 17 Node tests passed
- Source syntax checks passed
- `npm audit --omit=dev` found 0 vulnerabilities
- The repaired worktree passed `git diff --check` and `node --check demo/target-app.mjs`
