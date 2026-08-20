import assert from "node:assert/strict";
import test from "node:test";
import { createDemoServer } from "../demo/target-app.mjs";

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test("demo serves explicit routes with safe headers and method errors", async () => {
  const server = createDemoServer({ broken: false });
  const base = await listen(server);
  try {
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-security-policy"), /default-src 'none'/);
    assert.equal(page.headers.get("x-content-type-options"), "nosniff");
    assert.match(await page.text(), /Proofboard/);

    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });

    const missing = await fetch(`${base}/missing`);
    assert.equal(missing.status, 404);

    const method = await fetch(`${base}/`, { method: "POST" });
    assert.equal(method.status, 405);
    assert.equal(method.headers.get("allow"), "GET");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
