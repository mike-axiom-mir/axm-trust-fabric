'use strict';

const crypto = require('node:crypto');
const {
  canonicalize,
  envelopeDigest,
  signEnvelope,
  verifyEnvelope
} = require('./trust-core');

const CHECKPOINT_KIND = 'revocation-checkpoint';
const REVOCATION_KIND = 'capability-revocation';
const HEX_256_RE = /^[a-f0-9]{64}$/;
const ISO_MS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

class CheckpointError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CheckpointError';
    this.code = code;
  }
}

function demand(condition, code, message) {
  if (!condition) throw new CheckpointError(code, message);
}

function exactKeys(object, keys, code) {
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  demand(actual.length === expected.length && actual.every((key, index) => key === expected[index]), code, 'Object does not match the exact checkpoint v1 field set.');
}

function parseCanonicalTime(text, field) {
  demand(typeof text === 'string' && ISO_MS_RE.test(text), 'INVALID_CHECKPOINT_TIME', `${field} must be canonical UTC ISO time with milliseconds.`);
  const ms = Date.parse(text);
  demand(Number.isFinite(ms) && new Date(ms).toISOString() === text, 'INVALID_CHECKPOINT_TIME', `${field} is not canonical UTC time.`);
  return ms;
}

function validateCheckpointBody(body) {
  demand(body && typeof body === 'object' && !Array.isArray(body), 'INVALID_CHECKPOINT', 'Checkpoint body must be an object.');
  exactKeys(body, ['kind', 'completeThrough', 'revocationCount', 'revocationIdsDigest'], 'INVALID_CHECKPOINT_SHAPE');
  demand(body.kind === CHECKPOINT_KIND, 'INVALID_CHECKPOINT_KIND', 'Not a revocation checkpoint.');
  parseCanonicalTime(body.completeThrough, 'completeThrough');
  demand(Number.isSafeInteger(body.revocationCount) && body.revocationCount >= 0 && body.revocationCount <= 10000, 'INVALID_REVOCATION_COUNT', 'revocationCount must be an integer from 0 to 10000.');
  demand(typeof body.revocationIdsDigest === 'string' && HEX_256_RE.test(body.revocationIdsDigest), 'INVALID_REVOCATION_SET_DIGEST', 'revocationIdsDigest must be sha256 hex.');
}

function validateRevocationPacketBody(body) {
  demand(body && typeof body === 'object' && !Array.isArray(body), 'CHECKPOINT_PACKET_NOT_REVOCATION', 'Manifest packet body must be an object.');
  exactKeys(body, ['kind', 'capabilityId', 'reasonCode'], 'CHECKPOINT_PACKET_NOT_REVOCATION');
  demand(body.kind === REVOCATION_KIND, 'CHECKPOINT_PACKET_NOT_REVOCATION', 'Manifest packet is not a capability revocation.');
  demand(typeof body.capabilityId === 'string' && HEX_256_RE.test(body.capabilityId), 'CHECKPOINT_PACKET_NOT_REVOCATION', 'Manifest packet has an invalid capability id.');
  demand(typeof body.reasonCode === 'string' && /^[A-Z0-9_]{2,64}$/.test(body.reasonCode), 'CHECKPOINT_PACKET_NOT_REVOCATION', 'Manifest packet has an invalid reason code.');
}

function digestRevocationIds(ids) {
  return crypto.createHash('sha256').update(canonicalize(ids)).digest('hex');
}

function collectRevocationIds(revocations, issuer, completeThroughMs) {
  demand(Array.isArray(revocations), 'INVALID_REVOCATION_MANIFEST', 'revocations must be an array.');
  demand(revocations.length <= 10000, 'INVALID_REVOCATION_MANIFEST', 'revocation manifest exceeds the v0.1 bound.');
  const ids = [];
  for (const packet of revocations) {
    const verified = verifyEnvelope(packet);
    demand(verified.ok, 'CHECKPOINT_PACKET_INVALID', `Revocation packet failed envelope verification: ${verified.code}.`);
    validateRevocationPacketBody(packet.body);
    demand(packet.issuer === issuer, 'CHECKPOINT_PACKET_ISSUER_MISMATCH', 'Checkpoint may attest only revocations signed by its issuer.');
    demand(parseCanonicalTime(packet.issuedAt, 'revocation issuedAt') <= completeThroughMs, 'CHECKPOINT_PACKET_AFTER_COMPLETE_THROUGH', 'Manifest contains a revocation issued after completeThrough.');
    ids.push(envelopeDigest(packet));
  }
  demand(new Set(ids).size === ids.length, 'DUPLICATE_REVOCATION_PACKET', 'Checkpoint manifest contains a duplicate revocation packet.');
  return ids.sort();
}

