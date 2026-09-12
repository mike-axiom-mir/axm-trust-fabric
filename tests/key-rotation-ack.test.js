'use strict';

const assert = require('node:assert/strict');
const {
  generateIdentity,
  envelopeDigest,
  signEnvelope
} = require('../src/trust-core');
const {
  createKeyRotation,
  compareKeyRotations
} = require('../src/key-rotation');
const {
  createKeyRotationAcknowledgement,
  evaluateKeyRotationAcknowledgement
} = require('../src/key-rotation-ack');

const predecessor = generateIdentity();
const successor = generateIdentity();
const alternateSuccessor = generateIdentity();
const stranger = generateIdentity();
const domain = 'axm:test:trust-root-rotation';
const nonce = (seed) => Buffer.from(`axm-key-rotation-ack-${seed}-nonce-material`).toString('base64url');
const rotationIssuedAt = '2026-09-12T18:00:00.000Z';
const effectiveAt = '2026-09-12T18:10:00.000Z';
const rotationExpiresAt = '2026-09-12T20:00:00.000Z';
const acknowledgementIssuedAt = '2026-09-12T18:15:00.000Z';
const acknowledgementExpiresAt = '2026-09-12T19:45:00.000Z';
const activeNow = Date.parse('2026-09-12T18:30:00.000Z');

function rotation(overrides = {}) {
  return createKeyRotation(predecessor, {
    successorIdentity: successor,
    domain,
    effectiveAt,
    issuedAt: rotationIssuedAt,
    expiresAt: rotationExpiresAt,
    nonce: nonce('rotation-primary'),
    ...overrides
  });
}

function acknowledgement(packet, overrides = {}) {
  return createKeyRotationAcknowledgement(successor, {
    rotation: packet,
    issuedAt: acknowledgementIssuedAt,
    expiresAt: acknowledgementExpiresAt,
    nonce: nonce('ack-primary'),
    ...overrides
  });
}

function signedAcknowledgement(identity, packet, bodyOverrides = {}, envelopeOverrides = {}) {
  return signEnvelope({
    identity,
    issuedAt: acknowledgementIssuedAt,
    expiresAt: acknowledgementExpiresAt,
    nonce: nonce('manual-ack'),
    ...envelopeOverrides,
    body: {
      kind: 'key-rotation-ack',
      rotationId: envelopeDigest(packet),
      predecessorKeyId: packet.body.predecessorKeyId,
      successorKeyId: packet.body.successorKeyId,
      domain: packet.body.domain,
      ...bodyOverrides
    }
  });
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

test('successor proves possession by signing an acknowledgement bound to the exact rotation', () => {
  const packet = rotation();
  const ack = acknowledgement(packet);
  const result = evaluateKeyRotationAcknowledgement(packet, ack, {
    nowMs: activeNow,
    expectedPredecessor: predecessor.keyId,
    domain
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'SUCCESSOR_POSSESSION_CONFIRMED_FOR_ROTATION');
  assert.equal(result.rotationId, envelopeDigest(packet));
  assert.equal(result.successorKeyId, successor.keyId);
  assert.equal(result.authority, undefined);
  assert.equal(result.winner, undefined);
  assert.match(result.truthBoundary, /does not prove human\/device identity continuity/);
  assert.match(result.truthBoundary, /does not.*transfer root\/capability authority/);
});

test('a foreign signer cannot acknowledge possession for the named successor', () => {
  const packet = rotation();
  const ack = signedAcknowledgement(stranger, packet, { successorKeyId: stranger.keyId });
  const result = evaluateKeyRotationAcknowledgement(packet, ack, {
    nowMs: activeNow,
    expectedPredecessor: predecessor.keyId,
    domain
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACK_SUCCESSOR_MISMATCH');
});

test('an acknowledgement is bound to one exact signed rotation digest', () => {
  const first = rotation({ nonce: nonce('rotation-first') });
  const second = rotation({ nonce: nonce('rotation-second') });
  const ack = acknowledgement(first, { nonce: nonce('ack-first') });
  const result = evaluateKeyRotationAcknowledgement(second, ack, {
    nowMs: activeNow,
    expectedPredecessor: predecessor.keyId,
    domain
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACK_ROTATION_BINDING_MISMATCH');
});

test('an acknowledgement cannot substitute another predecessor context', () => {
  const packet = rotation();
  const ack = signedAcknowledgement(successor, packet, { predecessorKeyId: stranger.keyId });
  const result = evaluateKeyRotationAcknowledgement(packet, ack, {
    nowMs: activeNow,
    expectedPredecessor: predecessor.keyId,
    domain
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACK_PREDECESSOR_MISMATCH');
});

test('acknowledgement body successor must equal the actual signing issuer', () => {
  const packet = rotation();
  const ack = signedAcknowledgement(successor, packet, { successorKeyId: alternateSuccessor.keyId });
  const result = evaluateKeyRotationAcknowledgement(packet, ack, {
    nowMs: activeNow,
    expectedPredecessor: predecessor.keyId,
    domain
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACK_ISSUER_MISMATCH');
});

test('an acknowledgement cannot be replayed into another domain context', () => {
  const packet = rotation();
  const ack = signedAcknowledgement(successor, packet, { domain: 'axm:test:other-domain' });
  const result = evaluateKeyRotationAcknowledgement(packet, ack, {
    nowMs: activeNow,
    expectedPredecessor: predecessor.keyId,
    domain
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACK_DOMAIN_MISMATCH');
});

test('acknowledgement validity cannot outlive the predecessor rotation window', () => {
  const packet = rotation();
  const ack = acknowledgement(packet, {
    expiresAt: '2026-09-12T20:30:00.000Z',
    nonce: nonce('ack-window-escalation')
  });
  const result = evaluateKeyRotationAcknowledgement(packet, ack, {
    nowMs: activeNow,
    expectedPredecessor: predecessor.keyId,
    domain
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACK_WINDOW_ESCALATION');
});

test('expired successor acknowledgement is not live possession evidence', () => {
  const packet = rotation();
  const ack = acknowledgement(packet, {
    expiresAt: '2026-09-12T18:20:00.000Z',
    nonce: nonce('ack-expired')
  });
  const result = evaluateKeyRotationAcknowledgement(packet, ack, {
    nowMs: activeNow,
    expectedPredecessor: predecessor.keyId,
    domain
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACKNOWLEDGEMENT_EXPIRED');
});

test('successor possession proof does not resolve a competing predecessor-signed rotation fork', () => {
  const left = rotation({ nonce: nonce('rotation-fork-left') });
  const right = createKeyRotation(predecessor, {
    successorIdentity: alternateSuccessor,
    domain,
    effectiveAt,
    issuedAt: rotationIssuedAt,
    expiresAt: rotationExpiresAt,
    nonce: nonce('rotation-fork-right')
  });
  const ack = acknowledgement(left, { nonce: nonce('ack-fork-left') });
  const possession = evaluateKeyRotationAcknowledgement(left, ack, {
    nowMs: activeNow,
    expectedPredecessor: predecessor.keyId,
    domain
  });
  const conflict = compareKeyRotations(left, right, {
    nowMs: activeNow,
    expectedPredecessor: predecessor.keyId,
    domain
  });
  assert.equal(possession.ok, true);
  assert.equal(possession.code, 'SUCCESSOR_POSSESSION_CONFIRMED_FOR_ROTATION');
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, 'ROTATION_FORK_EVIDENCE');
  assert.equal(conflict.winner, undefined);
});

console.log(`\n${passed} key-rotation acknowledgement tests passed.`);
