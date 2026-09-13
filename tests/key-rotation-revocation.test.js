'use strict';

const assert = require('node:assert/strict');
const {
  generateIdentity,
  envelopeDigest,
  signEnvelope
} = require('../src/trust-core');
const { createKeyRotation } = require('../src/key-rotation');
const { createKeyRotationAcknowledgement } = require('../src/key-rotation-ack');
const {
  createKeyRotationRevocation,
  evaluateKeyRotationWithRevocations,
  evaluateTwoHopKeyRotationLineageWithRevocations
} = require('../src/key-rotation-revocation');

const a = generateIdentity();
const b = generateIdentity();
const c = generateIdentity();
const d = generateIdentity();
const stranger = generateIdentity();
const domain = 'axm:test:rotation-revocation';
const nonce = (seed) => Buffer.from(`axm-rotation-revocation-${seed}-nonce-material`).toString('base64url');
const activeNow = Date.parse('2026-09-13T01:30:00.000Z');

function firstRotation(overrides = {}) {
  return createKeyRotation(a, {
    successorIdentity: b,
    domain,
    effectiveAt: '2026-09-13T00:30:00.000Z',
    issuedAt: '2026-09-13T00:00:00.000Z',
    expiresAt: '2026-09-13T04:00:00.000Z',
    nonce: nonce('a-b'),
    ...overrides
  });
}

function secondRotation(overrides = {}) {
  return createKeyRotation(b, {
    successorIdentity: c,
    domain,
    effectiveAt: '2026-09-13T01:10:00.000Z',
    issuedAt: '2026-09-13T01:00:00.000Z',
    expiresAt: '2026-09-13T03:30:00.000Z',
    nonce: nonce('b-c'),
    ...overrides
  });
}

function acknowledgement(identity, rotation, seed, issuedAt, expiresAt) {
  return createKeyRotationAcknowledgement(identity, {
    rotation,
    issuedAt,
    expiresAt,
    nonce: nonce(seed)
  });
}

function revocation(identity, rotation, seed, overrides = {}) {
  return createKeyRotationRevocation(identity, {
    rotation,
    issuedAt: '2026-09-13T01:20:00.000Z',
    expiresAt: rotation.expiresAt,
    nonce: nonce(seed),
    ...overrides
  });
}

function rotationOptions(expectedPredecessor) {
  return { nowMs: activeNow, expectedPredecessor, domain };
}

