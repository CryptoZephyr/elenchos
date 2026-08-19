import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

function modules(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return modules(path);
    return entry.name.endsWith(".mjs") ? [path] : [];
  });
}

for (const path of modules("src")) {
  const result = spawnSync(process.execPath, ["--check", path], { stdio: "inherit", windowsHide: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
