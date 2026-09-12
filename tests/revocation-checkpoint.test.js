'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  canonicalize,
  generateIdentity,
  createCapability,
  createRevocation,
  envelopeDigest,
  signEnvelope
} = require('../src/trust-core');
const {
  createRevocationCheckpoint,
  evaluateRevocationCheckpoint
} = require('../src/revocation-checkpoint');

const root = generateIdentity();
const delegate = generateIdentity();
const stranger = generateIdentity();
const now = Date.parse('2026-09-12T10:00:00.000Z');
const nonce = (seed) => Buffer.from(`axm-checkpoint-${seed}-nonce`).toString('base64url');
const emptyDigest = crypto.createHash('sha256').update(canonicalize([])).digest('hex');

const grant = createCapability(root, {
  subject: delegate.keyId,
  target: 'project:alpha',
  actions: ['read'],
  delegationDepth: 0,
  issuedAt: '2026-09-12T09:00:00.000Z',
  expiresAt: '2026-09-12T11:00:00.000Z',
  nonce: nonce('grant')
});

const revocation = createRevocation(root, {
  capabilityId: envelopeDigest(grant),
  issuedAt: '2026-09-12T09:30:00.000Z',
  expiresAt: '2026-09-12T11:00:00.000Z',
  nonce: nonce('revocation')
});

const checkpoint = createRevocationCheckpoint(root, {
  revocations: [revocation],
  completeThrough: '2026-09-12T09:40:00.000Z',
  issuedAt: '2026-09-12T09:45:00.000Z',
  expiresAt: '2026-09-12T10:30:00.000Z',
  nonce: nonce('checkpoint')
});

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

test('exact revocation manifest is attested only through the checkpoint timestamp', () => {
  const result = evaluateRevocationCheckpoint(checkpoint, { nowMs: now, revocations: [revocation], expectedIssuer: root.keyId });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'REVOCATION_SET_ATTESTED_THROUGH');
  assert.equal(result.completeThrough, '2026-09-12T09:40:00.000Z');
  assert.match(result.truthBoundary, /does not establish that no newer revocation exists/);
});

test('omitting a checkpointed revocation breaks the manifest digest', () => {
  const result = evaluateRevocationCheckpoint(checkpoint, { nowMs: now, revocations: [], expectedIssuer: root.keyId });
  assert.equal(result.code, 'REVOCATION_SET_DIGEST_MISMATCH');
});

test('substituting another same-issuer revocation breaks the manifest digest', () => {
  const substitute = createRevocation(root, {
    capabilityId: 'f'.repeat(64),
    issuedAt: '2026-09-12T09:31:00.000Z',
    expiresAt: '2026-09-12T11:00:00.000Z',
    nonce: nonce('substitute')
  });
  const result = evaluateRevocationCheckpoint(checkpoint, { nowMs: now, revocations: [substitute], expectedIssuer: root.keyId });
  assert.equal(result.code, 'REVOCATION_SET_DIGEST_MISMATCH');
});

test('foreign checkpoint signer cannot attest another issuer revocation state', () => {
  const foreign = createRevocationCheckpoint(stranger, {
    revocations: [],
    completeThrough: '2026-09-12T09:40:00.000Z',
    issuedAt: '2026-09-12T09:45:00.000Z',
    expiresAt: '2026-09-12T10:30:00.000Z',
    nonce: nonce('foreign-checkpoint')
  });
  const result = evaluateRevocationCheckpoint(foreign, { nowMs: now, revocations: [], expectedIssuer: root.keyId });
  assert.equal(result.code, 'CHECKPOINT_ISSUER_MISMATCH');
});

test('checkpoint cannot claim completeness later than its signing time', () => {
  const impossible = signEnvelope({
    identity: root,
    issuedAt: '2026-09-12T09:45:00.000Z',
    expiresAt: '2026-09-12T10:30:00.000Z',
    nonce: nonce('future-through'),
    body: {
      kind: 'revocation-checkpoint',
      completeThrough: '2026-09-12T09:50:00.000Z',
      revocationCount: 0,
      revocationIdsDigest: emptyDigest
    }
  });
  const result = evaluateRevocationCheckpoint(impossible, { nowMs: now, revocations: [], expectedIssuer: root.keyId });
  assert.equal(result.code, 'INVALID_CHECKPOINT_WINDOW');
});

test('expired checkpoint is stale rather than current freshness evidence', () => {
  const result = evaluateRevocationCheckpoint(checkpoint, { nowMs: Date.parse('2026-09-12T10:31:00.000Z'), revocations: [revocation], expectedIssuer: root.keyId });
  assert.equal(result.code, 'STALE_REVOCATION_CHECKPOINT');
});

test('unknown clock holds rather than claiming freshness', () => {
  const result = evaluateRevocationCheckpoint(checkpoint, { revocations: [revocation], expectedIssuer: root.keyId });
  assert.equal(result.code, 'HOLD_CLOCK_UNKNOWN');
});

test('duplicate revocation packet is rejected instead of normalized away', () => {
  assert.throws(
    () => createRevocationCheckpoint(root, {
      revocations: [revocation, revocation],
      completeThrough: '2026-09-12T09:40:00.000Z',
      issuedAt: '2026-09-12T09:45:00.000Z',
      expiresAt: '2026-09-12T10:30:00.000Z',
      nonce: nonce('duplicate')
    }),
    (error) => error && error.code === 'DUPLICATE_REVOCATION_PACKET'
  );
});

console.log(`\n${passed} revocation-checkpoint tests passed.`);
