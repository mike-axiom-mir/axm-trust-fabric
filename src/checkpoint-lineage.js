'use strict';

const {
  envelopeDigest,
  signEnvelope,
  verifyEnvelope
} = require('./trust-core');

const CHECKPOINT_KIND = 'revocation-checkpoint';
const LINK_KIND = 'revocation-checkpoint-link';
const HEX_256_RE = /^[a-f0-9]{64}$/;
const ISO_MS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

class LineageError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LineageError';
    this.code = code;
  }
}

function demand(condition, code, message) {
  if (!condition) throw new LineageError(code, message);
}

function exactKeys(object, keys, code) {
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  demand(actual.length === expected.length && actual.every((key, index) => key === expected[index]), code, 'Object does not match the exact checkpoint-lineage v1 field set.');
}

function parseCanonicalTime(text, field) {
  demand(typeof text === 'string' && ISO_MS_RE.test(text), 'INVALID_LINEAGE_TIME', `${field} must be canonical UTC ISO time with milliseconds.`);
  const ms = Date.parse(text);
  demand(Number.isFinite(ms) && new Date(ms).toISOString() === text, 'INVALID_LINEAGE_TIME', `${field} is not canonical UTC time.`);
  return ms;
}

function validateCheckpoint(checkpoint) {
  const verified = verifyEnvelope(checkpoint);
  demand(verified.ok, 'LINEAGE_CHECKPOINT_INVALID', `Checkpoint envelope failed verification: ${verified.code}.`);
  demand(checkpoint.body && typeof checkpoint.body === 'object' && !Array.isArray(checkpoint.body), 'LINEAGE_CHECKPOINT_INVALID', 'Checkpoint body must be an object.');
  exactKeys(checkpoint.body, ['kind', 'completeThrough', 'revocationCount', 'revocationIdsDigest'], 'LINEAGE_CHECKPOINT_INVALID');
  demand(checkpoint.body.kind === CHECKPOINT_KIND, 'LINEAGE_CHECKPOINT_INVALID', 'Lineage may reference only revocation checkpoints.');
  parseCanonicalTime(checkpoint.body.completeThrough, 'checkpoint completeThrough');
  demand(Number.isSafeInteger(checkpoint.body.revocationCount) && checkpoint.body.revocationCount >= 0 && checkpoint.body.revocationCount <= 10000, 'LINEAGE_CHECKPOINT_INVALID', 'Checkpoint revocationCount is invalid.');
  demand(typeof checkpoint.body.revocationIdsDigest === 'string' && HEX_256_RE.test(checkpoint.body.revocationIdsDigest), 'LINEAGE_CHECKPOINT_INVALID', 'Checkpoint revocationIdsDigest is invalid.');
  return verified;
}

function validateLinkBody(body) {
  demand(body && typeof body === 'object' && !Array.isArray(body), 'INVALID_CHECKPOINT_LINK', 'Checkpoint link body must be an object.');
  exactKeys(body, ['kind', 'checkpointId', 'previousLinkId', 'sequence'], 'INVALID_CHECKPOINT_LINK_SHAPE');
  demand(body.kind === LINK_KIND, 'INVALID_CHECKPOINT_LINK_KIND', 'Not a checkpoint lineage link.');
  demand(typeof body.checkpointId === 'string' && HEX_256_RE.test(body.checkpointId), 'INVALID_CHECKPOINT_ID', 'checkpointId must be sha256 hex.');
  demand(body.previousLinkId === null || (typeof body.previousLinkId === 'string' && HEX_256_RE.test(body.previousLinkId)), 'INVALID_PREVIOUS_LINK_ID', 'previousLinkId must be null or sha256 hex.');
  demand(Number.isSafeInteger(body.sequence) && body.sequence >= 0 && body.sequence <= 1000000, 'INVALID_CHECKPOINT_SEQUENCE', 'sequence must be an integer from 0 to 1000000.');
  if (body.sequence === 0) demand(body.previousLinkId === null, 'INVALID_GENESIS_LINK', 'Sequence zero must not name a predecessor.');
  if (body.sequence > 0) demand(body.previousLinkId !== null, 'INVALID_NON_GENESIS_LINK', 'Non-genesis sequence must name a predecessor.');
}

