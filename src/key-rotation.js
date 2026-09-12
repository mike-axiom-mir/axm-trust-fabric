'use strict';

const {
  TrustError,
  keyIdFromPublicKey,
  envelopeDigest,
  signEnvelope,
  verifyEnvelope
} = require('./trust-core');

const ROTATION_KIND = 'key-rotation';
const KEY_ID_RE = /^axm:key:ed25519:[a-f0-9]{64}$/;
const ISO_MS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function demand(condition, code, message) {
  if (!condition) throw new TrustError(code, message);
}

function exactKeys(object, keys, code) {
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  demand(
    actual.length === expected.length && actual.every((key, index) => key === expected[index]),
    code,
    'Object does not match the exact key-rotation v1 field set.'
  );
}

function parseTime(text, field) {
  demand(typeof text === 'string' && ISO_MS_RE.test(text), 'INVALID_ROTATION_TIME', `${field} must be canonical UTC ISO time with milliseconds.`);
  const ms = Date.parse(text);
  demand(Number.isFinite(ms) && new Date(ms).toISOString() === text, 'INVALID_ROTATION_TIME', `${field} is not canonical UTC time.`);
  return ms;
}

function validateRotationBody(rotation) {
  const body = rotation?.body;
  demand(body && typeof body === 'object' && !Array.isArray(body), 'INVALID_ROTATION', 'Rotation body must be an object.');
  exactKeys(
    body,
    ['kind', 'predecessorKeyId', 'successorKeyId', 'successorPublicKey', 'domain', 'effectiveAt'],
    'INVALID_ROTATION_SHAPE'
  );
  demand(body.kind === ROTATION_KIND, 'INVALID_ROTATION_KIND', 'Not a key-rotation packet.');
  demand(KEY_ID_RE.test(body.predecessorKeyId), 'INVALID_PREDECESSOR_KEY', 'Rotation predecessor must be an Ed25519 key id.');
  demand(KEY_ID_RE.test(body.successorKeyId), 'INVALID_SUCCESSOR_KEY', 'Rotation successor must be an Ed25519 key id.');
  demand(body.predecessorKeyId === rotation.issuer, 'ROTATION_ISSUER_MISMATCH', 'Rotation must be signed by the predecessor key itself.');
  demand(body.successorKeyId !== body.predecessorKeyId, 'ROTATION_SELF_SUCCESSION', 'Rotation successor must differ from predecessor.');
  demand(typeof body.successorPublicKey === 'string' && body.successorPublicKey.length > 0, 'INVALID_SUCCESSOR_PUBLIC_KEY', 'Rotation successor public key is required.');
  demand(keyIdFromPublicKey(body.successorPublicKey) === body.successorKeyId, 'SUCCESSOR_KEY_MISMATCH', 'Successor key id does not match successor public key.');
  demand(typeof body.domain === 'string' && body.domain.length > 0 && body.domain.length <= 256, 'INVALID_ROTATION_DOMAIN', 'Rotation domain must be bounded text.');

  const effectiveMs = parseTime(body.effectiveAt, 'effectiveAt');
  const issuedMs = parseTime(rotation.issuedAt, 'issuedAt');
  const expiresMs = parseTime(rotation.expiresAt, 'expiresAt');
  demand(effectiveMs >= issuedMs && effectiveMs < expiresMs, 'INVALID_ROTATION_WINDOW', 'effectiveAt must be within the signed envelope window.');
  return { effectiveMs, issuedMs, expiresMs };
}

function createKeyRotation(predecessorIdentity, { successorIdentity, domain, effectiveAt, issuedAt, expiresAt, nonce }) {
  demand(successorIdentity && successorIdentity.keyId && successorIdentity.publicKey, 'INVALID_SUCCESSOR_IDENTITY', 'Successor identity is incomplete.');
  const body = {
    kind: ROTATION_KIND,
    predecessorKeyId: predecessorIdentity.keyId,
    successorKeyId: successorIdentity.keyId,
    successorPublicKey: successorIdentity.publicKey,
    domain,
    effectiveAt
  };
  const rotation = signEnvelope({ identity: predecessorIdentity, body, issuedAt, expiresAt, nonce });
  validateRotationBody(rotation);
  return rotation;
}

