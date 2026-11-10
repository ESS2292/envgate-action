'use strict';

/**
 * Pure check logic. Works on key names only; values are read solely to
 * decide "empty or not" and are never returned.
 *
 * @param {object} opts
 * @param {string[]} opts.requiredKeys  keys from .env.example (in order)
 * @param {Map<string,string>|null} opts.fileVars  parsed env file, or null
 * @param {Record<string,string|undefined>} opts.processEnv  job environment
 * @param {boolean} opts.failOnEmpty
 * @returns {{ ok: boolean, missing: string[], empty: string[], checked: number }}
 */
function checkKeys({ requiredKeys, fileVars, processEnv, failOnEmpty }) {
  const missing = [];
  const empty = [];
  const env = processEnv || {};
  for (const key of requiredKeys) {
    const inFile = !!fileVars && fileVars.has(key);
    const inEnv = Object.prototype.hasOwnProperty.call(env, key) && env[key] !== undefined;
    if (!inFile && !inEnv) {
      missing.push(key);
      continue;
    }
    if (failOnEmpty) {
      const fileHasValue = inFile && String(fileVars.get(key)).trim() !== '';
      const envHasValue = inEnv && String(env[key]).trim() !== '';
      if (!fileHasValue && !envHasValue) empty.push(key);
    }
  }
  return {
    ok: missing.length === 0 && empty.length === 0,
    missing,
    empty,
    checked: requiredKeys.length,
  };
}

function parseBool(input) {
  return /^(true|1|yes|on)$/i.test(String(input || '').trim());
}

module.exports = { checkKeys, parseBool };
