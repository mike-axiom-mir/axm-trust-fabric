'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const matrixPath = path.join(root, 'evidence', 'adversarial_matrix.json');
const guardPath = path.join(root, 'evidence', 'consistency_guard_v1.json');
const reportPath = path.join(root, 'ROOT_GATE_REPORT.md');
const readmePath = path.join(root, 'README.md');
const trustModelPath = path.join(root, 'TRUST_MODEL.md');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
const guard = JSON.parse(fs.readFileSync(guardPath, 'utf8'));

assert.equal(matrix.test_count, matrix.tests.length, 'matrix test_count must equal tests.length');
console.log('PASS matrix declared count matches matrix entries');

const caseIds = matrix.tests.map((entry) => entry.case);
assert.equal(new Set(caseIds).size, caseIds.length, 'matrix case ids must be unique');
console.log('PASS matrix case ids are unique');

for (const entry of matrix.tests) {
  assert.equal(entry.observed, entry.expected, `matrix case ${entry.case} must not record expected/observed drift`);
}
console.log('PASS matrix expected and observed states agree');

const jsFixtureFiles = fs.readdirSync(__dirname)
  .filter((name) => name.endsWith('.test.js') && name !== 'evidence-consistency.test.js');
let jsFixtureCount = 0;
for (const name of jsFixtureFiles) {
  const text = fs.readFileSync(path.join(__dirname, name), 'utf8');
  jsFixtureCount += (text.match(/^test\(/gm) || []).length;
}

assert.ok(Array.isArray(guard.javascript_direct_case_files), 'consistency contract must list direct JavaScript case files');
let directCaseCount = 0;
for (const relativePath of guard.javascript_direct_case_files) {
  const fullPath = path.join(root, relativePath);
  assert.ok(fs.existsSync(fullPath), `direct case file missing: ${relativePath}`);
  const text = fs.readFileSync(fullPath, 'utf8');
  assert.equal((text.match(/^test\(/gm) || []).length, 0, `direct case file must not also contain counted test() calls: ${relativePath}`);
  directCaseCount += 1;
}

const goDir = path.join(root, 'crosslang', 'go');
const goFixtureFiles = fs.readdirSync(goDir).filter((name) => name.endsWith('_test.go'));
let goFixtureCount = 0;
for (const name of goFixtureFiles) {
  const text = fs.readFileSync(path.join(goDir, name), 'utf8');
  goFixtureCount += (text.match(/^func Test[A-Za-z0-9_]*\(/gm) || []).length;
}

const executableBehaviorFixtureCount = jsFixtureCount + directCaseCount + goFixtureCount;
assert.equal(
  executableBehaviorFixtureCount,
  matrix.test_count,
  `authored executable behavior fixtures (${executableBehaviorFixtureCount}) must equal matrix test_count (${matrix.test_count})`
);
console.log(`PASS executable behavior fixtures match matrix count (${matrix.test_count})`);

assert.equal(guard.protocol_case_count, matrix.test_count, 'consistency contract must name the current matrix count');
assert.equal(guard.meta_test_counted_as_protocol_case, false, 'consistency meta-test must not inflate protocol evidence');
console.log('PASS evidence consistency contract matches matrix without inflating it');

const requiredCountLine = `Current authored adversarial matrix: **${matrix.test_count} bounded cases**.`;
const report = fs.readFileSync(reportPath, 'utf8');
assert.ok(report.includes(requiredCountLine), `ROOT_GATE_REPORT.md must include: ${requiredCountLine}`);
console.log('PASS primary root-gate report count matches matrix');

const readme = fs.readFileSync(readmePath, 'utf8');
assert.ok(readme.includes(requiredCountLine), `README.md must include: ${requiredCountLine}`);
console.log('PASS public README evidence count matches matrix');

assert.ok(Array.isArray(guard.required_trust_model_phrases), 'consistency contract must list required bounded Trust Model phrases');
const trustModel = fs.readFileSync(trustModelPath, 'utf8');
for (const phrase of guard.required_trust_model_phrases) {
  assert.ok(trustModel.includes(phrase), `TRUST_MODEL.md must preserve bounded Trust Model truth boundary: ${phrase}`);
}
console.log('PASS Trust Model preserves required bounded truth boundaries');

console.log('\nEvidence consistency guard passed.');
