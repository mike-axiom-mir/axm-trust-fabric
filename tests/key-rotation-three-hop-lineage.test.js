'use strict';

const assert = require('node:assert/strict');
const { generateIdentity, envelopeDigest } = require('../src/trust-core');
const { createKeyRotation, compareKeyRotations } = require('../src/key-rotation');
const { createKeyRotationAcknowledgement } = require('../src/key-rotation-ack');
const { evaluateThreeHopKeyRotationLineage } = require('../src/key-rotation-three-hop-lineage');

const origin = generateIdentity();
const b = generateIdentity();
const c = generateIdentity();
const d = generateIdentity();
const alternateTerminal = generateIdentity();
const stranger = generateIdentity();
const domain = 'axm:test:three-hop-rotation-lineage';
const nonce = (seed) => Buffer.from(`axm-three-hop-${seed}-nonce-material`).toString('base64url');

const activeNow = Date.parse('2026-09-12T19:00:00.000Z');

function rotation(predecessorIdentity, successorIdentity, { issuedAt, effectiveAt, expiresAt, seed, rotationDomain = domain }) {
  return createKeyRotation(predecessorIdentity, {
    successorIdentity,
    domain: rotationDomain,
    effectiveAt,
    issuedAt,
    expiresAt,
    nonce: nonce(seed)
  });
}

function acknowledgement(identity, rotationPacket, { issuedAt, expiresAt, seed }) {
  return createKeyRotationAcknowledgement(identity, {
    rotation: rotationPacket,
    issuedAt,
    expiresAt,
    nonce: nonce(seed)
  });
}

function validEvidence() {
  const ab = rotation(origin, b, {
    issuedAt: '2026-09-12T18:00:00.000Z',
    effectiveAt: '2026-09-12T18:10:00.000Z',
    expiresAt: '2026-09-12T22:00:00.000Z',
    seed: 'ab'
  });
  const abAck = acknowledgement(b, ab, {
    issuedAt: '2026-09-12T18:15:00.000Z',
    expiresAt: '2026-09-12T21:45:00.000Z',
    seed: 'ab-ack'
  });

  const bc = rotation(b, c, {
    issuedAt: '2026-09-12T18:20:00.000Z',
    effectiveAt: '2026-09-12T18:30:00.000Z',
    expiresAt: '2026-09-12T21:00:00.000Z',
    seed: 'bc'
  });
  const bcAck = acknowledgement(c, bc, {
    issuedAt: '2026-09-12T18:35:00.000Z',
    expiresAt: '2026-09-12T20:45:00.000Z',
    seed: 'bc-ack'
  });

  const cd = rotation(c, d, {
    issuedAt: '2026-09-12T18:40:00.000Z',
    effectiveAt: '2026-09-12T18:50:00.000Z',
    expiresAt: '2026-09-12T20:30:00.000Z',
    seed: 'cd'
  });
  const cdAck = acknowledgement(d, cd, {
    issuedAt: '2026-09-12T18:55:00.000Z',
    expiresAt: '2026-09-12T20:15:00.000Z',
    seed: 'cd-ack'
  });

  return { ab, abAck, bc, bcAck, cd, cdAck };
}

