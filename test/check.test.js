'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkKeys, parseBool } = require('../src/check');

const requiredKeys = ['A', 'B', 'C'];

test('passes when all keys are in the env file', () => {
  const r = checkKeys({ requiredKeys, fileVars: new Map([['A', '1'], ['B', '2'], ['C', '3']]), processEnv: {}, failOnEmpty: false });
  assert.equal(r.ok, true);
  assert.deepEqual(r.missing, []);
});

test('passes when keys are split between file and job env', () => {
  const r = checkKeys({ requiredKeys, fileVars: new Map([['A', '1']]), processEnv: { B: 'x', C: 'y' }, failOnEmpty: false });
  assert.equal(r.ok, true);
});

test('passes with job env only (no env file)', () => {
  const r = checkKeys({ requiredKeys, fileVars: null, processEnv: { A: '1', B: '2', C: '3' }, failOnEmpty: false });
  assert.equal(r.ok, true);
});

test('reports missing keys in template order', () => {
  const r = checkKeys({ requiredKeys, fileVars: new Map([['B', '1']]), processEnv: {}, failOnEmpty: false });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ['A', 'C']);
});

test('empty values pass unless failOnEmpty', () => {
  const fileVars = new Map([['A', ''], ['B', '  '], ['C', 'ok']]);
  assert.equal(checkKeys({ requiredKeys, fileVars, processEnv: {}, failOnEmpty: false }).ok, true);
  const r = checkKeys({ requiredKeys, fileVars, processEnv: {}, failOnEmpty: true });
  assert.equal(r.ok, false);
  assert.deepEqual(r.empty, ['A', 'B']);
});

test('a non-empty job env var rescues an empty file value', () => {
  const r = checkKeys({ requiredKeys: ['A'], fileVars: new Map([['A', '']]), processEnv: { A: 'set' }, failOnEmpty: true });
  assert.equal(r.ok, true);
});

test('result never contains values', () => {
  const r = checkKeys({ requiredKeys, fileVars: new Map([['A', 'super-secret-value']]), processEnv: {}, failOnEmpty: true });
  assert.ok(!JSON.stringify(r).includes('super-secret-value'));
});

test('parseBool', () => {
  for (const v of ['true', 'TRUE', '1', 'yes', 'on']) assert.equal(parseBool(v), true);
  for (const v of ['false', '', '0', 'no', undefined]) assert.equal(parseBool(v), false);
});
