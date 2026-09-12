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
  evaluateCapabilityChain,
  createUseRequest,
  evaluateUseRequest,
  claimState
} = require('../src/trust-core');

const now = Date.parse('2026-09-12T10:00:00.000Z');
const t1 = '2026-09-12T09:00:00.000Z';
const t2 = '2026-09-12T11:00:00.000Z';
const root = generateIdentity();
const delegate = generateIdentity();
const child = generateIdentity();
const stranger = generateIdentity();
const trustedRootIssuers = new Set([root.keyId]);
const nonce = (seed) => Buffer.from(`axm-trust-${seed}-nonce`).toString('base64url');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

function cap(issuer, subject, overrides = {}) {
  return createCapability(issuer, {
    subject,
    target: 'project:alpha',
    actions: ['propose', 'read'],
    delegationDepth: 1,
    issuedAt: t1,
    expiresAt: t2,
    nonce: nonce(overrides.seed || 'cap'),
    ...overrides
  });
}

test('canonicalization ignores object insertion order', () => {
  assert.equal(canonicalize({ z: 1, a: ['x', true] }), canonicalize({ a: ['x', true], z: 1 }));
});

test('signed envelope verifies exact bytes and rejects mutation', () => {
  const env = signEnvelope({ identity: root, issuedAt: t1, expiresAt: t2, nonce: nonce('exact'), body: { claim: 'demo' } });
  assert.equal(verifyEnvelope(env, { nowMs: now }).signatureValid, true);
  const changed = structuredClone(env);
  changed.body.claim = 'changed';
  assert.equal(verifyEnvelope(changed, { nowMs: now }).code, 'INVALID_SIGNATURE');
});

test('embedded public key cannot be swapped', () => {
  const env = signEnvelope({ identity: root, issuedAt: t1, expiresAt: t2, nonce: nonce('swap'), body: { claim: 'demo' } });
  assert.equal(verifyEnvelope({ ...env, publicKey: stranger.publicKey }, { nowMs: now }).code, 'ISSUER_KEY_MISMATCH');
});

test('malformed public key fails closed without crashing verifier', () => {
  const env = signEnvelope({ identity: root, issuedAt: t1, expiresAt: t2, nonce: nonce('bad-key'), body: { claim: 'demo' } });
  assert.equal(verifyEnvelope({ ...env, publicKey: 'AAAA' }, { nowMs: now }).code, 'ISSUER_KEY_MISMATCH');
});

test('unknown clock cannot validate a grant', () => {
  const grant = cap(root, delegate.keyId, { seed: 'clock' });
  assert.equal(evaluateCapability(grant, { target: 'project:alpha', action: 'read', trustedRootIssuers }).code, 'HOLD_CLOCK_UNKNOWN');
});

test('expiry fails closed', () => {
  const grant = cap(root, delegate.keyId, { seed: 'expired' });
  assert.equal(evaluateCapability(grant, { nowMs: Date.parse('2026-09-12T12:00:00.000Z'), target: 'project:alpha', action: 'read', trustedRootIssuers }).code, 'EXPIRED');
});

test('scope matches exact target and action', () => {
  const grant = cap(root, delegate.keyId, { seed: 'scope' });
  assert.equal(evaluateCapability(grant, { nowMs: now, target: 'project:alpha', action: 'read', trustedRootIssuers }).grantValid, true);
  assert.equal(evaluateCapability(grant, { nowMs: now, target: 'project:beta', action: 'read', trustedRootIssuers }).code, 'WRONG_TARGET');
  assert.equal(evaluateCapability(grant, { nowMs: now, target: 'project:alpha', action: 'merge', trustedRootIssuers }).code, 'WRONG_ACTION');
});

test('untrusted root key cannot self-authorize', () => {
  const grant = cap(stranger, stranger.keyId, { seed: 'untrusted' });
  assert.equal(evaluateCapability(grant, { nowMs: now, target: 'project:alpha', action: 'read', trustedRootIssuers }).code, 'UNTRUSTED_ROOT_ISSUER');
});

test('delegation narrows and cannot widen action or time', () => {
  const parent = cap(root, delegate.keyId, { seed: 'parent', delegationDepth: 2 });
  const childGrant = cap(delegate, child.keyId, { seed: 'child', actions: ['read'], delegationDepth: 1, parentCapabilityId: envelopeDigest(parent), issuedAt: '2026-09-12T09:10:00.000Z', expiresAt: '2026-09-12T10:30:00.000Z' });
  assert.equal(validateDelegation(parent, childGrant).ok, true);
  const actionEscalation = cap(delegate, child.keyId, { seed: 'action-up', actions: ['merge', 'read'], parentCapabilityId: envelopeDigest(parent), issuedAt: '2026-09-12T09:10:00.000Z', expiresAt: '2026-09-12T10:30:00.000Z' });
  assert.equal(validateDelegation(parent, actionEscalation).code, 'ACTION_ESCALATION');
  const timeEscalation = cap(delegate, child.keyId, { seed: 'time-up', actions: ['read'], parentCapabilityId: envelopeDigest(parent), issuedAt: '2026-09-12T09:10:00.000Z', expiresAt: '2026-09-12T12:00:00.000Z' });
  assert.equal(validateDelegation(parent, timeEscalation).code, 'TIME_ESCALATION');
});

