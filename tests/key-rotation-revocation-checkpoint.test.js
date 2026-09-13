'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  canonicalize,
  generateIdentity,
  signEnvelope
} = require('../src/trust-core');
const { createKeyRotation } = require('../src/key-rotation');
const { createKeyRotationRevocation } = require('../src/key-rotation-revocation');
const {
  createKeyRotationRevocationCheckpoint,
  evaluateKeyRotationRevocationCheckpoint
} = require('../src/key-rotation-revocation-checkpoint');

const a = generateIdentity();
const b = generateIdentity();
const c = generateIdentity();
const stranger = generateIdentity();
const domain = 'axm:test:rotation-revocation-checkpoint';
const now = Date.parse('2026-09-13T02:30:00.000Z');
const nonce = (seed) => Buffer.from(`axm-rotation-revocation-checkpoint-${seed}-nonce-material`).toString('base64url');
const emptyDigest = crypto.createHash('sha256').update(canonicalize([])).digest('hex');

function rotation(predecessor, successor, seed, overrides = {}) {
  return createKeyRotation(predecessor, {
    successorIdentity: successor,
    domain,
    effectiveAt: '2026-09-13T00:15:00.000Z',
    issuedAt: '2026-09-13T00:00:00.000Z',
    expiresAt: '2026-09-13T04:00:00.000Z',
    nonce: nonce(`rotation-${seed}`),
    ...overrides
  });
}

function revocation(predecessor, targetRotation, seed, overrides = {}) {
  return createKeyRotationRevocation(predecessor, {
    rotation: targetRotation,
    issuedAt: '2026-09-13T01:00:00.000Z',
    expiresAt: targetRotation.expiresAt,
    nonce: nonce(`revocation-${seed}`),
    ...overrides
  });
}

const ab = rotation(a, b, 'a-b');
const ac = rotation(a, c, 'a-c');
const revokedAb = revocation(a, ab, 'a-b');
const revokedAc = revocation(a, ac, 'a-c', { issuedAt: '2026-09-13T01:10:00.000Z' });

const checkpoint = createKeyRotationRevocationCheckpoint(a, {
  revocations: [revokedAb, revokedAc],
  completeThrough: '2026-09-13T02:00:00.000Z',
  issuedAt: '2026-09-13T02:10:00.000Z',
  expiresAt: '2026-09-13T03:00:00.000Z',
  nonce: nonce('checkpoint')
});

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