function lineageFixture() {
  const ab = firstRotation();
  const bc = secondRotation();
  const ackB = acknowledgement(b, ab, 'ack-b', '2026-09-13T00:45:00.000Z', '2026-09-13T03:45:00.000Z');
  const ackC = acknowledgement(c, bc, 'ack-c', '2026-09-13T01:15:00.000Z', '2026-09-13T03:00:00.000Z');
  return { rotations: [ab, bc], acknowledgements: [ackB, ackC] };
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

test('exact predecessor-signed revocation enforces exact packet and causal issuance boundary', () => {
  const rotation = firstRotation();
  const packet = revocation(a, rotation, 'exact');
  const result = evaluateKeyRotationWithRevocations(rotation, [packet], rotationOptions(a.keyId));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ROTATION_REVOKED');
  assert.equal(result.revocationId, envelopeDigest(packet));
  assert.match(result.truthBoundary, /supplied valid revocation/);
  assert.match(result.truthBoundary, /global rotation freshness/);

  assert.throws(
    () => revocation(a, rotation, 'predated-local', { issuedAt: '2026-09-12T23:59:59.000Z' }),
    (error) => error && error.code === 'INVALID_ROTATION_REVOCATION_CAUSALITY'
  );

  const predated = signEnvelope({
    identity: a,
    issuedAt: '2026-09-12T23:59:59.000Z',
    expiresAt: rotation.expiresAt,
    nonce: nonce('predated-external'),
    body: {
      kind: 'key-rotation-revocation',
      rotationId: envelopeDigest(rotation),
      predecessorKeyId: rotation.body.predecessorKeyId,
      successorKeyId: rotation.body.successorKeyId,
      domain: rotation.body.domain,
      reasonCode: 'ROTATION_REVOKED'
    }
  });
  const predatedResult = evaluateKeyRotationWithRevocations(rotation, [predated], rotationOptions(a.keyId));
  assert.equal(predatedResult.ok, false);
  assert.equal(predatedResult.code, 'HOLD_INVALID_ROTATION_REVOCATION_CAUSALITY');
  assert.match(predatedResult.truthBoundary, /local signed-evidence causality contradiction/);
  assert.match(predatedResult.truthBoundary, /does not establish globally trustworthy time/);

  const equalIssuedAt = revocation(a, rotation, 'equal-issued-at', { issuedAt: rotation.issuedAt });
  const equalIssuedAtResult = evaluateKeyRotationWithRevocations(rotation, [equalIssuedAt], rotationOptions(a.keyId));
  assert.equal(equalIssuedAtResult.ok, false);
  assert.equal(equalIssuedAtResult.code, 'ROTATION_REVOKED');
});

test('foreign signer cannot revoke another predecessor exact rotation', () => {
  const rotation = firstRotation();
  const forged = signEnvelope({
    identity: stranger,
    issuedAt: '2026-09-13T01:20:00.000Z',
    expiresAt: rotation.expiresAt,
    nonce: nonce('foreign'),
    body: {
      kind: 'key-rotation-revocation',
      rotationId: envelopeDigest(rotation),
      predecessorKeyId: rotation.body.predecessorKeyId,
      successorKeyId: rotation.body.successorKeyId,
      domain: rotation.body.domain,
      reasonCode: 'ROTATION_REVOKED'
    }
  });
  const result = evaluateKeyRotationWithRevocations(rotation, [forged], rotationOptions(a.keyId));
  assert.equal(result.ok, true);
  assert.equal(result.code, 'KEY_ROTATION_USABLE_WITH_SUPPLIED_REVOCATION_EVIDENCE');
});

test('revocation is bound to the exact rotation digest even for same predecessor successor and domain', () => {
  const target = firstRotation({ nonce: nonce('target') });
  const other = firstRotation({ nonce: nonce('other') });
  assert.notEqual(envelopeDigest(target), envelopeDigest(other));
  const packet = revocation(a, other, 'other-revocation');
  const result = evaluateKeyRotationWithRevocations(target, [packet], rotationOptions(a.keyId));
  assert.equal(result.ok, true);
  assert.equal(result.code, 'KEY_ROTATION_USABLE_WITH_SUPPLIED_REVOCATION_EVIDENCE');
});

test('revoking A to C does not revoke unrelated A to B', () => {
  const ab = firstRotation();
  const ac = createKeyRotation(a, {
    successorIdentity: c,
    domain,
    effectiveAt: '2026-09-13T00:30:00.000Z',
    issuedAt: '2026-09-13T00:00:00.000Z',
    expiresAt: '2026-09-13T04:00:00.000Z',
    nonce: nonce('a-c')
  });
  const packet = revocation(a, ac, 'a-c-revocation');
  const result = evaluateKeyRotationWithRevocations(ab, [packet], rotationOptions(a.keyId));
  assert.equal(result.ok, true);
  assert.equal(result.successorKeyId, b.keyId);
});

test('short revocation window fails closed instead of permitting later resurrection', () => {
  const rotation = firstRotation();
  const packet = revocation(a, rotation, 'short', { expiresAt: '2026-09-13T03:00:00.000Z' });
  const result = evaluateKeyRotationWithRevocations(rotation, [packet], rotationOptions(a.keyId));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_INVALID_ROTATION_REVOCATION_WINDOW');
});

test('not-yet-valid matching revocation is not treated as already active', () => {
  const rotation = firstRotation();
  const packet = revocation(a, rotation, 'future', {
    issuedAt: '2026-09-13T02:00:00.000Z',
    expiresAt: '2026-09-13T04:00:00.000Z'
  });
  const result = evaluateKeyRotationWithRevocations(rotation, [packet], rotationOptions(a.keyId));
  assert.equal(result.ok, true);
  assert.equal(result.code, 'KEY_ROTATION_USABLE_WITH_SUPPLIED_REVOCATION_EVIDENCE');
});

test('absence of supplied matching revocation remains an explicit local-evidence boundary', () => {
  const rotation = firstRotation();
  const result = evaluateKeyRotationWithRevocations(rotation, [], rotationOptions(a.keyId));
  assert.equal(result.ok, true);
  assert.equal(result.code, 'KEY_ROTATION_USABLE_WITH_SUPPLIED_REVOCATION_EVIDENCE');
  assert.match(result.truthBoundary, /supplied to this evaluation/);
  assert.match(result.truthBoundary, /does not prove that no revocation exists elsewhere/);
  assert.match(result.truthBoundary, /globally fresh\/newest/);
});

test('valid supplied first-hop revocation invalidates otherwise-valid two-hop lineage', () => {
  const fixture = lineageFixture();
  const packet = revocation(a, fixture.rotations[0], 'lineage-hop-0');
  const result = evaluateTwoHopKeyRotationLineageWithRevocations(fixture.rotations, fixture.acknowledgements, {
    nowMs: activeNow,
    expectedOrigin: a.keyId,
    domain,
    revocationsByHop: [[packet], []]
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_ROTATION_REVOCATION_EVIDENCE:ROTATION_REVOKED');
  assert.equal(result.hop, 0);
});

test('valid supplied second-hop revocation invalidates otherwise-valid two-hop lineage', () => {
  const fixture = lineageFixture();
  const packet = revocation(b, fixture.rotations[1], 'lineage-hop-1');
  const result = evaluateTwoHopKeyRotationLineageWithRevocations(fixture.rotations, fixture.acknowledgements, {
    nowMs: activeNow,
    expectedOrigin: a.keyId,
    domain,
    revocationsByHop: [[], [packet]]
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_ROTATION_REVOCATION_EVIDENCE:ROTATION_REVOKED');
  assert.equal(result.hop, 1);
});

test('revocation evaluation preserves historical rotation and acknowledgement bytes', () => {
  const fixture = lineageFixture();
  const packet = revocation(a, fixture.rotations[0], 'preserve-history');
  const before = fixture.rotations.concat(fixture.acknowledgements).map((item) => ({
    bytes: JSON.stringify(item),
    id: envelopeDigest(item)
  }));
  const result = evaluateTwoHopKeyRotationLineageWithRevocations(fixture.rotations, fixture.acknowledgements, {
    nowMs: activeNow,
    expectedOrigin: a.keyId,
    domain,
    revocationsByHop: [[packet], []]
  });
  assert.equal(result.ok, false);
  const after = fixture.rotations.concat(fixture.acknowledgements).map((item) => ({
    bytes: JSON.stringify(item),
    id: envelopeDigest(item)
  }));
  assert.deepEqual(after, before);
});

console.log(`\n${passed} key-rotation revocation tests passed.`);
