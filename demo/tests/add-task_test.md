---
mode: testing
max_steps: 50
timeout: 60
target: chrome
headless: true
---

# Session: proofboard-add-task-v3

## AC-001 AC-002 AC-003 Add and display a task
Go to http://127.0.0.1:3000, type "Ship the invoice export" into the "Task name" field, click the "Add task" button, and assert that "Ship the invoice export" is visible in the task list and the page shows "1 task"
