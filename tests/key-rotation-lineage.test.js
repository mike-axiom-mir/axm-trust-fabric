'use strict';

const assert = require('node:assert/strict');
const {
  generateIdentity,
  envelopeDigest
} = require('../src/trust-core');
const {
  createKeyRotation,
  compareKeyRotations
} = require('../src/key-rotation');
const {
  createKeyRotationAcknowledgement
} = require('../src/key-rotation-ack');
const {
  evaluateTwoHopKeyRotationLineage
} = require('../src/key-rotation-lineage');

const origin = generateIdentity();
const intermediate = generateIdentity();
const terminal = generateIdentity();
const alternateTerminal = generateIdentity();
const stranger = generateIdentity();
const domain = 'axm:test:two-hop-rotation-lineage';
const nonce = (seed) => Buffer.from(`axm-two-hop-rotation-${seed}-nonce-material`).toString('base64url');

const firstIssuedAt = '2026-09-12T18:00:00.000Z';
const firstEffectiveAt = '2026-09-12T18:10:00.000Z';
const firstExpiresAt = '2026-09-12T21:00:00.000Z';
const firstAckIssuedAt = '2026-09-12T18:15:00.000Z';
const firstAckExpiresAt = '2026-09-12T20:45:00.000Z';

const secondIssuedAt = '2026-09-12T18:20:00.000Z';
const secondEffectiveAt = '2026-09-12T18:30:00.000Z';
const secondExpiresAt = '2026-09-12T20:30:00.000Z';
const secondAckIssuedAt = '2026-09-12T18:35:00.000Z';
const secondAckExpiresAt = '2026-09-12T20:15:00.000Z';
const activeNow = Date.parse('2026-09-12T19:00:00.000Z');

function firstRotation(overrides = {}) {
  return createKeyRotation(origin, {
    successorIdentity: intermediate,
    domain,
    effectiveAt: firstEffectiveAt,
    issuedAt: firstIssuedAt,
    expiresAt: firstExpiresAt,
    nonce: nonce('first-rotation'),
    ...overrides
  });
}

function secondRotation(overrides = {}) {
  const predecessorIdentity = overrides.predecessorIdentity || intermediate;
  const successorIdentity = overrides.successorIdentity || terminal;
  const options = {
    successorIdentity,
    domain,
    effectiveAt: secondEffectiveAt,
    issuedAt: secondIssuedAt,
    expiresAt: secondExpiresAt,
    nonce: nonce('second-rotation'),
    ...overrides
  };
  delete options.predecessorIdentity;
  return createKeyRotation(predecessorIdentity, options);
}

function acknowledgement(identity, rotation, { issuedAt, expiresAt, seed }) {
  return createKeyRotationAcknowledgement(identity, {
    rotation,
    issuedAt,
    expiresAt,
    nonce: nonce(seed)
  });
}

function validEvidence() {
  const ab = firstRotation();
  const abAck = acknowledgement(intermediate, ab, {
    issuedAt: firstAckIssuedAt,
    expiresAt: firstAckExpiresAt,
    seed: 'first-ack'
  });
  const bc = secondRotation();
  const bcAck = acknowledgement(terminal, bc, {
    issuedAt: secondAckIssuedAt,
    expiresAt: secondAckExpiresAt,
    seed: 'second-ack'
  });
  return { ab, abAck, bc, bcAck };
}

