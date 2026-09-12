'use strict';

const assert = require('node:assert/strict');
const {
  generateIdentity,
  signEnvelope,
  verifyEnvelope
} = require('../src/trust-core');
const {
  createKeyRotation,
  evaluateKeyRotation,
  compareKeyRotations
} = require('../src/key-rotation');

const predecessor = generateIdentity();
const successor = generateIdentity();
const alternateSuccessor = generateIdentity();
const stranger = generateIdentity();
const domain = 'axm:test:trust-root-rotation';
const nonce = (seed) => Buffer.from(`axm-key-rotation-${seed}-nonce-material`).toString('base64url');
const issuedAt = '2026-09-12T18:00:00.000Z';
const effectiveAt = '2026-09-12T18:10:00.000Z';
const expiresAt = '2026-09-12T20:00:00.000Z';
const activeNow = Date.parse('2026-09-12T18:30:00.000Z');

function rotation(overrides = {}) {
  return createKeyRotation(predecessor, {
    successorIdentity: successor,
    domain,
    effectiveAt,
    issuedAt,
    expiresAt,
    nonce: nonce('primary'),
    ...overrides
  });
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

test('predecessor can attest one bounded successor for an exact domain and active window', () => {
  const packet = rotation();
  const result = evaluateKeyRotation(packet, { nowMs: activeNow, expectedPredecessor: predecessor.keyId, domain });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'KEY_SUCCESSOR_ATTESTED_FOR_DOMAIN');
  assert.equal(result.predecessorKeyId, predecessor.keyId);
  assert.equal(result.successorKeyId, successor.keyId);
  assert.equal(result.validUntil, expiresAt);
  assert.match(result.truthBoundary, /does not prove same-person\/device identity/);
  assert.match(result.truthBoundary, /does not.*transfer capability\/root authority automatically/);
});

test('rotation cannot become usable when trusted time is unavailable', () => {
  const result = evaluateKeyRotation(rotation(), { expectedPredecessor: predecessor.keyId, domain });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_CLOCK_UNKNOWN');
});

test('signed rotation remains inactive before its explicit effective boundary', () => {
  const result = evaluateKeyRotation(rotation(), {
    nowMs: Date.parse('2026-09-12T18:05:00.000Z'),
    expectedPredecessor: predecessor.keyId,
    domain
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ROTATION_NOT_YET_EFFECTIVE');
});

test('effective boundary must stay inside the signed envelope window', () => {
  assert.throws(
    () => rotation({ effectiveAt: '2026-09-12T20:00:00.000Z', nonce: nonce('invalid-window') }),
    (error) => error && error.code === 'INVALID_ROTATION_WINDOW'
  );
});

test('foreign predecessor cannot satisfy an explicitly expected predecessor', () => {
  const foreign = createKeyRotation(stranger, {
    successorIdentity: successor,
    domain,
    effectiveAt,
    issuedAt,
    expiresAt,
    nonce: nonce('foreign')
  });
  const result = evaluateKeyRotation(foreign, { nowMs: activeNow, expectedPredecessor: predecessor.keyId, domain });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ROTATION_PREDECESSOR_MISMATCH');
});

test('successor key id must be bound to the exact successor public key', () => {
  const malformed = signEnvelope({
    identity: predecessor,
    issuedAt,
    expiresAt,
    nonce: nonce('successor-mismatch'),
    body: {
      kind: 'key-rotation',
      predecessorKeyId: predecessor.keyId,
      successorKeyId: successor.keyId,
      successorPublicKey: alternateSuccessor.publicKey,
      domain,
      effectiveAt
    }
  });
  const result = evaluateKeyRotation(malformed, { nowMs: activeNow, expectedPredecessor: predecessor.keyId, domain });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SUCCESSOR_KEY_MISMATCH');
});

test('rotation authority is limited to the exact signed domain', () => {
  const result = evaluateKeyRotation(rotation(), {
    nowMs: activeNow,
    expectedPredecessor: predecessor.keyId,
    domain: 'axm:test:other-domain'
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ROTATION_DOMAIN_MISMATCH');
});

test('creating a rotation does not rewrite or invalidate older predecessor signatures', () => {
  const historical = signEnvelope({
    identity: predecessor,
    issuedAt: '2026-09-12T17:00:00.000Z',
    expiresAt,
    nonce: nonce('historical'),
    body: { kind: 'historical-test-evidence', value: 'preserve-exact-bytes' }
  });
  const before = verifyEnvelope(historical, { nowMs: activeNow });
  const packet = rotation({ nonce: nonce('preservation-rotation') });
  const after = verifyEnvelope(historical, { nowMs: activeNow });
  assert.equal(evaluateKeyRotation(packet, { nowMs: activeNow, expectedPredecessor: predecessor.keyId, domain }).ok, true);
  assert.equal(before.ok, true);
  assert.equal(after.ok, true);
  assert.equal(before.envelopeId, after.envelopeId);
});

test('competing simultaneously usable successor statements are exposed as conflict and never auto-resolved', () => {
  const left = rotation({ nonce: nonce('fork-left') });
  const identical = compareKeyRotations(left, left, { nowMs: activeNow, expectedPredecessor: predecessor.keyId, domain });
  assert.equal(identical.ok, true);
  assert.equal(identical.code, 'ROTATIONS_IDENTICAL');

  const right = createKeyRotation(predecessor, {
    successorIdentity: alternateSuccessor,
    domain,
    effectiveAt,
    issuedAt,
    expiresAt,
    nonce: nonce('fork-right')
  });
  const conflict = compareKeyRotations(left, right, { nowMs: activeNow, expectedPredecessor: predecessor.keyId, domain });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, 'ROTATION_FORK_EVIDENCE');
  assert.equal(conflict.winner, undefined);
  assert.notEqual(conflict.left.rotationId, conflict.right.rotationId);
  assert.match(conflict.truthBoundary, /no winner is selected/);
});

console.log(`\n${passed} key-rotation tests passed.`);
