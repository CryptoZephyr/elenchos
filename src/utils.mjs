import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, resolve } from "node:path";

const sensitiveKey = /^(?:password|passphrase|token|access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|access[_-]?key|authorization|cookie|private[_-]?key|seed|mnemonic)$/i;

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

export function resolveFrom(root, value) {
  return isAbsolute(value) ? value : resolve(root, value);
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
  if (sensitiveKey.test(key)) return "[REDACTED]";
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
  const text = String(value ?? "");
  const redactedLines = text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try { return JSON.stringify(redactValue(JSON.parse(line))); } catch { /* Continue with text redaction. */ }
    }
    return line
      .replace(/(authorization\s*:\s*bearer\s+)[^\s]+/gi, "$1[REDACTED]")
      .replace(/((?:password|passphrase|access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|access[_-]?key|private[_-]?key|mnemonic)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]");
  });
  return redactedLines.join("\n");
}

export function trimForLog(value, max = 12000) {
  const text = redactText(value);
  return text.length <= max ? text : `${text.slice(0, max)}\n...[truncated]`;
}

export function shellSplit(input) {
  const tokens = [];
  let current = "";
  let quote = null;
  let escaped = false;

  for (const char of String(input ?? "")) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
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

export function fileExists(path) {
  return existsSync(path);
}