function evaluateKeyRotation(rotation, { nowMs, expectedPredecessor, domain } = {}) {
  const verified = verifyEnvelope(rotation, { nowMs });
  if (!verified.ok) return { ok: false, code: verified.code, evidence: verified };

  let timing;
  try {
    timing = validateRotationBody(rotation);
  } catch (error) {
    if (error instanceof TrustError) return { ok: false, code: error.code, evidence: verified };
    throw error;
  }

  if (typeof expectedPredecessor !== 'string' || expectedPredecessor.length === 0) {
    return { ok: false, code: 'HOLD_EXPECTED_PREDECESSOR_REQUIRED', evidence: verified };
  }
  if (rotation.issuer !== expectedPredecessor) {
    return { ok: false, code: 'ROTATION_PREDECESSOR_MISMATCH', evidence: verified };
  }
  if (typeof domain !== 'string' || domain !== rotation.body.domain) {
    return { ok: false, code: 'ROTATION_DOMAIN_MISMATCH', evidence: verified };
  }

  if (verified.temporalStatus === 'CLOCK_UNKNOWN') {
    return { ok: false, code: 'HOLD_CLOCK_UNKNOWN', evidence: verified };
  }
  if (verified.temporalStatus === 'NOT_YET_VALID') {
    return { ok: false, code: 'NOT_YET_VALID', evidence: verified };
  }
  if (verified.temporalStatus === 'EXPIRED') {
    return { ok: false, code: 'ROTATION_ATTESTATION_EXPIRED', evidence: verified };
  }
  if (nowMs < timing.effectiveMs) {
    return { ok: false, code: 'ROTATION_NOT_YET_EFFECTIVE', evidence: verified };
  }

  return {
    ok: true,
    code: 'KEY_SUCCESSOR_ATTESTED_FOR_DOMAIN',
    rotationId: verified.envelopeId,
    predecessorKeyId: rotation.body.predecessorKeyId,
    successorKeyId: rotation.body.successorKeyId,
    successorPublicKey: rotation.body.successorPublicKey,
    domain: rotation.body.domain,
    effectiveAt: rotation.body.effectiveAt,
    validUntil: rotation.expiresAt,
    truthBoundary: 'The predecessor key signed this bounded successor statement for this exact domain and window. This does not prove same-person/device identity, rewrite old signatures, or transfer capability/root authority automatically.'
  };
}

function compareKeyRotations(left, right, options = {}) {
  const leftResult = evaluateKeyRotation(left, options);
  if (!leftResult.ok) return { ok: false, code: `HOLD_INVALID_ROTATION_EVIDENCE:${leftResult.code}`, side: 'left' };
  const rightResult = evaluateKeyRotation(right, options);
  if (!rightResult.ok) return { ok: false, code: `HOLD_INVALID_ROTATION_EVIDENCE:${rightResult.code}`, side: 'right' };

  const leftId = envelopeDigest(left);
  const rightId = envelopeDigest(right);
  if (leftId === rightId) {
    return {
      ok: true,
      code: 'ROTATIONS_IDENTICAL',
      rotationId: leftId,
      truthBoundary: 'The two supplied rotation packets are the exact same signed evidence.'
    };
  }

  return {
    ok: false,
    code: 'ROTATION_FORK_EVIDENCE',
    predecessorKeyId: leftResult.predecessorKeyId,
    domain: leftResult.domain,
    left: { rotationId: leftId, successorKeyId: leftResult.successorKeyId, effectiveAt: leftResult.effectiveAt },
    right: { rotationId: rightId, successorKeyId: rightResult.successorKeyId, effectiveAt: rightResult.effectiveAt },
    truthBoundary: 'Two distinct simultaneously usable predecessor-signed successor statements exist for the same predecessor and domain. This is conflict evidence only; no winner is selected.'
  };
}

module.exports = {
  ROTATION_KIND,
  createKeyRotation,
  evaluateKeyRotation,
  compareKeyRotations
};
