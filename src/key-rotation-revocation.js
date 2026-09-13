'use strict';

const {
  TrustError,
  envelopeDigest,
  signEnvelope,
  verifyEnvelope
} = require('./trust-core');
const { evaluateKeyRotation } = require('./key-rotation');
const { evaluateTwoHopKeyRotationLineage } = require('./key-rotation-lineage');

const ROTATION_REVOCATION_KIND = 'key-rotation-revocation';
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
    'Object does not match the exact key-rotation revocation v1 field set.'
  );
}

function validateRotationRevocationBody(revocation) {
  const body = revocation?.body;
  demand(body && typeof body === 'object' && !Array.isArray(body), 'INVALID_ROTATION_REVOCATION', 'Rotation revocation body must be an object.');
  exactKeys(
    body,
    ['kind', 'rotationId', 'predecessorKeyId', 'successorKeyId', 'domain', 'reasonCode'],
    'INVALID_ROTATION_REVOCATION_SHAPE'
  );
  demand(body.kind === ROTATION_REVOCATION_KIND, 'INVALID_ROTATION_REVOCATION_KIND', 'Not a key-rotation revocation packet.');
  demand(HEX_256_RE.test(body.rotationId), 'INVALID_ROTATION_ID', 'Rotation revocation requires an exact sha256 rotation id.');
  demand(KEY_ID_RE.test(body.predecessorKeyId), 'INVALID_PREDECESSOR_KEY', 'Rotation revocation predecessor must be an Ed25519 key id.');
  demand(KEY_ID_RE.test(body.successorKeyId), 'INVALID_SUCCESSOR_KEY', 'Rotation revocation successor must be an Ed25519 key id.');
  demand(revocation.issuer === body.predecessorKeyId, 'ROTATION_REVOCATION_ISSUER_MISMATCH', 'Rotation revocation must be signed by the named predecessor key itself.');
  demand(typeof body.domain === 'string' && body.domain.length > 0 && body.domain.length <= 256, 'INVALID_ROTATION_REVOCATION_DOMAIN', 'Rotation revocation domain must be bounded text.');
  demand(typeof body.reasonCode === 'string' && /^[A-Z0-9_]{2,64}$/.test(body.reasonCode), 'INVALID_ROTATION_REVOCATION_REASON', 'reasonCode must be a bounded machine code.');
}

function createKeyRotationRevocation(predecessorIdentity, {
  rotation,
  issuedAt,
  expiresAt,
  nonce,
  reasonCode = 'ROTATION_REVOKED'
}) {
  demand(rotation?.body?.kind === 'key-rotation', 'INVALID_ROTATION_REFERENCE', 'Rotation revocation requires a key-rotation packet.');
  demand(predecessorIdentity && predecessorIdentity.keyId && predecessorIdentity.publicKey && predecessorIdentity.privateKey, 'INVALID_PREDECESSOR_IDENTITY', 'Predecessor identity is incomplete.');
  demand(predecessorIdentity.keyId === rotation.issuer, 'ROTATION_REVOCATION_PREDECESSOR_MISMATCH', 'Revocation signer must be the predecessor that signed the referenced rotation.');

  const body = {
    kind: ROTATION_REVOCATION_KIND,
    rotationId: envelopeDigest(rotation),
    predecessorKeyId: rotation.body.predecessorKeyId,
    successorKeyId: rotation.body.successorKeyId,
    domain: rotation.body.domain,
    reasonCode
  };
  const revocation = signEnvelope({ identity: predecessorIdentity, body, issuedAt, expiresAt, nonce });
  validateRotationRevocationBody(revocation);
  demand(
    Date.parse(revocation.issuedAt) >= Date.parse(rotation.issuedAt),
    'INVALID_ROTATION_REVOCATION_CAUSALITY',
    'Rotation revocation cannot be issued before the exact rotation packet it revokes.'
  );
  return revocation;
}