function evaluate(evidence, overrides = {}) {
  return evaluateThreeHopKeyRotationLineage(
    [evidence.ab, evidence.bc, evidence.cd],
    [evidence.abAck, evidence.bcAck, evidence.cdAck],
    { nowMs: activeNow, expectedOrigin: origin.keyId, domain, ...overrides }
  );
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

test('three-hop lineage requires exact A->B->C->D rotations plus successor possession at all three hops', () => {
  const result = evaluate(validEvidence());
  assert.equal(result.ok, true);
  assert.equal(result.code, 'THREE_HOP_ROTATION_LINEAGE_CONFIRMED');
  assert.equal(result.originKeyId, origin.keyId);
  assert.deepEqual(result.intermediateKeyIds, [b.keyId, c.keyId]);
  assert.equal(result.terminalKeyId, d.keyId);
  assert.equal(result.domain, domain);
  assert.equal(result.authority, undefined);
  assert.equal(result.winner, undefined);
  assert.match(result.truthBoundary, /does not prove same-person\/device\/legal identity/);
  assert.match(result.truthBoundary, /does not.*transfer root\/capability\/revocation\/checkpoint authority/);
  assert.match(result.truthBoundary, /does not.*globally newest or unique/);
  assert.match(result.truthBoundary, /does not.*arbitrary-length lineage/);
});

test('three-hop evaluator refuses any rotation count other than exactly three', () => {
  const evidence = validEvidence();
  const result = evaluateThreeHopKeyRotationLineage(
    [evidence.ab, evidence.bc],
    [evidence.abAck, evidence.bcAck, evidence.cdAck],
    { nowMs: activeNow, expectedOrigin: origin.keyId, domain }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_EXACT_THREE_ROTATION_HOPS_REQUIRED');
});

test('three-hop evaluator refuses any acknowledgement count other than exactly three', () => {
  const evidence = validEvidence();
  const result = evaluateThreeHopKeyRotationLineage(
    [evidence.ab, evidence.bc, evidence.cd],
    [evidence.abAck, evidence.bcAck],
    { nowMs: activeNow, expectedOrigin: origin.keyId, domain }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_EXACT_THREE_ACKNOWLEDGEMENTS_REQUIRED');
});

test('third rotation predecessor must be the exact successor named by the second rotation', () => {
  const evidence = validEvidence();
  const foreignCd = rotation(stranger, d, {
    issuedAt: '2026-09-12T18:40:00.000Z',
    effectiveAt: '2026-09-12T18:50:00.000Z',
    expiresAt: '2026-09-12T20:30:00.000Z',
    seed: 'foreign-cd'
  });
  const foreignAck = acknowledgement(d, foreignCd, {
    issuedAt: '2026-09-12T18:55:00.000Z',
    expiresAt: '2026-09-12T20:15:00.000Z',
    seed: 'foreign-cd-ack'
  });
  const result = evaluate({ ...evidence, cd: foreignCd, cdAck: foreignAck });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_INVALID_ROTATION_HOP:ROTATION_PREDECESSOR_MISMATCH');
  assert.equal(result.hop, 2);
});

test('third hop cannot change the exact rotation domain', () => {
  const evidence = validEvidence();
  const otherDomainCd = rotation(c, d, {
    issuedAt: '2026-09-12T18:40:00.000Z',
    effectiveAt: '2026-09-12T18:50:00.000Z',
    expiresAt: '2026-09-12T20:30:00.000Z',
    seed: 'other-domain-cd',
    rotationDomain: 'axm:test:other-domain'
  });
  const otherDomainAck = acknowledgement(d, otherDomainCd, {
    issuedAt: '2026-09-12T18:55:00.000Z',
    expiresAt: '2026-09-12T20:15:00.000Z',
    seed: 'other-domain-cd-ack'
  });
  const result = evaluate({ ...evidence, cd: otherDomainCd, cdAck: otherDomainAck });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_INVALID_ROTATION_HOP:ROTATION_DOMAIN_MISMATCH');
  assert.equal(result.hop, 2);
});

test('third hop cannot be issued before the second rotation becomes effective', () => {
  const evidence = validEvidence();
  const earlyCd = rotation(c, d, {
    issuedAt: '2026-09-12T18:25:00.000Z',
    effectiveAt: '2026-09-12T18:35:00.000Z',
    expiresAt: '2026-09-12T20:30:00.000Z',
    seed: 'early-cd'
  });
  const earlyAck = acknowledgement(d, earlyCd, {
    issuedAt: '2026-09-12T18:40:00.000Z',
    expiresAt: '2026-09-12T20:15:00.000Z',
    seed: 'early-cd-ack'
  });
  const result = evaluate({ ...evidence, cd: earlyCd, cdAck: earlyAck });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ROTATION_LINEAGE_WINDOW_ESCALATION');
  assert.equal(result.hop, 2);
});

test('third hop cannot outlive the second predecessor-signed rotation window', () => {
  const evidence = validEvidence();
  const longCd = rotation(c, d, {
    issuedAt: '2026-09-12T18:40:00.000Z',
    effectiveAt: '2026-09-12T18:50:00.000Z',
    expiresAt: '2026-09-12T21:15:00.000Z',
    seed: 'long-cd'
  });
  const longAck = acknowledgement(d, longCd, {
    issuedAt: '2026-09-12T18:55:00.000Z',
    expiresAt: '2026-09-12T21:00:00.000Z',
    seed: 'long-cd-ack'
  });
  const result = evaluate({ ...evidence, cd: longCd, cdAck: longAck });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ROTATION_LINEAGE_WINDOW_ESCALATION');
  assert.equal(result.hop, 2);
});

test('third-hop acknowledgement must bind the exact supplied third rotation', () => {
  const evidence = validEvidence();
  const alternateCd = rotation(c, d, {
    issuedAt: '2026-09-12T18:40:00.000Z',
    effectiveAt: '2026-09-12T18:50:00.000Z',
    expiresAt: '2026-09-12T20:30:00.000Z',
    seed: 'alternate-cd'
  });
  const alternateAck = acknowledgement(d, alternateCd, {
    issuedAt: '2026-09-12T18:55:00.000Z',
    expiresAt: '2026-09-12T20:15:00.000Z',
    seed: 'alternate-cd-ack'
  });
  const result = evaluate({ ...evidence, cdAck: alternateAck });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_INVALID_ROTATION_ACK:ACK_ROTATION_BINDING_MISMATCH');
  assert.equal(result.hop, 2);
});

test('confirmed three-hop branch keeps competing terminal fork unresolved and preserves historical packet bytes', () => {
  const evidence = validEvidence();
  const packets = [evidence.ab, evidence.abAck, evidence.bc, evidence.bcAck, evidence.cd, evidence.cdAck];
  const before = packets.map((packet) => ({ bytes: JSON.stringify(packet), id: envelopeDigest(packet) }));

  const result = evaluate(evidence);
  assert.equal(result.ok, true);

  const competingCd = rotation(c, alternateTerminal, {
    issuedAt: '2026-09-12T18:40:00.000Z',
    effectiveAt: '2026-09-12T18:50:00.000Z',
    expiresAt: '2026-09-12T20:30:00.000Z',
    seed: 'fork-cd'
  });
  const conflict = compareKeyRotations(evidence.cd, competingCd, {
    nowMs: activeNow,
    expectedPredecessor: c.keyId,
    domain
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, 'ROTATION_FORK_EVIDENCE');
  assert.equal(conflict.winner, undefined);

  const after = packets.map((packet) => ({ bytes: JSON.stringify(packet), id: envelopeDigest(packet) }));
  assert.deepEqual(after, before);
});

console.log(`\n${passed} three-hop key-rotation lineage tests passed.`);
