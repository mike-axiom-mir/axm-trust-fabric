'use strict';

const { envelopeDigest } = require('./trust-core');
const { evaluateKeyRotation } = require('./key-rotation');
const { evaluateKeyRotationAcknowledgement } = require('./key-rotation-ack');

function fail(code, details = {}) {
  return { ok: false, code, ...details };
}

function evaluateTwoHopKeyRotationLineage(rotations, acknowledgements, options = {}) {
  if (!Array.isArray(rotations) || rotations.length !== 2) {
    return fail('HOLD_EXACT_TWO_ROTATION_HOPS_REQUIRED');
  }
  if (!Array.isArray(acknowledgements) || acknowledgements.length !== 2) {
    return fail('HOLD_EXACT_TWO_ACKNOWLEDGEMENTS_REQUIRED');
  }
  if (typeof options.expectedOrigin !== 'string' || options.expectedOrigin.length === 0) {
    return fail('HOLD_EXPECTED_ORIGIN_REQUIRED');
  }
  if (typeof options.domain !== 'string' || options.domain.length === 0) {
    return fail('HOLD_ROTATION_DOMAIN_REQUIRED');
  }

  const firstRotation = evaluateKeyRotation(rotations[0], {
    nowMs: options.nowMs,
    expectedPredecessor: options.expectedOrigin,
    domain: options.domain
  });
  if (!firstRotation.ok) {
    return fail(`HOLD_INVALID_ROTATION_HOP:${firstRotation.code}`, { hop: 0, evidence: firstRotation });
  }

  if (!acknowledgements[0]) {
    return fail('HOLD_ROTATION_LINEAGE_ACK_REQUIRED', { hop: 0 });
  }
  const firstAcknowledgement = evaluateKeyRotationAcknowledgement(rotations[0], acknowledgements[0], {
    nowMs: options.nowMs,
    expectedPredecessor: options.expectedOrigin,
    domain: options.domain
  });
  if (!firstAcknowledgement.ok) {
    return fail(`HOLD_INVALID_ROTATION_ACK:${firstAcknowledgement.code}`, { hop: 0, evidence: firstAcknowledgement });
  }

  const secondRotation = evaluateKeyRotation(rotations[1], {
    nowMs: options.nowMs,
    expectedPredecessor: firstRotation.successorKeyId,
    domain: options.domain
  });
  if (!secondRotation.ok) {
    return fail(`HOLD_INVALID_ROTATION_HOP:${secondRotation.code}`, { hop: 1, evidence: secondRotation });
  }

  const firstEffectiveMs = Date.parse(rotations[0].body.effectiveAt);
  const firstExpiresMs = Date.parse(rotations[0].expiresAt);
  const secondIssuedMs = Date.parse(rotations[1].issuedAt);
  const secondExpiresMs = Date.parse(rotations[1].expiresAt);
  if (secondIssuedMs < firstEffectiveMs || secondExpiresMs > firstExpiresMs) {
    return fail('ROTATION_LINEAGE_WINDOW_ESCALATION', {
      hop: 1,
      firstEffectiveAt: rotations[0].body.effectiveAt,
      firstExpiresAt: rotations[0].expiresAt,
      secondIssuedAt: rotations[1].issuedAt,
      secondExpiresAt: rotations[1].expiresAt
    });
  }

  if (!acknowledgements[1]) {
    return fail('HOLD_ROTATION_LINEAGE_ACK_REQUIRED', { hop: 1 });
  }
  const secondAcknowledgement = evaluateKeyRotationAcknowledgement(rotations[1], acknowledgements[1], {
    nowMs: options.nowMs,
    expectedPredecessor: firstRotation.successorKeyId,
    domain: options.domain
  });
  if (!secondAcknowledgement.ok) {
    return fail(`HOLD_INVALID_ROTATION_ACK:${secondAcknowledgement.code}`, { hop: 1, evidence: secondAcknowledgement });
  }

  return {
    ok: true,
    code: 'TWO_HOP_ROTATION_LINEAGE_CONFIRMED',
    originKeyId: firstRotation.predecessorKeyId,
    intermediateKeyId: firstRotation.successorKeyId,
    terminalKeyId: secondRotation.successorKeyId,
    domain: options.domain,
    rotations: [
      { rotationId: firstRotation.rotationId, acknowledgementId: firstAcknowledgement.acknowledgementId },
      { rotationId: secondRotation.rotationId, acknowledgementId: secondAcknowledgement.acknowledgementId }
    ],
    validUntil: new Date(Math.min(
      Date.parse(firstAcknowledgement.validUntil),
      Date.parse(secondAcknowledgement.validUntil),
      firstExpiresMs,
      secondExpiresMs
    )).toISOString(),
    lineageEvidenceId: envelopeDigest(rotations[0]) + ':' + envelopeDigest(acknowledgements[0]) + ':' + envelopeDigest(rotations[1]) + ':' + envelopeDigest(acknowledgements[1]),
    truthBoundary: 'The supplied A->B->C branch contains two usable predecessor-signed rotations with successor possession confirmed at each hop, one exact domain, and no validity-window widening. This does not prove same-person/device/legal identity, transfer root/capability/revocation/checkpoint authority, prove the branch is globally newest or unique, discover unseen rotations, or resolve a competing fork.'
  };
}

module.exports = {
  evaluateTwoHopKeyRotationLineage
};