test('only parent subject may issue child', () => {
  const parent = cap(root, delegate.keyId, { seed: 'issuer-parent' });
  const forged = cap(stranger, child.keyId, { seed: 'issuer-child', actions: ['read'], delegationDepth: 0, parentCapabilityId: envelopeDigest(parent), issuedAt: '2026-09-12T09:10:00.000Z', expiresAt: '2026-09-12T10:30:00.000Z' });
  assert.equal(validateDelegation(parent, forged).code, 'DELEGATE_ISSUER_MISMATCH');
});

test('delegated grant requires full chain', () => {
  const parent = cap(root, delegate.keyId, { seed: 'chain-parent' });
  const leaf = cap(delegate, child.keyId, { seed: 'chain-leaf', actions: ['read'], delegationDepth: 0, parentCapabilityId: envelopeDigest(parent), issuedAt: '2026-09-12T09:10:00.000Z', expiresAt: '2026-09-12T10:30:00.000Z' });
  assert.equal(evaluateCapability(leaf, { nowMs: now, target: 'project:alpha', action: 'read', trustedRootIssuers }).code, 'HOLD_PARENT_CHAIN_REQUIRED');
  assert.equal(evaluateCapabilityChain([parent, leaf], { nowMs: now, target: 'project:alpha', action: 'read', trustedRootIssuers }).grantValid, true);
});

test('issuer revokes exact capability', () => {
  const grant = cap(root, delegate.keyId, { seed: 'rev-cap' });
  const rev = createRevocation(root, { capabilityId: envelopeDigest(grant), issuedAt: '2026-09-12T09:30:00.000Z', expiresAt: t2, nonce: nonce('rev') });
  assert.equal(evaluateCapability(grant, { nowMs: now, target: 'project:alpha', action: 'read', revocations: [rev], trustedRootIssuers }).code, 'REVOKED');
});

test('foreign signer cannot revoke', () => {
  const grant = cap(root, delegate.keyId, { seed: 'foreign-cap' });
  const rev = createRevocation(stranger, { capabilityId: envelopeDigest(grant), issuedAt: '2026-09-12T09:30:00.000Z', expiresAt: t2, nonce: nonce('foreign-rev') });
  assert.equal(evaluateCapability(grant, { nowMs: now, target: 'project:alpha', action: 'read', revocations: [rev], trustedRootIssuers }).grantValid, true);
});

test('short revocation cannot silently resurrect capability', () => {
  const grant = cap(root, delegate.keyId, { seed: 'short-cap' });
  const rev = createRevocation(root, { capabilityId: envelopeDigest(grant), issuedAt: '2026-09-12T09:30:00.000Z', expiresAt: '2026-09-12T10:30:00.000Z', nonce: nonce('short-rev') });
  assert.equal(evaluateCapability(grant, { nowMs: now, target: 'project:alpha', action: 'read', revocations: [rev], trustedRootIssuers }).code, 'HOLD_INVALID_REVOCATION_WINDOW');
});

test('revoking an ancestor invalidates the descendant chain', () => {
  const parent = cap(root, delegate.keyId, { seed: 'rev-parent', delegationDepth: 1 });
  const leaf = cap(delegate, child.keyId, { seed: 'rev-leaf', actions: ['read'], delegationDepth: 0, parentCapabilityId: envelopeDigest(parent), issuedAt: '2026-09-12T09:10:00.000Z', expiresAt: '2026-09-12T10:30:00.000Z' });
  const rev = createRevocation(root, { capabilityId: envelopeDigest(parent), issuedAt: '2026-09-12T09:30:00.000Z', expiresAt: t2, nonce: nonce('rev-parent-packet') });
  const result = evaluateCapabilityChain([parent, leaf], { nowMs: now, target: 'project:alpha', action: 'read', revocations: [rev], trustedRootIssuers });
  assert.equal(result.code, 'REVOKED');
  assert.equal(result.chainIndex, 0);
});

test('foreign ancestor revocation does not invalidate descendant chain', () => {
  const parent = cap(root, delegate.keyId, { seed: 'foreign-parent', delegationDepth: 1 });
  const leaf = cap(delegate, child.keyId, { seed: 'foreign-leaf', actions: ['read'], delegationDepth: 0, parentCapabilityId: envelopeDigest(parent), issuedAt: '2026-09-12T09:10:00.000Z', expiresAt: '2026-09-12T10:30:00.000Z' });
  const rev = createRevocation(stranger, { capabilityId: envelopeDigest(parent), issuedAt: '2026-09-12T09:30:00.000Z', expiresAt: t2, nonce: nonce('foreign-parent-rev') });
  const result = evaluateCapabilityChain([parent, leaf], { nowMs: now, target: 'project:alpha', action: 'read', revocations: [rev], trustedRootIssuers });
  assert.equal(result.grantValid, true);
});