function evaluate({ ab, abAck, bc, bcAck }, overrides = {}) {
  return evaluateTwoHopKeyRotationLineage(
    [ab, bc],
    [abAck, bcAck],
    { nowMs: activeNow, expectedOrigin: origin.keyId, domain, ...overrides }
  );
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

test('two-hop lineage requires usable A->B and B->C rotations plus successor possession at both hops', () => {
  const evidence = validEvidence();
  const result = evaluate(evidence);
  assert.equal(result.ok, true);
  assert.equal(result.code, 'TWO_HOP_ROTATION_LINEAGE_CONFIRMED');
  assert.equal(result.originKeyId, origin.keyId);
  assert.equal(result.intermediateKeyId, intermediate.keyId);
  assert.equal(result.terminalKeyId, terminal.keyId);
  assert.equal(result.domain, domain);
  assert.equal(result.authority, undefined);
  assert.equal(result.winner, undefined);
  assert.match(result.truthBoundary, /does not prove same-person\/device\/legal identity/);
  assert.match(result.truthBoundary, /does not.*transfer root\/capability\/revocation\/checkpoint authority/);
  assert.match(result.truthBoundary, /does not.*globally newest or unique/);
});

test('first-hop successor possession acknowledgement is mandatory', () => {
  const evidence = validEvidence();
  const result = evaluate({ ...evidence, abAck: null });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_ROTATION_LINEAGE_ACK_REQUIRED');
  assert.equal(result.hop, 0);
});

test('second-hop successor possession acknowledgement is mandatory', () => {
  const evidence = validEvidence();
  const result = evaluate({ ...evidence, bcAck: null });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_ROTATION_LINEAGE_ACK_REQUIRED');
  assert.equal(result.hop, 1);
});

test('second rotation predecessor must be the exact successor named by the first rotation', () => {
  const evidence = validEvidence();
  const foreignSecond = secondRotation({ predecessorIdentity: stranger, nonce: nonce('foreign-second') });
  const foreignAck = acknowledgement(terminal, foreignSecond, {
    issuedAt: secondAckIssuedAt,
    expiresAt: secondAckExpiresAt,
    seed: 'foreign-second-ack'
  });
  const result = evaluate({ ...evidence, bc: foreignSecond, bcAck: foreignAck });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_INVALID_ROTATION_HOP:ROTATION_PREDECESSOR_MISMATCH');
  assert.equal(result.hop, 1);
});

test('second hop cannot change the exact rotation domain', () => {
  const evidence = validEvidence();
  const otherDomainSecond = secondRotation({ domain: 'axm:test:other-domain', nonce: nonce('other-domain') });
  const otherDomainAck = acknowledgement(terminal, otherDomainSecond, {
    issuedAt: secondAckIssuedAt,
    expiresAt: secondAckExpiresAt,
    seed: 'other-domain-ack'
  });
  const result = evaluate({ ...evidence, bc: otherDomainSecond, bcAck: otherDomainAck });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_INVALID_ROTATION_HOP:ROTATION_DOMAIN_MISMATCH');
  assert.equal(result.hop, 1);
});

test('second hop cannot be issued before the first rotation becomes effective', () => {
  const evidence = validEvidence();
  const earlySecond = secondRotation({
    issuedAt: '2026-09-12T18:05:00.000Z',
    effectiveAt: '2026-09-12T18:12:00.000Z',
    nonce: nonce('early-second')
  });
  const earlyAck = acknowledgement(terminal, earlySecond, {
    issuedAt: '2026-09-12T18:13:00.000Z',
    expiresAt: secondAckExpiresAt,
    seed: 'early-second-ack'
  });
  const result = evaluate({ ...evidence, bc: earlySecond, bcAck: earlyAck });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ROTATION_LINEAGE_WINDOW_ESCALATION');
  assert.equal(result.hop, 1);
});

test('second hop cannot outlive the first predecessor-signed rotation window', () => {
  const evidence = validEvidence();
  const longSecond = secondRotation({
    expiresAt: '2026-09-12T21:30:00.000Z',
    nonce: nonce('long-second')
  });
  const longAck = acknowledgement(terminal, longSecond, {
    issuedAt: secondAckIssuedAt,
    expiresAt: '2026-09-12T21:15:00.000Z',
    seed: 'long-second-ack'
  });
  const result = evaluate({ ...evidence, bc: longSecond, bcAck: longAck });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ROTATION_LINEAGE_WINDOW_ESCALATION');
  assert.equal(result.hop, 1);
});

test('second-hop acknowledgement must bind the exact supplied second rotation', () => {
  const evidence = validEvidence();
  const alternateSecond = secondRotation({ nonce: nonce('alternate-second') });
  const alternateAck = acknowledgement(terminal, alternateSecond, {
    issuedAt: secondAckIssuedAt,
    expiresAt: secondAckExpiresAt,
    seed: 'alternate-second-ack'
  });
  const result = evaluate({ ...evidence, bcAck: alternateAck });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_INVALID_ROTATION_ACK:ACK_ROTATION_BINDING_MISMATCH');
  assert.equal(result.hop, 1);
});

test('trusted time remains mandatory for live two-hop lineage evidence', () => {
  const evidence = validEvidence();
  const result = evaluate(evidence, { nowMs: undefined });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_INVALID_ROTATION_HOP:HOLD_CLOCK_UNKNOWN');
  assert.equal(result.hop, 0);
});

test('a confirmed supplied branch does not resolve a competing second-hop rotation fork or rewrite historical evidence', () => {
  const evidence = validEvidence();
  const before = [evidence.ab, evidence.abAck, evidence.bc, evidence.bcAck].map((packet) => ({
    bytes: JSON.stringify(packet),
    id: envelopeDigest(packet)
  }));

  const result = evaluate(evidence);
  assert.equal(result.ok, true);

  const competingSecond = secondRotation({
    successorIdentity: alternateTerminal,
    nonce: nonce('fork-second')
  });
  const conflict = compareKeyRotations(evidence.bc, competingSecond, {
    nowMs: activeNow,
    expectedPredecessor: intermediate.keyId,
    domain
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, 'ROTATION_FORK_EVIDENCE');
  assert.equal(conflict.winner, undefined);

  const after = [evidence.ab, evidence.abAck, evidence.bc, evidence.bcAck].map((packet) => ({
    bytes: JSON.stringify(packet),
    id: envelopeDigest(packet)
  }));
  assert.deepEqual(after, before);
});

console.log(`\n${passed} key-rotation lineage tests passed.`);
