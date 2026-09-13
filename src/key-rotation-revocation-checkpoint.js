'use strict';

const crypto = require('node:crypto');
const {
  TrustError,
  canonicalize,
  envelopeDigest,
  signEnvelope,
  verifyEnvelope
} = require('./trust-core');

const ROTATION_REVOCATION_CHECKPOINT_KIND = 'key-rotation-revocation-checkpoint';
const ROTATION_REVOCATION_KIND = 'key-rotation-revocation';
const KEY_ID_RE = /^axm:key:ed25519:[a-f0-9]{64}$/;
const HEX_256_RE = /^[a-f0-9]{64}$/;
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
    'Object does not match the exact key-rotation revocation checkpoint v1 field set.'
  );
}

function parseCanonicalTime(text, field) {
  demand(
    typeof text === 'string' && ISO_MS_RE.test(text),
    'INVALID_ROTATION_REVOCATION_CHECKPOINT_TIME',
    `${field} must be canonical UTC ISO time with milliseconds.`
  );
  const ms = Date.parse(text);
  demand(
    Number.isFinite(ms) && new Date(ms).toISOString() === text,
    'INVALID_ROTATION_REVOCATION_CHECKPOINT_TIME',
    `${field} is not canonical UTC time.`
  );
  return ms;
}

function validateCheckpointBody(body) {
  demand(body && typeof body === 'object' && !Array.isArray(body), 'INVALID_ROTATION_REVOCATION_CHECKPOINT', 'Checkpoint body must be an object.');
  exactKeys(
    body,
    ['kind', 'completeThrough', 'revocationCount', 'revocationIdsDigest'],
    'INVALID_ROTATION_REVOCATION_CHECKPOINT_SHAPE'
  );
  demand(
    body.kind === ROTATION_REVOCATION_CHECKPOINT_KIND,
    'INVALID_ROTATION_REVOCATION_CHECKPOINT_KIND',
    'Not a key-rotation revocation checkpoint.'
  );
  parseCanonicalTime(body.completeThrough, 'completeThrough');
  demand(
    Number.isSafeInteger(body.revocationCount) && body.revocationCount >= 0 && body.revocationCount <= 10000,
    'INVALID_ROTATION_REVOCATION_CHECKPOINT_COUNT',
    'revocationCount must be an integer from 0 to 10000.'
  );
  demand(
    typeof body.revocationIdsDigest === 'string' && HEX_256_RE.test(body.revocationIdsDigest),
    'INVALID_ROTATION_REVOCATION_CHECKPOINT_DIGEST',
    'revocationIdsDigest must be sha256 hex.'
  );
}

function validateRotationRevocationPacket(packet) {
  const body = packet?.body;
  demand(
    body && typeof body === 'object' && !Array.isArray(body),
    'CHECKPOINT_PACKET_NOT_ROTATION_REVOCATION',
    'Manifest packet body must be an object.'
  );
  exactKeys(
    body,
    ['kind', 'rotationId', 'predecessorKeyId', 'successorKeyId', 'domain', 'reasonCode'],
    'CHECKPOINT_PACKET_NOT_ROTATION_REVOCATION'
  );
  demand(
    body.kind === ROTATION_REVOCATION_KIND,
    'CHECKPOINT_PACKET_NOT_ROTATION_REVOCATION',
    'Manifest packet is not a key-rotation revocation.'
  );
  demand(HEX_256_RE.test(body.rotationId), 'CHECKPOINT_PACKET_NOT_ROTATION_REVOCATION', 'Manifest packet has an invalid rotation id.');
  demand(KEY_ID_RE.test(body.predecessorKeyId), 'CHECKPOINT_PACKET_NOT_ROTATION_REVOCATION', 'Manifest packet has an invalid predecessor key id.');
  demand(KEY_ID_RE.test(body.successorKeyId), 'CHECKPOINT_PACKET_NOT_ROTATION_REVOCATION', 'Manifest packet has an invalid successor key id.');
  demand(packet.issuer === body.predecessorKeyId, 'CHECKPOINT_PACKET_PREDECESSOR_MISMATCH', 'Rotation revocation must be signed by its named predecessor.');
  demand(
    typeof body.domain === 'string' && body.domain.length > 0 && body.domain.length <= 256,
    'CHECKPOINT_PACKET_NOT_ROTATION_REVOCATION',
    'Manifest packet has an invalid domain.'
  );
  demand(
    typeof body.reasonCode === 'string' && /^[A-Z0-9_]{2,64}$/.test(body.reasonCode),
    'CHECKPOINT_PACKET_NOT_ROTATION_REVOCATION',
    'Manifest packet has an invalid reason code.'
  );
}

function digestRotationRevocationIds(ids) {
  return crypto.createHash('sha256').update(canonicalize(ids)).digest('hex');
}