test('short ancestor revocation holds descendant chain instead of allowing resurrection', () => {
  const parent = cap(root, delegate.keyId, { seed: 'short-parent', delegationDepth: 1 });
  const leaf = cap(delegate, child.keyId, { seed: 'short-leaf', actions: ['read'], delegationDepth: 0, parentCapabilityId: envelopeDigest(parent), issuedAt: '2026-09-12T09:10:00.000Z', expiresAt: '2026-09-12T10:30:00.000Z' });
  const rev = createRevocation(root, { capabilityId: envelopeDigest(parent), issuedAt: '2026-09-12T09:30:00.000Z', expiresAt: '2026-09-12T10:30:00.000Z', nonce: nonce('short-parent-rev') });
  const result = evaluateCapabilityChain([parent, leaf], { nowMs: now, target: 'project:alpha', action: 'read', revocations: [rev], trustedRootIssuers });
  assert.equal(result.code, 'HOLD_INVALID_REVOCATION_WINDOW');
  assert.equal(result.chainIndex, 0);
});

test('one-use replay is only locally detectable', () => {
  const grant = cap(root, delegate.keyId, { seed: 'one-use', oneUse: true, delegationDepth: 0 });
  const first = evaluateCapability(grant, { nowMs: now, target: 'project:alpha', action: 'read', trustedRootIssuers });
  assert.equal(first.grantValid, true);
  assert.equal(evaluateCapability(grant, { nowMs: now, target: 'project:alpha', action: 'read', trustedRootIssuers, localConsumedIds: new Set([first.capabilityId]) }).code, 'LOCAL_REPLAY');
});

test('one-use grants cannot delegate in v0.1', () => {
  assert.throws(
    () => cap(root, delegate.keyId, { seed: 'one-use-delegate', oneUse: true, delegationDepth: 1 }),
    (error) => error && error.code === 'ONE_USE_DELEGATION_FORBIDDEN'
  );
});

test('grant alone does not claim current requester possession', () => {
  const grant = cap(root, delegate.keyId, { seed: 'grant-only' });
  const result = evaluateCapability(grant, { nowMs: now, target: 'project:alpha', action: 'read', trustedRootIssuers });
  assert.equal(result.code, 'GRANT_VALID_FOR_SCOPE');
  assert.equal(result.subject, delegate.keyId);
});

test('subject-signed use request proves possession for exact grant and scope', () => {
  const grant = cap(root, delegate.keyId, { seed: 'use-grant' });
  const request = createUseRequest(delegate, { capabilityId: envelopeDigest(grant), target: 'project:alpha', action: 'read', issuedAt: '2026-09-12T09:59:00.000Z', expiresAt: '2026-09-12T10:01:00.000Z', nonce: nonce('use-request') });
  assert.equal(evaluateUseRequest([grant], request, { nowMs: now, trustedRootIssuers }).code, 'AUTHORIZED_USE');
});

test('different key cannot use someone else capability', () => {
  const grant = cap(root, delegate.keyId, { seed: 'stolen-grant' });
  const request = createUseRequest(stranger, { capabilityId: envelopeDigest(grant), target: 'project:alpha', action: 'read', issuedAt: '2026-09-12T09:59:00.000Z', expiresAt: '2026-09-12T10:01:00.000Z', nonce: nonce('stolen-use') });
  assert.equal(evaluateUseRequest([grant], request, { nowMs: now, trustedRootIssuers }).code, 'SUBJECT_POSSESSION_MISMATCH');
});

test('use request is bound to exact capability id', () => {
  const grant = cap(root, delegate.keyId, { seed: 'bind-grant' });
  const request = createUseRequest(delegate, { capabilityId: '0'.repeat(64), target: 'project:alpha', action: 'read', issuedAt: '2026-09-12T09:59:00.000Z', expiresAt: '2026-09-12T10:01:00.000Z', nonce: nonce('bind-use') });
  assert.equal(evaluateUseRequest([grant], request, { nowMs: now, trustedRootIssuers }).code, 'CAPABILITY_BINDING_MISMATCH');
});

test('signature does not claim truth or identity continuity', () => {
  const env = signEnvelope({ identity: root, issuedAt: t1, expiresAt: t2, nonce: nonce('claims'), body: { statement: 'the moon is cheese' } });
  const state = claimState(env, { nowMs: now });
  assert.equal(state.truth, 'NOT_EVALUATED');
  assert.equal(state.identityContinuity, 'NOT_ESTABLISHED_BY_SIGNATURE_ALONE');
});

console.log(`\n${passed} trust-core tests passed.`);