function verifyLink(link, expectedIssuer) {
  const verified = verifyEnvelope(link);
  demand(verified.ok, 'CHECKPOINT_LINK_INVALID', `Checkpoint link envelope failed verification: ${verified.code}.`);
  validateLinkBody(link.body);
  demand(typeof expectedIssuer === 'string' && expectedIssuer.length > 0, 'HOLD_EXPECTED_ISSUER_REQUIRED', 'An explicit expected issuer is required.');
  demand(link.issuer === expectedIssuer, 'CHECKPOINT_LINEAGE_ISSUER_MISMATCH', 'Checkpoint lineage issuer does not match the expected issuer.');
  return verified;
}

function validateCheckpointBinding(link, checkpoint, expectedIssuer) {
  const checkpointVerified = validateCheckpoint(checkpoint);
  demand(checkpoint.issuer === expectedIssuer, 'CHECKPOINT_LINEAGE_ISSUER_MISMATCH', 'Checkpoint issuer does not match the expected issuer.');
  demand(link.issuer === checkpoint.issuer, 'CHECKPOINT_LINEAGE_ISSUER_MISMATCH', 'Checkpoint and lineage link must have the same issuer.');
  demand(link.body.checkpointId === envelopeDigest(checkpoint), 'CHECKPOINT_LINK_BINDING_MISMATCH', 'Lineage link does not bind the exact supplied checkpoint.');
  demand(parseCanonicalTime(link.issuedAt, 'link issuedAt') >= parseCanonicalTime(checkpoint.issuedAt, 'checkpoint issuedAt'), 'CHECKPOINT_LINK_BEFORE_CHECKPOINT', 'Lineage link cannot be issued before the checkpoint it names.');
  return checkpointVerified;
}

function createCheckpointLink(identity, { checkpoint, previousLink = null, issuedAt, expiresAt, nonce }) {
  demand(identity && typeof identity.keyId === 'string', 'INVALID_LINEAGE_IDENTITY', 'Lineage signing identity is incomplete.');
  validateCheckpoint(checkpoint);
  demand(checkpoint.issuer === identity.keyId, 'CHECKPOINT_LINEAGE_ISSUER_MISMATCH', 'Identity may link only its own checkpoint.');
  demand(parseCanonicalTime(issuedAt, 'link issuedAt') >= parseCanonicalTime(checkpoint.issuedAt, 'checkpoint issuedAt'), 'CHECKPOINT_LINK_BEFORE_CHECKPOINT', 'Lineage link cannot be issued before the checkpoint it names.');

  let sequence = 0;
  let previousLinkId = null;
  if (previousLink !== null) {
    const previousVerified = verifyEnvelope(previousLink);
    demand(previousVerified.ok, 'PREVIOUS_CHECKPOINT_LINK_INVALID', `Previous checkpoint link failed verification: ${previousVerified.code}.`);
    validateLinkBody(previousLink.body);
    demand(previousLink.issuer === identity.keyId, 'CHECKPOINT_LINEAGE_ISSUER_MISMATCH', 'Previous link must have the same issuer.');
    sequence = previousLink.body.sequence + 1;
    previousLinkId = envelopeDigest(previousLink);
  }

  const body = {
    kind: LINK_KIND,
    checkpointId: envelopeDigest(checkpoint),
    previousLinkId,
    sequence
  };
  validateLinkBody(body);
  return signEnvelope({ identity, body, issuedAt, expiresAt, nonce });
}

function validateRetainedHead(knownHead, expectedIssuer) {
  demand(knownHead && typeof knownHead === 'object' && knownHead.link && knownHead.checkpoint, 'INVALID_RETAINED_HEAD', 'knownHead must contain checkpoint and link.');
  verifyLink(knownHead.link, expectedIssuer);
  validateCheckpointBinding(knownHead.link, knownHead.checkpoint, expectedIssuer);
  return {
    linkId: envelopeDigest(knownHead.link),
    sequence: knownHead.link.body.sequence,
    completeThroughMs: parseCanonicalTime(knownHead.checkpoint.body.completeThrough, 'known head completeThrough')
  };
}