function createRevocationCheckpoint(identity, { revocations = [], completeThrough, issuedAt, expiresAt, nonce }) {
  demand(identity && typeof identity.keyId === 'string', 'INVALID_CHECKPOINT_IDENTITY', 'Checkpoint signing identity is incomplete.');
  const issuedMs = parseCanonicalTime(issuedAt, 'issuedAt');
  const completeThroughMs = parseCanonicalTime(completeThrough, 'completeThrough');
  demand(completeThroughMs <= issuedMs, 'INVALID_CHECKPOINT_WINDOW', 'completeThrough cannot be later than checkpoint issuedAt.');
  const ids = collectRevocationIds(revocations, identity.keyId, completeThroughMs);
  const body = {
    kind: CHECKPOINT_KIND,
    completeThrough,
    revocationCount: ids.length,
    revocationIdsDigest: digestRevocationIds(ids)
  };
  validateCheckpointBody(body);
  return signEnvelope({ identity, body, issuedAt, expiresAt, nonce });
}

function evaluateRevocationCheckpoint(checkpoint, { nowMs, revocations = [], expectedIssuer } = {}) {
  const verified = verifyEnvelope(checkpoint, { nowMs });
  if (!verified.ok) return { ok: false, code: verified.code, evidence: verified };

  try {
    validateCheckpointBody(checkpoint.body);
    demand(typeof expectedIssuer === 'string' && expectedIssuer.length > 0, 'HOLD_EXPECTED_ISSUER_REQUIRED', 'An explicit expected issuer is required.');
    demand(checkpoint.issuer === expectedIssuer, 'CHECKPOINT_ISSUER_MISMATCH', 'Checkpoint issuer does not match the expected issuer.');

    const issuedMs = parseCanonicalTime(checkpoint.issuedAt, 'issuedAt');
    const completeThroughMs = parseCanonicalTime(checkpoint.body.completeThrough, 'completeThrough');
    demand(completeThroughMs <= issuedMs, 'INVALID_CHECKPOINT_WINDOW', 'completeThrough cannot be later than checkpoint issuedAt.');

    if (verified.temporalStatus === 'CLOCK_UNKNOWN') return { ok: false, code: 'HOLD_CLOCK_UNKNOWN', evidence: verified };
    if (verified.temporalStatus === 'NOT_YET_VALID') return { ok: false, code: 'NOT_YET_VALID', evidence: verified };
    if (verified.temporalStatus === 'EXPIRED') return { ok: false, code: 'STALE_REVOCATION_CHECKPOINT', evidence: verified };

    const ids = collectRevocationIds(revocations, checkpoint.issuer, completeThroughMs);
    if (ids.length !== checkpoint.body.revocationCount || digestRevocationIds(ids) !== checkpoint.body.revocationIdsDigest) {
      return { ok: false, code: 'REVOCATION_SET_DIGEST_MISMATCH', evidence: verified };
    }

    return {
      ok: true,
      code: 'REVOCATION_SET_ATTESTED_THROUGH',
      checkpointId: verified.envelopeId,
      issuer: checkpoint.issuer,
      completeThrough: checkpoint.body.completeThrough,
      revocationCount: ids.length,
      truthBoundary: 'Attests the exact supplied revocation manifest through completeThrough; does not establish that no newer revocation exists.'
    };
  } catch (error) {
    if (error instanceof CheckpointError) return { ok: false, code: error.code, message: error.message, evidence: verified };
    throw error;
  }
}

module.exports = {
  CHECKPOINT_KIND,
  CheckpointError,
  createRevocationCheckpoint,
  evaluateRevocationCheckpoint
};
