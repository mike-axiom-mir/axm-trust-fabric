'use strict';

const assert = require('node:assert/strict');
const {
  canonicalize,
  generateIdentity,
  envelopeDigest,
  signEnvelope,
  verifyEnvelope,
  createCapability,
  validateDelegation,
  createRevocation,
  evaluateCapability,
  claimState
} = require('../src/trust-core');

const t0 = Date.parse('2026-09-12T10:00:00.000Z');
const t1 = '2026-09-12T09:00:00.000Z';
const t2 = '2026-09-12T11:00:00.000Z';
const root = generateIdentity();
const delegate = generateIdentity();
const child = generateIdentity();
const stranger = generateIdentity();

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function nonce(seed) {
  return Buffer.from(`axm-trust-${seed}-nonce`).toString('base64url');
}

test('canonicalization ignores insertion order', () => {
  assert.equal(canonicalize({ z: 1, a: ['x', true] }), canonicalize({ a: ['x', true], z: 1 }));
});

test('signed envelope verifies exact bytes', () => {
  const env = signEnvelope({ identity: root, issuedAt: t1, expiresAt: t2, nonce: nonce('exact'), body: { claim: 'demo', truth: 'not-evaluated' } });
  assert.equal(verifyEnvelope(env, { nowMs: t0 }).signatureValid, true);
  const changed = structuredClone(env);
  changed.body.claim = 'changed';
  assert.equal(verifyEnvelope(changed, { nowMs: t0 }).code, 'INVALID_SIGNATURE');
});

test('embedded public key cannot be swapped', () => {
  const env = signEnvelope({ identity: root, issuedAt: t1, expiresAt: t2, nonce: nonce('swap'), body: { claim: 'demo' } });
  const changed = { ...env, publicKey: stranger.publicKey };
  assert.equal(verifyEnvelope(changed, { nowMs: t0 }).code, 'ISSUER_KEY_MISMATCH');
});

test('unknown clock never becomes authorization', () => {
  const cap = createCapability(root, { subject: delegate.keyId, target: 'session:1', actions: ['join'], delegationDepth: 1, issuedAt: t1, expiresAt: t2, nonce: nonce('clock') });
  assert.equal(evaluateCapability(cap, { target: 'session:1', action: 'join' }).code, 'HOLD_CLOCK_UNKNOWN');
});

test('expiry fails closed', () => {
  const cap = createCapability(root, { subject: delegate.keyId, target: 'session:1', actions: ['join'], issuedAt: t1, expiresAt: t2, nonce: nonce('expired') });
  assert.equal(evaluateCapability(cap, { nowMs: Date.parse('2026-09-12T12:00:00.000Z'), target: 'session:1', action: 'join' }).code, 'EXPIRED');
});

test('scope matches exact target and action', () => {
  const cap = createCapability(root, { subject: delegate.keyId, target: 'session:1', actions: ['join'], issuedAt: t1, expiresAt: t2, nonce: nonce('scope') });
  assert.equal(evaluateCapability(cap, { nowMs: t0, target: 'session:1', action: 'join' }).authorized, true);
  assert.equal(evaluateCapability(cap, { nowMs: t0, target: 'session:2', action: 'join' }).code, 'WRONG_TARGET');
  assert.equal(evaluateCapability(cap, { nowMs: t0, target: 'session:1', action: 'host' }).code, 'WRONG_ACTION');
});

