'use strict';

const {
  TrustError,
  envelopeDigest,
  signEnvelope,
  verifyEnvelope
} = require('./trust-core');
const { evaluateKeyRotation } = require('./key-rotation');

const ACK_KIND = 'key-rotation-ack';
const KEY_ID_RE = /^axm:key:ed25519:[a-f0-9]{64}$/;
const HEX_256_RE = /^[a-f0-9]{64}$/;

function demand(condition, code, message) {
  if (!condition) throw new TrustError(code, message);
}

function exactKeys(object, keys, code) {
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  demand(
    actual.length === expected.length && actual.every((key, index) => key === expected[index]),
    code,
    'Object does not match the exact key-rotation acknowledgement v1 field set.'
  );
}

function validateAcknowledgementBody(acknowledgement) {
  const body = acknowledgement?.body;
  demand(body && typeof body === 'object' && !Array.isArray(body), 'INVALID_ACKNOWLEDGEMENT', 'Acknowledgement body must be an object.');
  exactKeys(
    body,
    ['kind', 'rotationId', 'predecessorKeyId', 'successorKeyId', 'domain'],
    'INVALID_ACKNOWLEDGEMENT_SHAPE'
  );
  demand(body.kind === ACK_KIND, 'INVALID_ACKNOWLEDGEMENT_KIND', 'Not a key-rotation acknowledgement packet.');
  demand(HEX_256_RE.test(body.rotationId), 'INVALID_ROTATION_ID', 'Acknowledgement rotationId must be a sha256 hex digest.');
  demand(KEY_ID_RE.test(body.predecessorKeyId), 'INVALID_PREDECESSOR_KEY', 'Acknowledgement predecessor must be an Ed25519 key id.');
  demand(KEY_ID_RE.test(body.successorKeyId), 'INVALID_SUCCESSOR_KEY', 'Acknowledgement successor must be an Ed25519 key id.');
  demand(acknowledgement.issuer === body.successorKeyId, 'ACK_ISSUER_MISMATCH', 'Acknowledgement must be signed by the named successor key itself.');
  demand(typeof body.domain === 'string' && body.domain.length > 0 && body.domain.length <= 256, 'INVALID_ACKNOWLEDGEMENT_DOMAIN', 'Acknowledgement domain must be bounded text.');
}

function createKeyRotationAcknowledgement(successorIdentity, { rotation, issuedAt, expiresAt, nonce }) {
  demand(rotation?.body?.kind === 'key-rotation', 'INVALID_ROTATION_REFERENCE', 'Acknowledgement requires a key-rotation packet.');
  demand(successorIdentity && successorIdentity.keyId && successorIdentity.publicKey && successorIdentity.privateKey, 'INVALID_SUCCESSOR_IDENTITY', 'Successor identity is incomplete.');
  demand(successorIdentity.keyId === rotation.body.successorKeyId, 'ACK_SUCCESSOR_MISMATCH', 'Acknowledgement signer must be the successor named by the rotation.');

  const body = {
    kind: ACK_KIND,
    rotationId: envelopeDigest(rotation),
    predecessorKeyId: rotation.body.predecessorKeyId,
    successorKeyId: rotation.body.successorKeyId,
    domain: rotation.body.domain
  };
  const acknowledgement = signEnvelope({ identity: successorIdentity, body, issuedAt, expiresAt, nonce });
  validateAcknowledgementBody(acknowledgement);
  return acknowledgement;
}

function evaluateKeyRotationAcknowledgement(rotation, acknowledgement, options = {}) {
  const rotationResult = evaluateKeyRotation(rotation, options);
  if (!rotationResult.ok) {
    return { ok: false, code: rotationResult.code, rotationEvidence: rotationResult };
  }

  const verified = verifyEnvelope(acknowledgement, { nowMs: options.nowMs });
  if (!verified.ok) {
    return { ok: false, code: verified.code, rotationEvidence: rotationResult, acknowledgementEvidence: verified };
  }

  try {
    validateAcknowledgementBody(acknowledgement);
  } catch (error) {
    if (error instanceof TrustError) {
      return { ok: false, code: error.code, rotationEvidence: rotationResult, acknowledgementEvidence: verified };
    }
    throw error;
  }

  if (acknowledgement.body.rotationId !== rotationResult.rotationId) {
    return { ok: false, code: 'ACK_ROTATION_BINDING_MISMATCH', rotationEvidence: rotationResult, acknowledgementEvidence: verified };
  }
  if (acknowledgement.body.predecessorKeyId !== rotationResult.predecessorKeyId) {
    return { ok: false, code: 'ACK_PREDECESSOR_MISMATCH', rotationEvidence: rotationResult, acknowledgementEvidence: verified };
  }
  if (acknowledgement.body.successorKeyId !== rotationResult.successorKeyId) {
    return { ok: false, code: 'ACK_SUCCESSOR_MISMATCH', rotationEvidence: rotationResult, acknowledgementEvidence: verified };
  }
  if (acknowledgement.body.domain !== rotationResult.domain) {
    return { ok: false, code: 'ACK_DOMAIN_MISMATCH', rotationEvidence: rotationResult, acknowledgementEvidence: verified };
  }

  const acknowledgementIssuedMs = Date.parse(acknowledgement.issuedAt);
  const acknowledgementExpiresMs = Date.parse(acknowledgement.expiresAt);
  const rotationIssuedMs = Date.parse(rotation.issuedAt);
  const rotationExpiresMs = Date.parse(rotation.expiresAt);
  if (acknowledgementIssuedMs < rotationIssuedMs || acknowledgementExpiresMs > rotationExpiresMs) {
    return { ok: false, code: 'ACK_WINDOW_ESCALATION', rotationEvidence: rotationResult, acknowledgementEvidence: verified };
  }

  if (verified.temporalStatus === 'CLOCK_UNKNOWN') {
    return { ok: false, code: 'HOLD_CLOCK_UNKNOWN', rotationEvidence: rotationResult, acknowledgementEvidence: verified };
  }
  if (verified.temporalStatus === 'NOT_YET_VALID') {
    return { ok: false, code: 'ACKNOWLEDGEMENT_NOT_YET_VALID', rotationEvidence: rotationResult, acknowledgementEvidence: verified };
  }
  if (verified.temporalStatus === 'EXPIRED') {
    return { ok: false, code: 'ACKNOWLEDGEMENT_EXPIRED', rotationEvidence: rotationResult, acknowledgementEvidence: verified };
  }

  return {
    ok: true,
    code: 'SUCCESSOR_POSSESSION_CONFIRMED_FOR_ROTATION',
    rotationId: rotationResult.rotationId,
    acknowledgementId: verified.envelopeId,
    predecessorKeyId: rotationResult.predecessorKeyId,
    successorKeyId: rotationResult.successorKeyId,
    domain: rotationResult.domain,
    validUntil: acknowledgement.expiresAt,
    truthBoundary: 'The successor key signed an acknowledgement bound to this exact predecessor-signed rotation. This proves control of the successor private key for this bounded evidence only; it does not prove human/device identity continuity, make this rotation win a fork, or transfer root/capability authority.'
  };
}

module.exports = {
  ACK_KIND,
  createKeyRotationAcknowledgement,
  evaluateKeyRotationAcknowledgement
};