function evaluateKeyRotationWithRevocations(rotation, revocations = [], options = {}) {
  const rotationResult = evaluateKeyRotation(rotation, options);
  if (!rotationResult.ok) return rotationResult;
  if (!Array.isArray(revocations)) {
    return { ok: false, code: 'HOLD_ROTATION_REVOCATIONS_ARRAY_REQUIRED', rotationEvidence: rotationResult };
  }

  for (const packet of revocations) {
    const verified = verifyEnvelope(packet, { nowMs: options.nowMs });
    if (!verified.ok) continue;

    try {
      validateRotationRevocationBody(packet);
    } catch (error) {
      if (error instanceof TrustError) continue;
      throw error;
    }

    if (packet.body.rotationId !== rotationResult.rotationId) continue;
    if (packet.issuer !== rotationResult.predecessorKeyId) continue;

    if (
      packet.body.predecessorKeyId !== rotationResult.predecessorKeyId ||
      packet.body.successorKeyId !== rotationResult.successorKeyId ||
      packet.body.domain !== rotationResult.domain
    ) {
      return {
        ok: false,
        code: 'HOLD_ROTATION_REVOCATION_CONTEXT_MISMATCH',
        rotationEvidence: rotationResult,
        revocationId: verified.envelopeId
      };
    }

    if (Date.parse(packet.issuedAt) < Date.parse(rotation.issuedAt)) {
      return {
        ok: false,
        code: 'HOLD_INVALID_ROTATION_REVOCATION_CAUSALITY',
        rotationEvidence: rotationResult,
        revocationId: verified.envelopeId,
        truthBoundary: 'The exact supplied revocation is signed earlier than the exact supplied rotation packet it claims to revoke. This is a local signed-evidence causality contradiction only; it does not establish globally trustworthy time, freshness, synchronization, or ordering.'
      };
    }

    if (Date.parse(packet.expiresAt) < Date.parse(rotation.expiresAt)) {
      return {
        ok: false,
        code: 'HOLD_INVALID_ROTATION_REVOCATION_WINDOW',
        rotationEvidence: rotationResult,
        revocationId: verified.envelopeId
      };
    }

    if (verified.temporalStatus === 'NOT_YET_VALID') continue;
    if (verified.temporalStatus === 'CLOCK_UNKNOWN') {
      return {
        ok: false,
        code: 'HOLD_CLOCK_UNKNOWN',
        rotationEvidence: rotationResult,
        revocationId: verified.envelopeId
      };
    }

    return {
      ok: false,
      code: 'ROTATION_REVOKED',
      rotationEvidence: rotationResult,
      revocationId: verified.envelopeId,
      reasonCode: packet.body.reasonCode,
      truthBoundary: 'The exact predecessor-signed rotation is revoked by a supplied valid revocation from that same predecessor. This says nothing about unrelated rotations, unseen evidence, identity continuity, successor authority, or global rotation freshness.'
    };
  }

  return {
    ...rotationResult,
    code: 'KEY_ROTATION_USABLE_WITH_SUPPLIED_REVOCATION_EVIDENCE',
    truthBoundary: 'The supplied rotation remains usable because no active authoritative exact revocation was found in the revocation evidence supplied to this evaluation. This does not prove that no revocation exists elsewhere, that the rotation is globally fresh/newest, or that successor authority transferred.'
  };
}

function evaluateTwoHopKeyRotationLineageWithRevocations(rotations, acknowledgements, options = {}) {
  const lineage = evaluateTwoHopKeyRotationLineage(rotations, acknowledgements, options);
  if (!lineage.ok) return lineage;

  const revocationsByHop = options.revocationsByHop ?? [[], []];
  if (!Array.isArray(revocationsByHop) || revocationsByHop.length !== 2 || !revocationsByHop.every(Array.isArray)) {
    return { ok: false, code: 'HOLD_EXACT_TWO_REVOCATION_SETS_REQUIRED', lineageEvidence: lineage };
  }

  const expectedPredecessors = [options.expectedOrigin, lineage.intermediateKeyId];
  for (let hop = 0; hop < 2; hop += 1) {
    const rotation = evaluateKeyRotationWithRevocations(rotations[hop], revocationsByHop[hop], {
      nowMs: options.nowMs,
      expectedPredecessor: expectedPredecessors[hop],
      domain: options.domain
    });
    if (!rotation.ok) {
      return {
        ok: false,
        code: `HOLD_ROTATION_REVOCATION_EVIDENCE:${rotation.code}`,
        hop,
        lineageEvidence: lineage,
        rotationEvidence: rotation
      };
    }
  }

  return {
    ...lineage,
    code: 'TWO_HOP_ROTATION_LINEAGE_CONFIRMED_WITH_SUPPLIED_REVOCATION_EVIDENCE',
    truthBoundary: 'The supplied two-hop lineage is valid under its existing bounded rules and neither hop has an active authoritative exact revocation in the revocation evidence supplied to this evaluation. This does not prove global rotation freshness, uniqueness, unseen-branch absence, identity continuity, authority transfer, or fork resolution.'
  };
}

module.exports = {
  ROTATION_REVOCATION_KIND,
  createKeyRotationRevocation,
  evaluateKeyRotationWithRevocations,
  evaluateTwoHopKeyRotationLineageWithRevocations
};
