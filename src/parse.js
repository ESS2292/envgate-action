'use strict';

/**
 * Tiny .env parser: KEY=VALUE, optional `export `, # comments,
 * simple single/double quotes. No multiline values or expansion.
 * Returns a Map of key -> value. Later duplicates win.
 */
function parseEnv(text) {
  const out = new Map();
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice(7).trim();
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    const q = value[0];
    if ((q === '"' || q === "'") && value.length >= 2 && value.endsWith(q)) {
      value = value.slice(1, -1);
    } else {
      const hash = value.search(/(^|\s)#/);
      if (hash !== -1) value = value.slice(0, hash).trimEnd();
    }
    out.set(key, value);
  }
  return out;
}

module.exports = { parseEnv };