test('delegation can narrow but not widen', () => {
  const parent = createCapability(root, { subject: delegate.keyId, target: 'project:alpha', actions: ['propose', 'read'], delegationDepth: 2, issuedAt: t1, expiresAt: t2, nonce: nonce('parent') });
  const childGrant = createCapability(delegate, { subject: child.keyId, target: 'project:alpha', actions: ['read'], delegationDepth: 1, parentCapabilityId: envelopeDigest(parent), issuedAt: '2026-09-12T09:10:00.000Z', expiresAt: '2026-09-12T10:30:00.000Z', nonce: nonce('child') });
  assert.equal(validateDelegation(parent, childGrant).ok, true);

  const actionEscalation = createCapability(delegate, { subject: child.keyId, target: 'project:alpha', actions: ['merge', 'read'], delegationDepth: 1, parentCapabilityId: envelopeDigest(parent), issuedAt: '2026-09-12T09:10:00.000Z', expiresAt: '2026-09-12T10:30:00.000Z', nonce: nonce('action-escalation') });
  assert.equal(validateDelegation(parent, actionEscalation).code, 'ACTION_ESCALATION');

  const timeEscalation = createCapability(delegate, { subject: child.keyId, target: 'project:alpha', actions: ['read'], delegationDepth: 1, parentCapabilityId: envelopeDigest(parent), issuedAt: '2026-09-12T09:10:00.000Z', expiresAt: '2026-09-12T12:00:00.000Z', nonce: nonce('time-escalation') });
  assert.equal(validateDelegation(parent, timeEscalation).code, 'TIME_ESCALATION');
});

test('only exact parent subject may delegate', () => {
  const parent = createCapability(root, { subject: delegate.keyId, target: 'project:alpha', actions: ['read'], delegationDepth: 1, issuedAt: t1, expiresAt: t2, nonce: nonce('issuer-parent') });
  const forgedChild = createCapability(stranger, { subject: child.keyId, target: 'project:alpha', actions: ['read'], delegationDepth: 0, parentCapabilityId: envelopeDigest(parent), issuedAt: '2026-09-12T09:10:00.000Z', expiresAt: '2026-09-12T10:30:00.000Z', nonce: nonce('issuer-child') });
  assert.equal(validateDelegation(parent, forgedChild).code, 'DELEGATE_ISSUER_MISMATCH');
});

test('issuer can revoke exact capability', () => {
  const cap = createCapability(root, { subject: delegate.keyId, target: 'session:9', actions: ['join'], issuedAt: t1, expiresAt: t2, nonce: nonce('rev-cap') });
  const rev = createRevocation(root, { capabilityId: envelopeDigest(cap), issuedAt: '2026-09-12T09:30:00.000Z', expiresAt: '2026-09-13T09:30:00.000Z', nonce: nonce('rev-packet') });
  assert.equal(evaluateCapability(cap, { nowMs: t0, target: 'session:9', action: 'join', revocations: [rev] }).code, 'REVOKED');
});

test('revocation signed by someone else does not revoke', () => {
  const cap = createCapability(root, { subject: delegate.keyId, target: 'session:9', actions: ['join'], issuedAt: t1, expiresAt: t2, nonce: nonce('foreign-cap') });
  const rev = createRevocation(stranger, { capabilityId: envelopeDigest(cap), issuedAt: '2026-09-12T09:30:00.000Z', expiresAt: '2026-09-13T09:30:00.000Z', nonce: nonce('foreign-rev') });
  assert.equal(evaluateCapability(cap, { nowMs: t0, target: 'session:9', action: 'join', revocations: [rev] }).authorized, true);
});

test('one-use replay is only locally detectable in v0.1', () => {
  const cap = createCapability(root, { subject: delegate.keyId, target: 'door:1', actions: ['enter'], oneUse: true, issuedAt: t1, expiresAt: t2, nonce: nonce('one-use') });
  const first = evaluateCapability(cap, { nowMs: t0, target: 'door:1', action: 'enter' });
  assert.equal(first.authorized, true);
  const consumed = new Set([first.capabilityId]);
  assert.equal(evaluateCapability(cap, { nowMs: t0, target: 'door:1', action: 'enter', localConsumedIds: consumed }).code, 'LOCAL_REPLAY');
});

test('signature does not claim truth or identity continuity', () => {
  const env = signEnvelope({ identity: root, issuedAt: t1, expiresAt: t2, nonce: nonce('claim-state'), body: { statement: 'the moon is cheese' } });
  const state = claimState(env, { nowMs: t0 });
  assert.equal(state.truth, 'NOT_EVALUATED');
  assert.equal(state.identityContinuity, 'NOT_ESTABLISHED_BY_SIGNATURE_ALONE');
});

console.log(`\n${passed} trust-core tests passed.`);
