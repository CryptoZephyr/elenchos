import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3000);
const broken = process.env.ELENCHOS_DEMO_BROKEN === "1";

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Proofboard</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; background: #f5f7fb; color: #192234; }
    main { width: min(720px, calc(100% - 32px)); margin: 72px auto; }
    .eyebrow { color: #5367d9; font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
    h1 { margin: 10px 0 8px; font-size: clamp(36px, 8vw, 64px); letter-spacing: -.06em; }
    .intro { color: #59657a; font-size: 18px; line-height: 1.6; max-width: 580px; }
    .panel { margin-top: 32px; padding: 24px; background: white; border: 1px solid #e1e6ef; border-radius: 20px; box-shadow: 0 18px 60px #27324b12; }
    label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 800; }
    .composer { display: flex; gap: 10px; }
    input { flex: 1; min-width: 0; border: 1px solid #c9d0dc; border-radius: 10px; padding: 13px 14px; font: inherit; }
    button { border: 0; border-radius: 10px; padding: 0 18px; background: #5367d9; color: white; font: inherit; font-weight: 800; cursor: pointer; }
    button:hover { background: #3f53c5; }
    .meta { display: flex; justify-content: space-between; gap: 16px; margin-top: 24px; color: #69758a; font-size: 13px; }
    ul { display: grid; gap: 10px; padding: 0; margin: 18px 0 0; list-style: none; }
    li { padding: 14px 16px; border: 1px solid #e1e6ef; border-radius: 12px; background: #fbfcfe; }
    [role="status"] { color: #5367d9; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">Elenchos verification fixture</div>
    <h1>Proofboard</h1>
    <p class="intro">A tiny task board used to demonstrate an agent building a feature, Kane finding a browser-visible defect, and the agent repairing it.</p>
    <section class="panel" aria-labelledby="composer-title">
      <label id="composer-title" for="task-input">Task name</label>
      <div class="composer">
        <input id="task-input" name="task" placeholder="Ship the invoice export" autocomplete="off">
        <button id="add-task" type="button">Add task</button>
      </div>
      <div class="meta"><span id="task-count">0 tasks</span><span id="status" role="status">Ready for work</span></div>
      <ul id="task-list" aria-label="Task list"></ul>
    </section>
  </main>
  <script>
    const input = document.querySelector('#task-input');
    const addButton = document.querySelector('#add-task');
    const list = document.querySelector('#task-list');
    const count = document.querySelector('#task-count');
    const status = document.querySelector('#status');
    const tasks = [];

    function render() {
      count.textContent = tasks.length + (tasks.length === 1 ? ' task' : ' tasks');
      list.innerHTML = tasks.map((task) => '<li>' + task.replaceAll('&', '&amp;').replaceAll('<', '&lt;') + '</li>').join('');
    }

    function addTask() {
      const value = input.value.trim();
      if (!value) {
        status.textContent = 'Enter a task first';
        return;
      }
      if (${broken ? "true" : "false"}) {
        status.textContent = 'Task appears saved but was not added';
        return;
      }
      tasks.push(value);
      input.value = '';
      status.textContent = 'Task added';
      render();
    }

    addButton.addEventListener('click', addTask);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        addTask();
      }
    });
  </script>
</body>
</html>`;

createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(page);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Proofboard listening at http://127.0.0.1:${port}\n`);
});