function evaluateCheckpointLineage(link, { checkpoint, knownHead = null, expectedIssuer } = {}) {
  try {
    const verified = verifyLink(link, expectedIssuer);
    validateCheckpointBinding(link, checkpoint, expectedIssuer);
    const linkId = verified.envelopeId;
    const completeThroughMs = parseCanonicalTime(checkpoint.body.completeThrough, 'candidate completeThrough');

    if (knownHead === null) {
      if (link.body.sequence !== 0 || link.body.previousLinkId !== null) {
        return {
          ok: false,
          code: 'HOLD_LINEAGE_HISTORY_REQUIRED',
          sequence: link.body.sequence,
          truthBoundary: 'A non-genesis link cannot establish its missing earlier lineage to a verifier that retained no prior head.'
        };
      }
      return {
        ok: true,
        code: 'LINEAGE_GENESIS_ACCEPTABLE',
        linkId,
        checkpointId: link.body.checkpointId,
        sequence: 0,
        completeThrough: checkpoint.body.completeThrough,
        truthBoundary: 'Acceptable as this verifier’s local genesis observation only; does not prove no earlier or newer issuer checkpoint exists elsewhere.'
      };
    }

    const head = validateRetainedHead(knownHead, expectedIssuer);
    if (linkId === head.linkId) {
      demand(link.body.checkpointId === envelopeDigest(knownHead.checkpoint), 'CHECKPOINT_LINK_BINDING_MISMATCH', 'Exact retained link was paired with a different checkpoint.');
      return {
        ok: true,
        code: 'LINEAGE_HEAD_CURRENT',
        linkId,
        checkpointId: link.body.checkpointId,
        sequence: link.body.sequence,
        completeThrough: checkpoint.body.completeThrough,
        truthBoundary: 'Matches the exact locally retained head; does not prove that this head is globally newest.'
      };
    }

    if (link.body.sequence < head.sequence) {
      return { ok: false, code: 'CHECKPOINT_ROLLBACK_DETECTED', candidateSequence: link.body.sequence, retainedSequence: head.sequence };
    }
    if (link.body.sequence === head.sequence) {
      return { ok: false, code: 'CHECKPOINT_FORK_DETECTED', candidateSequence: link.body.sequence, retainedSequence: head.sequence };
    }
    if (link.body.sequence > head.sequence + 1) {
      return { ok: false, code: 'HOLD_LINEAGE_GAP', candidateSequence: link.body.sequence, retainedSequence: head.sequence };
    }
    if (link.body.previousLinkId !== head.linkId) {
      return { ok: false, code: 'CHECKPOINT_FORK_DETECTED', candidateSequence: link.body.sequence, retainedSequence: head.sequence };
    }
    if (completeThroughMs < head.completeThroughMs) {
      return {
        ok: false,
        code: 'CHECKPOINT_COMPLETENESS_ROLLBACK',
        candidateCompleteThrough: checkpoint.body.completeThrough,
        retainedCompleteThrough: knownHead.checkpoint.body.completeThrough
      };
    }

    return {
      ok: true,
      code: 'LINEAGE_ADVANCE_ACCEPTABLE',
      linkId,
      checkpointId: link.body.checkpointId,
      sequence: link.body.sequence,
      completeThrough: checkpoint.body.completeThrough,
      truthBoundary: 'Monotonic only relative to the exact locally retained predecessor; does not discover newer unseen checkpoints or survive loss of retained state.'
    };
  } catch (error) {
    if (error instanceof LineageError) return { ok: false, code: error.code, message: error.message };
    throw error;
  }
}

module.exports = {
  LINK_KIND,
  LineageError,
  createCheckpointLink,
  evaluateCheckpointLineage
};
