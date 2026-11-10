'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseEnv } = require('../src/parse');

test('parses basic, export, quoted and commented lines', () => {
  const m = parseEnv('# c\nA=1\nexport B=two\nC="x # y"\nD=v # note\nE=\nbad line\n1X=no\n');
  assert.deepEqual([...m.keys()], ['A', 'B', 'C', 'D', 'E']);
  assert.equal(m.get('B'), 'two');
  assert.equal(m.get('C'), 'x # y');
  assert.equal(m.get('D'), 'v');
  assert.equal(m.get('E'), '');
});

test('handles BOM and CRLF', () => {
  const m = parseEnv('\uFEFFA=1\r\nB=2\r\n');
  assert.deepEqual([...m.keys()], ['A', 'B']);
});
