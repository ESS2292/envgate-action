'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('./parse');
const { checkKeys, parseBool } = require('./check');

const FULL_CLI_URL = 'https://ess2292.github.io/envgate/';

function getInput(name, env) {
  const v = env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`];
  return v === undefined ? '' : String(v).trim();
}

/**
 * If the requested example path is missing and its basename is
 * .env.example, try .env.sample then .env.template in the same directory.
 * dotenv-safe documents both .env.sample and .env.example.
 */
function resolveExample(cwd, examplePath) {
  const requested = examplePath || '.env.example';
  const abs = path.resolve(cwd, requested);
  if (fs.existsSync(abs)) {
    return { requested, path: requested, abs, fallback: false };
  }
  if (path.basename(requested) === '.env.example') {
    for (const name of ['.env.sample', '.env.template']) {
      const altAbs = path.join(path.dirname(abs), name);
      if (fs.existsSync(altAbs)) {
        const rel = path.relative(cwd, altAbs).replace(/\\/g, '/') || name;
        return { requested, path: rel, abs: altAbs, fallback: true };
      }
    }
  }
  return { requested, path: requested, abs, fallback: false, missing: true };
}

// Escape data for GitHub workflow commands (::error:: etc.).
function escapeData(s) {
  return String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function appendFile(file, text) {
  if (!file) return;
  try {
    fs.appendFileSync(file, text, 'utf8');
  } catch {
    /* summary/output files are best-effort */
  }
}

function setOutput(env, name, value) {
  appendFile(env.GITHUB_OUTPUT, `${name}=${String(value).replace(/[\r\n]/g, ' ')}\n`);
}

function buildSummary({ result, examplePath, envFile, failOnEmpty, fatal }) {
  const lines = ['## EnvGate Lite', ''];
  if (fatal) {
    lines.push(`:x: **Setup error:** ${fatal}`);
  } else if (result.ok) {
    lines.push(`:white_check_mark: All ${result.checked} key(s) from \`${examplePath}\` are present.`);
  } else {
    lines.push(`:x: Check failed for \`${examplePath}\`.`, '');
    lines.push('| Key | Problem |', '| --- | --- |');
    for (const k of result.missing) lines.push(`| \`${k}\` | missing |`);
    for (const k of result.empty) lines.push(`| \`${k}\` | empty |`);
  }
  lines.push(
    '',
    `Sources: ${envFile ? `\`${envFile}\` + ` : ''}job environment variables. Empty check: ${failOnEmpty ? 'on' : 'off'}. Values are never printed.`,
    '',
    '---',
    `Need placeholder detection (\`TODO\`, \`CHANGEME\`), extra-key checks, secret-shape detection, or a JSON report? ` +
      `The full [EnvGate CLI](${FULL_CLI_URL}) does all of that locally and in CI.`,
    ''
  );
  return lines.join('\n');
}

/**
 * Runs the action. Returns the exit code instead of exiting so tests can call it.
 * @param {NodeJS.ProcessEnv} env
 * @param {{ log?: (s: string) => void, cwd?: string }} [io]
 */
function run(env = process.env, io = {}) {
  const log = io.log || ((s) => process.stdout.write(s + '\n'));
  const cwd = io.cwd || env.GITHUB_WORKSPACE || process.cwd();
  const requestedExample = getInput('example', env) || '.env.example';
  const resolved = resolveExample(cwd, requestedExample);
  const examplePath = resolved.path;
  const envFile = getInput('env-file', env);
  const failOnEmpty = parseBool(getInput('fail-on-empty', env));

  const fail = (msg) => {
    log(`::error title=EnvGate Lite::${escapeData(msg)}`);
    setOutput(env, 'ok', 'false');
    appendFile(env.GITHUB_STEP_SUMMARY, buildSummary({ examplePath, envFile, failOnEmpty, fatal: msg }));
    return 1;
  };

  let exampleText;
  try {
    exampleText = fs.readFileSync(resolved.abs, 'utf8');
  } catch {
    return fail(`Example file not found or unreadable: ${requestedExample}`);
  }
  if (resolved.fallback) {
    log(`EnvGate Lite: using ${examplePath} (${requestedExample} was not found).`);
  }
  const requiredKeys = [...parseEnv(exampleText).keys()];

  let fileVars = null;
  if (envFile) {
    try {
      fileVars = parseEnv(fs.readFileSync(path.resolve(cwd, envFile), 'utf8'));
    } catch {
      return fail(`env-file not found or unreadable: ${envFile}`);
    }
  }

  const result = checkKeys({ requiredKeys, fileVars, processEnv: env, failOnEmpty });

  for (const k of result.missing) {
    log(`::error title=Missing env key::${escapeData(`${k} is listed in ${examplePath} but is not set`)}`);
  }
  for (const k of result.empty) {
    log(`::error title=Empty env key::${escapeData(`${k} is set but empty`)}`);
  }
  log(
    result.ok
      ? `EnvGate Lite: OK, ${result.checked} key(s) present.`
      : `EnvGate Lite: ${result.missing.length} missing, ${result.empty.length} empty (of ${result.checked}).`
  );
  log(`Full EnvGate CLI (placeholders, extra keys, secret shapes, JSON): ${FULL_CLI_URL}`);

  setOutput(env, 'ok', result.ok ? 'true' : 'false');
  setOutput(env, 'missing', result.missing.join(','));
  setOutput(env, 'empty', result.empty.join(','));
  appendFile(env.GITHUB_STEP_SUMMARY, buildSummary({ result, examplePath, envFile, failOnEmpty }));
  return result.ok ? 0 : 1;
}

module.exports = { run, getInput, escapeData, buildSummary, resolveExample };

if (require.main === module) {
  process.exitCode = run();
}
