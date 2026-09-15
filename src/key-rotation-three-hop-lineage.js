'use strict';

const { envelopeDigest } = require('./trust-core');
const { evaluateKeyRotation } = require('./key-rotation');
const { evaluateKeyRotationAcknowledgement } = require('./key-rotation-ack');

function fail(code, details = {}) {
  return { ok: false, code, ...details };
}

function evaluateThreeHopKeyRotationLineage(rotations, acknowledgements, options = {}) {
  if (!Array.isArray(rotations) || rotations.length !== 3) {
    return fail('HOLD_EXACT_THREE_ROTATION_HOPS_REQUIRED');
  }
  if (!Array.isArray(acknowledgements) || acknowledgements.length !== 3) {
    return fail('HOLD_EXACT_THREE_ACKNOWLEDGEMENTS_REQUIRED');
  }
  if (typeof options.expectedOrigin !== 'string' || options.expectedOrigin.length === 0) {
    return fail('HOLD_EXPECTED_ORIGIN_REQUIRED');
  }
  if (typeof options.domain !== 'string' || options.domain.length === 0) {
    return fail('HOLD_ROTATION_DOMAIN_REQUIRED');
  }

  const rotationEvidence = [];
  const acknowledgementEvidence = [];
  const intermediateKeyIds = [];
  let expectedPredecessor = options.expectedOrigin;
  let previousEffectiveMs = null;
  let previousExpiresMs = null;

  for (let hop = 0; hop < 3; hop += 1) {
    const rotation = evaluateKeyRotation(rotations[hop], {
      nowMs: options.nowMs,
      expectedPredecessor,
      domain: options.domain
    });
    if (!rotation.ok) {
      return fail(`HOLD_INVALID_ROTATION_HOP:${rotation.code}`, { hop, evidence: rotation });
    }

    if (hop > 0) {
      const currentIssuedMs = Date.parse(rotations[hop].issuedAt);
      const currentExpiresMs = Date.parse(rotations[hop].expiresAt);
      if (currentIssuedMs < previousEffectiveMs || currentExpiresMs > previousExpiresMs) {
        return fail('ROTATION_LINEAGE_WINDOW_ESCALATION', {
          hop,
          previousEffectiveAt: rotations[hop - 1].body.effectiveAt,
          previousExpiresAt: rotations[hop - 1].expiresAt,
          currentIssuedAt: rotations[hop].issuedAt,
          currentExpiresAt: rotations[hop].expiresAt
        });
      }
    }

    if (!acknowledgements[hop]) {
      return fail('HOLD_ROTATION_LINEAGE_ACK_REQUIRED', { hop });
    }
    const acknowledgement = evaluateKeyRotationAcknowledgement(rotations[hop], acknowledgements[hop], {
      nowMs: options.nowMs,
      expectedPredecessor,
      domain: options.domain
    });
    if (!acknowledgement.ok) {
      return fail(`HOLD_INVALID_ROTATION_ACK:${acknowledgement.code}`, { hop, evidence: acknowledgement });
    }

    rotationEvidence.push(rotation);
    acknowledgementEvidence.push(acknowledgement);
    if (hop < 2) intermediateKeyIds.push(rotation.successorKeyId);
    expectedPredecessor = rotation.successorKeyId;
    previousEffectiveMs = Date.parse(rotations[hop].body.effectiveAt);
    previousExpiresMs = Date.parse(rotations[hop].expiresAt);
  }

  const validUntilMs = Math.min(
    ...rotations.map((rotation) => Date.parse(rotation.expiresAt)),
    ...acknowledgementEvidence.map((acknowledgement) => Date.parse(acknowledgement.validUntil))
  );

  const packetIds = [];
  for (let hop = 0; hop < 3; hop += 1) {
    packetIds.push(envelopeDigest(rotations[hop]), envelopeDigest(acknowledgements[hop]));
  }

  return {
    ok: true,
    code: 'THREE_HOP_ROTATION_LINEAGE_CONFIRMED',
    originKeyId: rotationEvidence[0].predecessorKeyId,
    intermediateKeyIds,
    terminalKeyId: rotationEvidence[2].successorKeyId,
    domain: options.domain,
    rotations: rotationEvidence.map((rotation, hop) => ({
      rotationId: rotation.rotationId,
      acknowledgementId: acknowledgementEvidence[hop].acknowledgementId
    })),
    validUntil: new Date(validUntilMs).toISOString(),
    lineageEvidenceId: packetIds.join(':'),
    truthBoundary: 'The supplied A->B->C->D branch contains exactly three usable predecessor-signed rotations with successor possession confirmed at every hop, one exact domain, and no hop-to-hop validity-window widening. This does not prove same-person/device/legal identity, transfer root/capability/revocation/checkpoint authority, prove the branch is globally newest or unique, discover unseen rotations, generalize to arbitrary-length lineage, recover a lost key, or resolve a competing fork.'
  };
}

module.exports = {
  evaluateThreeHopKeyRotationLineage
};
