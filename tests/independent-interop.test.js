'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vector = require('../evidence/interop_vector_v1.json');
const {
  canonicalJson,
  keyIdFromSpki,
  digestUnsignedEnvelope,
  inspectEnvelope
} = require('../independent/vector-verifier-v1');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

const context = {
  nowMs: vector.evaluation.nowMs,
  trustedRootIssuers: new Set(vector.evaluation.trustedRootIssuers),
  target: vector.evaluation.target,
  action: vector.evaluation.action
};

test('independent verifier has no reference-core import', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'independent', 'vector-verifier-v1.js'), 'utf8');
  assert.doesNotMatch(source, /src[\\/]trust-core|require\([^)]*trust-core|import[^;]*trust-core/);
});

test('independent verifier reproduces the published vector exactly', () => {
  const { signature, ...unsigned } = vector.envelope;
  assert.equal(keyIdFromSpki(vector.publicKeySpki), vector.keyId);
  assert.equal(canonicalJson(unsigned), vector.canonicalUnsigned);
  assert.equal(digestUnsignedEnvelope(vector.envelope), vector.envelopeDigest);

  const result = inspectEnvelope(vector.envelope, context);
  assert.equal(result.ok, true);
  assert.equal(result.signatureValid, true);
  assert.equal(result.derivedKeyId, vector.keyId);
  assert.equal(result.canonicalUnsigned, vector.canonicalUnsigned);
  assert.equal(result.envelopeDigest, vector.envelopeDigest);
  assert.equal(result.code, vector.evaluation.expectedCode);
  assert.equal(typeof signature, 'string');
});

test('independent verifier rejects mutation of signed bytes', () => {
  const changed = structuredClone(vector.envelope);
  changed.body.actions = ['read', 'write'];
  assert.equal(inspectEnvelope(changed, context).code, 'INVALID_SIGNATURE');
});

test('independent verifier refuses an untrusted root', () => {
  const result = inspectEnvelope(vector.envelope, { ...context, trustedRootIssuers: new Set() });
  assert.equal(result.code, 'UNTRUSTED_ROOT_ISSUER');
});

test('independent verifier refuses an expired vector', () => {
  const expiredAt = Date.parse(vector.envelope.expiresAt);
  const result = inspectEnvelope(vector.envelope, { ...context, nowMs: expiredAt });
  assert.equal(result.code, 'EXPIRED');
});

test('independent verifier enforces exact target and action scope', () => {
  assert.equal(inspectEnvelope(vector.envelope, { ...context, target: 'fixture:other' }).code, 'WRONG_TARGET');
  assert.equal(inspectEnvelope(vector.envelope, { ...context, action: 'write' }).code, 'WRONG_ACTION');
});

console.log(`\n${passed} independent interop tests passed.`);