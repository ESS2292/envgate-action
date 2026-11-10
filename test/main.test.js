'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { run, escapeData } = require('../src/main');

const fixtures = path.join(__dirname, 'fixtures');
const SECRET = 'fake-demo-key-not-real';

function tmpFiles() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envgate-action-'));
  const summary = path.join(dir, 'summary.md');
  const output = path.join(dir, 'output.txt');
  return { summary, output };
}

function invoke(inputs, extraEnv = {}) {
  const { summary, output } = tmpFiles();
  const env = { GITHUB_STEP_SUMMARY: summary, GITHUB_OUTPUT: output, ...extraEnv };
  for (const [k, v] of Object.entries(inputs)) env[`INPUT_${k.toUpperCase()}`] = v;
  const logs = [];
  const code = run(env, { log: (s) => logs.push(s), cwd: fixtures });
  const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
  return { code, log: logs.join('\n'), summary: read(summary), output: read(output) };
}

test('pass: complete env file', () => {
  const r = invoke({ example: '.env.example', 'env-file': 'complete.env', 'fail-on-empty': 'true' });
  assert.equal(r.code, 0);
  assert.match(r.output, /^ok=true$/m);
  assert.match(r.summary, /All 3 key\(s\)/);
  assert.match(r.summary, /https:\/\/ess2292\.github\.io\/envgate\//);
});

test('pass: job environment only', () => {
  const r = invoke({ example: '.env.example' }, { APP_NAME: 'a', DATABASE_URL: 'b', API_KEY: 'c' });
  assert.equal(r.code, 0);
});

test('fail: missing key reported by name', () => {
  const r = invoke({ example: '.env.example', 'env-file': 'partial.env' });
  assert.equal(r.code, 1);
  assert.match(r.log, /::error title=Missing env key::DATABASE_URL/);
  assert.match(r.output, /^missing=DATABASE_URL$/m);
  assert.match(r.summary, /\| `DATABASE_URL` \| missing \|/);
});

test('fail-on-empty flags empty keys', () => {
  const r = invoke({ example: '.env.example', 'env-file': 'partial.env', 'fail-on-empty': 'true' }, { DATABASE_URL: 'x' });
  assert.equal(r.code, 1);
  assert.match(r.output, /^empty=API_KEY$/m);
});

test('setup error: missing example file', () => {
  const r = invoke({ example: 'nope.example' });
  assert.equal(r.code, 1);
  assert.match(r.log, /Example file not found/);
});

test('setup error: missing env-file', () => {
  const r = invoke({ example: '.env.example', 'env-file': 'nope.env' });
  assert.equal(r.code, 1);
  assert.match(r.log, /env-file not found/);
});

test('never prints values in logs, summary or outputs', () => {
  for (const file of ['complete.env', 'partial.env']) {
    const r = invoke({ example: '.env.example', 'env-file': file, 'fail-on-empty': 'true' }, { DATABASE_URL: 'env-secret-123' });
    for (const s of [r.log, r.summary, r.output]) {
      assert.ok(!s.includes(SECRET));
      assert.ok(!s.includes('env-secret-123'));
      assert.ok(!s.includes('user:pass'));
    }
  }
});

test('escapeData escapes workflow-command characters', () => {
  assert.equal(escapeData('a%b\nc\r'), 'a%25b%0Ac%0D');
});

test('entrypoint runs as a process with hyphenated INPUT_ names', () => {
  const { summary, output } = tmpFiles();
  const env = {
    PATH: process.env.PATH,
    GITHUB_WORKSPACE: fixtures,
    GITHUB_STEP_SUMMARY: summary,
    GITHUB_OUTPUT: output,
    'INPUT_EXAMPLE': '.env.example',
    'INPUT_ENV-FILE': 'partial.env',
    'INPUT_FAIL-ON-EMPTY': 'false',
  };
  const p = spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'main.js')], { env, encoding: 'utf8' });
  assert.equal(p.status, 1);
  assert.match(p.stdout, /DATABASE_URL/);
});


test('falls back to .env.sample when .env.example is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envgate-action-sample-'));
  fs.writeFileSync(path.join(dir, '.env.sample'), 'APP_NAME=\nDATABASE_URL=\nAPI_KEY=\n');
  const { summary, output } = tmpFiles();
  const logs = [];
  const code = run({
    GITHUB_STEP_SUMMARY: summary,
    GITHUB_OUTPUT: output,
    INPUT_EXAMPLE: '.env.example',
    APP_NAME: 'a',
    DATABASE_URL: 'b',
    API_KEY: 'c',
  }, { log: (s) => logs.push(s), cwd: dir });
  assert.equal(code, 0);
  assert.match(logs.join('\n'), /\.env\.sample/);
  assert.match(fs.readFileSync(output, 'utf8'), /^ok=true$/m);
});

test('falls back to .env.template when .env.example and .env.sample are missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envgate-action-template-'));
  fs.writeFileSync(path.join(dir, '.env.template'), 'APP_NAME=\nDATABASE_URL=\nAPI_KEY=\n');
  const { summary, output } = tmpFiles();
  const code = run({
    GITHUB_STEP_SUMMARY: summary,
    GITHUB_OUTPUT: output,
    INPUT_EXAMPLE: '.env.example',
    APP_NAME: 'a',
    DATABASE_URL: 'b',
    API_KEY: 'c',
  }, { log: () => {}, cwd: dir });
  assert.equal(code, 0);
  assert.match(fs.readFileSync(output, 'utf8'), /^ok=true$/m);
});

test('does not fall back when a custom example path is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envgate-action-custom-'));
  fs.writeFileSync(path.join(dir, '.env.sample'), 'APP_NAME=\n');
  const { summary, output } = tmpFiles();
  const logs = [];
  const code = run({
    GITHUB_STEP_SUMMARY: summary,
    GITHUB_OUTPUT: output,
    INPUT_EXAMPLE: 'custom.env',
  }, { log: (s) => logs.push(s), cwd: dir });
  assert.equal(code, 1);
  assert.match(logs.join('\n'), /custom\.env/);
});
