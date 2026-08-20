import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, relative, resolve } from "node:path";

const sensitiveKey = /(?:password|passphrase|token|secret|credential|accesstoken|refreshtoken|clientsecret|apikey|accesskey|authorization|cookie|privatekey|seed|mnemonic)$/i;

function isSensitiveKey(key) {
  const normalized = String(key ?? "").replace(/[^a-z0-9]/gi, "");
  return sensitiveKey.test(normalized);
}

function isWithin(root, candidate) {
  const fromRoot = relative(root, candidate);
  return !fromRoot || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot));
}

export function repositoryPath(root, requested) {
  if (typeof requested !== "string" || !requested.trim()) {
    throw new Error("A repository-relative path is required");
  }

  const rootAbsolute = resolve(root);
  const absolute = resolve(rootAbsolute, requested);

  let realRoot;
  try {
    realRoot = realpathSync(rootAbsolute);
  } catch {
    throw new Error("The configured repository does not exist");
  }

  if (!isWithin(rootAbsolute, absolute) && !(isAbsolute(requested) && isWithin(realRoot, absolute))) {
    throw new Error("The requested path must stay inside the configured repository");
  }

  let probe = absolute;
  while (true) {
    try {
      const realProbe = realpathSync(probe);
      const canonical = resolve(realProbe, relative(probe, absolute));
      if (!isWithin(realRoot, canonical)) {
        throw new Error("The requested path must stay inside the configured repository");
      }
      return canonical;
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
    }

    const parent = dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  throw new Error("The configured repository does not exist");
}

export function ensureDirectory(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  ensureDirectory(dirname(path));
  writeFileSync(path, `${JSON.stringify(redactValue(value), null, 2)}\n`, "utf8");
}

export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix = "run") {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${stamp}-${random}`;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function redactValue(value, key = "") {
  if (isSensitiveKey(key)) return "[REDACTED]";
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (!value || typeof value !== "object") return value;

  const secretContainer = value.secret === true;
  const redacted = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (secretContainer && entryKey === "value") redacted[entryKey] = "[REDACTED]";
    else redacted[entryKey] = redactValue(entryValue, entryKey);
  }
  return redacted;
}

export function redactText(value) {
  const redactLine = (line) => line
    .replace(/(authorization\s*:\s*(?:bearer|basic)\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:code|code_challenge|state|client_secret|access_token|refresh_token|api_key|access_key)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/([A-Za-z0-9_.-]*?(?:password|passphrase|token|secret|credential|cookie|access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|access[_-]?key|private[_-]?key|authorization|mnemonic)\s*[:=]\s*)(?:"([^"]*)"|'([^']*)'|([^\s,;&}]+))/gi, (match, prefix, doubleQuoted, singleQuoted) => {
      if (doubleQuoted !== undefined) return `${prefix}"[REDACTED]"`;
      if (singleQuoted !== undefined) return `${prefix}'[REDACTED]'`;
      return `${prefix}[REDACTED]`;
    });
  const text = String(value ?? "");
  const redactedLines = text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try { return redactLine(JSON.stringify(redactValue(JSON.parse(line)))); } catch { /* Continue with text redaction. */ }
    }
    return redactLine(line);
  });
  return redactedLines.join("\n");
}

export function trimForLog(value, max = 12000) {
  const text = redactText(value);
  return text.length <= max ? text : `${text.slice(0, max)}\n...[truncated]`;
}

export function shellSplit(input, { windows = process.platform === "win32" } = {}) {
  const tokens = [];
  let current = "";
  let quote = null;
  let escaped = false;
  const value = String(input ?? "");

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'" && (!windows || next === '"')) {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (escaped) current += "\\";
  if (quote) throw new Error("Unclosed quote in command");
  if (current) tokens.push(current);
  return tokens;
}

export function replacePrompt(value, prompt) {
  return String(value).split("{{prompt}}").join(prompt);
}