test('exact same-predecessor rotation-revocation manifest is attested only through the historical boundary', () => {
  const result = evaluateKeyRotationRevocationCheckpoint(checkpoint, {
    nowMs: now,
    revocations: [revokedAc, revokedAb],
    expectedPredecessor: a.keyId
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'ROTATION_REVOCATION_SET_ATTESTED_THROUGH');
  assert.equal(result.revocationCount, 2);
  assert.equal(result.completeThrough, '2026-09-13T02:00:00.000Z');
  assert.match(result.truthBoundary, /exact supplied same-predecessor/);
  assert.match(result.truthBoundary, /does not prove that referenced rotations were separately valid/);
  assert.match(result.truthBoundary, /no newer or unseen revocation exists/);
  assert.match(result.truthBoundary, /identity or authority transferred/);
});

test('omitting one checkpointed rotation revocation breaks the signed manifest digest', () => {
  const result = evaluateKeyRotationRevocationCheckpoint(checkpoint, {
    nowMs: now,
    revocations: [revokedAb],
    expectedPredecessor: a.keyId
  });
  assert.equal(result.code, 'ROTATION_REVOCATION_SET_DIGEST_MISMATCH');
});

test('substituting another same-predecessor rotation revocation breaks the signed manifest digest', () => {
  const alternate = rotation(a, b, 'alternate', { nonce: nonce('rotation-alternate-distinct') });
  const substitute = revocation(a, alternate, 'alternate', { issuedAt: '2026-09-13T01:20:00.000Z' });
  const result = evaluateKeyRotationRevocationCheckpoint(checkpoint, {
    nowMs: now,
    revocations: [revokedAb, substitute],
    expectedPredecessor: a.keyId
  });
  assert.equal(result.code, 'ROTATION_REVOCATION_SET_DIGEST_MISMATCH');
});

test('foreign checkpoint signer cannot attest another expected predecessor state', () => {
  const foreign = createKeyRotationRevocationCheckpoint(stranger, {
    revocations: [],
    completeThrough: '2026-09-13T02:00:00.000Z',
    issuedAt: '2026-09-13T02:10:00.000Z',
    expiresAt: '2026-09-13T03:00:00.000Z',
    nonce: nonce('foreign-checkpoint')
  });
  const result = evaluateKeyRotationRevocationCheckpoint(foreign, {
    nowMs: now,
    revocations: [],
    expectedPredecessor: a.keyId
  });
  assert.equal(result.code, 'ROTATION_REVOCATION_CHECKPOINT_ISSUER_MISMATCH');
});

test('checkpoint cannot mix another predecessor rotation-revocation packet into its manifest', () => {
  const strangerRotation = rotation(stranger, b, 'stranger-b');
  const foreignRevocation = revocation(stranger, strangerRotation, 'stranger-b');
  assert.throws(
    () => createKeyRotationRevocationCheckpoint(a, {
      revocations: [revokedAb, foreignRevocation],
      completeThrough: '2026-09-13T02:00:00.000Z',
      issuedAt: '2026-09-13T02:10:00.000Z',
      expiresAt: '2026-09-13T03:00:00.000Z',
      nonce: nonce('mixed-issuer')
    }),
    (error) => error && error.code === 'ROTATION_REVOCATION_CHECKPOINT_PACKET_ISSUER_MISMATCH'
  );
});

test('rotation revocation issued after completeThrough cannot be included as historically covered', () => {
  const late = revocation(a, ab, 'late', { issuedAt: '2026-09-13T02:05:00.000Z' });
  assert.throws(
    () => createKeyRotationRevocationCheckpoint(a, {
      revocations: [late],
      completeThrough: '2026-09-13T02:00:00.000Z',
      issuedAt: '2026-09-13T02:10:00.000Z',
      expiresAt: '2026-09-13T03:00:00.000Z',
      nonce: nonce('late-manifest')
    }),
    (error) => error && error.code === 'ROTATION_REVOCATION_CHECKPOINT_PACKET_AFTER_COMPLETE_THROUGH'
  );
});

test('checkpoint cannot claim completeness later than its own signing time', () => {
  const impossible = signEnvelope({
    identity: a,
    issuedAt: '2026-09-13T02:10:00.000Z',
    expiresAt: '2026-09-13T03:00:00.000Z',
    nonce: nonce('future-complete-through'),
    body: {
      kind: 'key-rotation-revocation-checkpoint',
      completeThrough: '2026-09-13T02:11:00.000Z',
      revocationCount: 0,
      revocationIdsDigest: emptyDigest
    }
  });
  const result = evaluateKeyRotationRevocationCheckpoint(impossible, {
    nowMs: now,
    revocations: [],
    expectedPredecessor: a.keyId
  });
  assert.equal(result.code, 'INVALID_ROTATION_REVOCATION_CHECKPOINT_WINDOW');
});

test('expired rotation-revocation checkpoint is stale rather than current freshness evidence', () => {
  const result = evaluateKeyRotationRevocationCheckpoint(checkpoint, {
    nowMs: Date.parse('2026-09-13T03:01:00.000Z'),
    revocations: [revokedAb, revokedAc],
    expectedPredecessor: a.keyId
  });
  assert.equal(result.code, 'STALE_ROTATION_REVOCATION_CHECKPOINT');
});

test('unknown clock holds rather than inventing checkpoint freshness', () => {
  const result = evaluateKeyRotationRevocationCheckpoint(checkpoint, {
    revocations: [revokedAb, revokedAc],
    expectedPredecessor: a.keyId
  });
  assert.equal(result.code, 'HOLD_CLOCK_UNKNOWN');
});

test('duplicate rotation-revocation packet is rejected instead of normalized away', () => {
  assert.throws(
    () => createKeyRotationRevocationCheckpoint(a, {
      revocations: [revokedAb, revokedAb],
      completeThrough: '2026-09-13T02:00:00.000Z',
      issuedAt: '2026-09-13T02:10:00.000Z',
      expiresAt: '2026-09-13T03:00:00.000Z',
      nonce: nonce('duplicate')
    }),
    (error) => error && error.code === 'DUPLICATE_ROTATION_REVOCATION_PACKET'
  );
});

console.log(`\n${passed} key-rotation revocation checkpoint tests passed.`);