function collectRotationRevocationIds(revocations, predecessorKeyId, completeThroughMs) {
  demand(Array.isArray(revocations), 'INVALID_ROTATION_REVOCATION_CHECKPOINT_MANIFEST', 'revocations must be an array.');
  demand(revocations.length <= 10000, 'INVALID_ROTATION_REVOCATION_CHECKPOINT_MANIFEST', 'rotation revocation manifest exceeds the v0.1 bound.');

  const ids = [];
  for (const packet of revocations) {
    const verified = verifyEnvelope(packet);
    demand(
      verified.ok,
      'ROTATION_REVOCATION_CHECKPOINT_PACKET_INVALID',
      `Rotation revocation packet failed envelope verification: ${verified.code}.`
    );
    validateRotationRevocationPacket(packet);
    demand(
      packet.issuer === predecessorKeyId,
      'ROTATION_REVOCATION_CHECKPOINT_PACKET_ISSUER_MISMATCH',
      'Checkpoint may attest only rotation revocations signed by its own predecessor issuer.'
    );
    demand(
      parseCanonicalTime(packet.issuedAt, 'rotation revocation issuedAt') <= completeThroughMs,
      'ROTATION_REVOCATION_CHECKPOINT_PACKET_AFTER_COMPLETE_THROUGH',
      'Manifest contains a rotation revocation issued after completeThrough.'
    );
    ids.push(envelopeDigest(packet));
  }

  demand(
    new Set(ids).size === ids.length,
    'DUPLICATE_ROTATION_REVOCATION_PACKET',
    'Checkpoint manifest contains a duplicate rotation revocation packet.'
  );
  return ids.sort();
}

function createKeyRotationRevocationCheckpoint(predecessorIdentity, {
  revocations = [],
  completeThrough,
  issuedAt,
  expiresAt,
  nonce
}) {
  demand(
    predecessorIdentity && typeof predecessorIdentity.keyId === 'string',
    'INVALID_ROTATION_REVOCATION_CHECKPOINT_IDENTITY',
    'Checkpoint signing identity is incomplete.'
  );
  const issuedMs = parseCanonicalTime(issuedAt, 'issuedAt');
  const completeThroughMs = parseCanonicalTime(completeThrough, 'completeThrough');
  demand(
    completeThroughMs <= issuedMs,
    'INVALID_ROTATION_REVOCATION_CHECKPOINT_WINDOW',
    'completeThrough cannot be later than checkpoint issuedAt.'
  );

  const ids = collectRotationRevocationIds(revocations, predecessorIdentity.keyId, completeThroughMs);
  const body = {
    kind: ROTATION_REVOCATION_CHECKPOINT_KIND,
    completeThrough,
    revocationCount: ids.length,
    revocationIdsDigest: digestRotationRevocationIds(ids)
  };
  validateCheckpointBody(body);
  return signEnvelope({ identity: predecessorIdentity, body, issuedAt, expiresAt, nonce });
}

function evaluateKeyRotationRevocationCheckpoint(checkpoint, {
  nowMs,
  revocations = [],
  expectedPredecessor
} = {}) {
  const verified = verifyEnvelope(checkpoint, { nowMs });
  if (!verified.ok) return { ok: false, code: verified.code, evidence: verified };

  try {
    validateCheckpointBody(checkpoint.body);
    demand(
      typeof expectedPredecessor === 'string' && expectedPredecessor.length > 0,
      'HOLD_EXPECTED_PREDECESSOR_REQUIRED',
      'An explicit expected predecessor is required.'
    );
    demand(
      checkpoint.issuer === expectedPredecessor,
      'ROTATION_REVOCATION_CHECKPOINT_ISSUER_MISMATCH',
      'Checkpoint issuer does not match the expected predecessor.'
    );

    const issuedMs = parseCanonicalTime(checkpoint.issuedAt, 'issuedAt');
    const completeThroughMs = parseCanonicalTime(checkpoint.body.completeThrough, 'completeThrough');
    demand(
      completeThroughMs <= issuedMs,
      'INVALID_ROTATION_REVOCATION_CHECKPOINT_WINDOW',
      'completeThrough cannot be later than checkpoint issuedAt.'
    );

    if (verified.temporalStatus === 'CLOCK_UNKNOWN') {
      return { ok: false, code: 'HOLD_CLOCK_UNKNOWN', evidence: verified };
    }
    if (verified.temporalStatus === 'NOT_YET_VALID') {
      return { ok: false, code: 'NOT_YET_VALID', evidence: verified };
    }
    if (verified.temporalStatus === 'EXPIRED') {
      return { ok: false, code: 'STALE_ROTATION_REVOCATION_CHECKPOINT', evidence: verified };
    }

    const ids = collectRotationRevocationIds(revocations, checkpoint.issuer, completeThroughMs);
    if (
      ids.length !== checkpoint.body.revocationCount ||
      digestRotationRevocationIds(ids) !== checkpoint.body.revocationIdsDigest
    ) {
      return { ok: false, code: 'ROTATION_REVOCATION_SET_DIGEST_MISMATCH', evidence: verified };
    }

    return {
      ok: true,
      code: 'ROTATION_REVOCATION_SET_ATTESTED_THROUGH',
      checkpointId: verified.envelopeId,
      predecessorKeyId: checkpoint.issuer,
      completeThrough: checkpoint.body.completeThrough,
      revocationCount: ids.length,
      truthBoundary: 'Attests only the exact supplied same-predecessor key-rotation-revocation packet-id manifest through completeThrough. It does not prove that referenced rotations were separately valid, that no newer or unseen revocation exists, that a peer is synchronized, that a branch is globally newest or unique, or that identity or authority transferred.'
    };
  } catch (error) {
    if (error instanceof TrustError) {
      return { ok: false, code: error.code, message: error.message, evidence: verified };
    }
    throw error;
  }
}

module.exports = {
  ROTATION_REVOCATION_CHECKPOINT_KIND,
  createKeyRotationRevocationCheckpoint,
  evaluateKeyRotationRevocationCheckpoint
};
