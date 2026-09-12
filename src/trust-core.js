'use strict';

const crypto = require('node:crypto');

const ENVELOPE_VERSION = 'axm.trust-envelope/v1';
const CAPABILITY_KIND = 'capability-grant';
const REVOCATION_KIND = 'capability-revocation';

class TrustError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TrustError';
    this.code = code;
  }
}

function assert(condition, code, message) {
  if (!condition) throw new TrustError(code, message);
}

function canonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    assert(Number.isSafeInteger(value), 'NON_CANONICAL_NUMBER', 'Only safe integers are canonical in v1.');
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  assert(typeof value === 'object', 'UNSUPPORTED_CANONICAL_TYPE', 'Unsupported canonical JSON value.');
  const proto = Object.getPrototypeOf(value);
  assert(proto === Object.prototype || proto === null, 'NON_PLAIN_OBJECT', 'Only plain objects are canonical.');
  const keys = Object.keys(value).sort();
  for (const key of keys) {
    assert(value[key] !== undefined, 'UNDEFINED_VALUE', `Undefined value at key ${key}.`);
  }
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}

function b64url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function fromB64url(text, code = 'INVALID_BASE64URL') {
  assert(typeof text === 'string' && /^[A-Za-z0-9_-]+$/.test(text), code, 'Expected unpadded base64url text.');
  return Buffer.from(text, 'base64url');
}

function importPublicKey(publicKeyB64) {
  return crypto.createPublicKey({ key: fromB64url(publicKeyB64, 'INVALID_PUBLIC_KEY'), format: 'der', type: 'spki' });
}

function importPrivateKey(privateKeyB64) {
  return crypto.createPrivateKey({ key: fromB64url(privateKeyB64, 'INVALID_PRIVATE_KEY'), format: 'der', type: 'pkcs8' });
}

function exportPublicKey(publicKey) {
  return b64url(publicKey.export({ format: 'der', type: 'spki' }));
}

function exportPrivateKey(privateKey) {
  return b64url(privateKey.export({ format: 'der', type: 'pkcs8' }));
}

function keyIdFromPublicKey(publicKeyB64) {
  const der = fromB64url(publicKeyB64, 'INVALID_PUBLIC_KEY');
  return `axm:key:ed25519:${crypto.createHash('sha256').update(der).digest('hex')}`;
}

function generateIdentity() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyB64 = exportPublicKey(publicKey);
  return {
    keyId: keyIdFromPublicKey(publicKeyB64),
    publicKey: publicKeyB64,
    privateKey: exportPrivateKey(privateKey),
    algorithm: 'Ed25519'
  };
}

function parseTime(text, field) {
  assert(typeof text === 'string' && text.length >= 20, 'INVALID_TIME', `${field} must be an ISO timestamp string.`);
  const ms = Date.parse(text);
  assert(Number.isFinite(ms), 'INVALID_TIME', `${field} is not parseable.`);
  return ms;
}

function validateEnvelopeShape(envelope) {
  assert(envelope && typeof envelope === 'object' && !Array.isArray(envelope), 'INVALID_ENVELOPE', 'Envelope must be an object.');
  const allowed = ['version', 'issuer', 'publicKey', 'issuedAt', 'expiresAt', 'nonce', 'body', 'signature'];
  const keys = Object.keys(envelope).sort();
  assert(keys.length === allowed.length && allowed.every((key) => keys.includes(key)), 'INVALID_ENVELOPE_SHAPE', 'Envelope must use the exact v1 field set.');
  assert(envelope.version === ENVELOPE_VERSION, 'UNSUPPORTED_VERSION', 'Unsupported envelope version.');
  assert(typeof envelope.issuer === 'string' && envelope.issuer.startsWith('axm:key:ed25519:'), 'INVALID_ISSUER', 'Invalid issuer key id.');
  assert(typeof envelope.publicKey === 'string', 'INVALID_PUBLIC_KEY', 'Missing public key.');
  assert(keyIdFromPublicKey(envelope.publicKey) === envelope.issuer, 'ISSUER_KEY_MISMATCH', 'Issuer id does not match embedded public key.');
  assert(typeof envelope.nonce === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(envelope.nonce), 'INVALID_NONCE', 'Nonce must be bounded base64url text.');
  assert(envelope.body && typeof envelope.body === 'object' && !Array.isArray(envelope.body), 'INVALID_BODY', 'Body must be an object.');
  assert(typeof envelope.signature === 'string', 'INVALID_SIGNATURE', 'Signature is missing.');
  const issuedMs = parseTime(envelope.issuedAt, 'issuedAt');
  const expiresMs = parseTime(envelope.expiresAt, 'expiresAt');
  assert(expiresMs > issuedMs, 'INVALID_TIME_WINDOW', 'expiresAt must be later than issuedAt.');
  canonicalize(envelope.body);
  return { issuedMs, expiresMs };
}

function unsignedEnvelope(envelope) {
  const { signature, ...rest } = envelope;
  return rest;
}

function envelopeDigest(envelope) {
  return crypto.createHash('sha256').update(canonicalize(unsignedEnvelope(envelope))).digest('hex');
}

function signEnvelope({ identity, body, issuedAt, expiresAt, nonce }) {
  assert(identity && identity.privateKey && identity.publicKey && identity.keyId, 'INVALID_IDENTITY', 'Signing identity is incomplete.');
  const envelope = {
    version: ENVELOPE_VERSION,
    issuer: identity.keyId,
    publicKey: identity.publicKey,
    issuedAt,
    expiresAt,
    nonce,
    body,
    signature: ''
  };
  validateEnvelopeShape({ ...envelope, signature: 'AA' });
  const payload = Buffer.from(canonicalize(unsignedEnvelope(envelope)), 'utf8');
  const signature = crypto.sign(null, payload, importPrivateKey(identity.privateKey));
  return { ...envelope, signature: b64url(signature) };
}

function verifyEnvelope(envelope, options = {}) {
  try {
    const { issuedMs, expiresMs } = validateEnvelopeShape(envelope);
    const payload = Buffer.from(canonicalize(unsignedEnvelope(envelope)), 'utf8');
    const signature = fromB64url(envelope.signature, 'INVALID_SIGNATURE');
    const signatureValid = crypto.verify(null, payload, importPublicKey(envelope.publicKey), signature);
    if (!signatureValid) return { ok: false, code: 'INVALID_SIGNATURE', signatureValid: false, temporalStatus: 'NOT_EVALUATED' };

    let temporalStatus = 'CLOCK_UNKNOWN';
    if (Number.isFinite(options.nowMs)) {
      if (options.nowMs < issuedMs) temporalStatus = 'NOT_YET_VALID';
      else if (options.nowMs >= expiresMs) temporalStatus = 'EXPIRED';
      else temporalStatus = 'WITHIN_WINDOW';
    }

    return {
      ok: true,
      code: 'SIGNATURE_VALID',
      signatureValid: true,
      temporalStatus,
      envelopeId: envelopeDigest(envelope),
      issuer: envelope.issuer
    };
  } catch (error) {
    if (error instanceof TrustError) return { ok: false, code: error.code, message: error.message, signatureValid: false, temporalStatus: 'NOT_EVALUATED' };
    throw error;
  }
}

function uniqueSortedStrings(values, code, label) {
  assert(Array.isArray(values) && values.length > 0 && values.length <= 64, code, `${label} must contain 1-64 values.`);
  assert(values.every((value) => typeof value === 'string' && value.length > 0 && value.length <= 128), code, `${label} values must be bounded strings.`);
  const sorted = [...new Set(values)].sort();
  assert(sorted.length === values.length && values.every((value, index) => value === sorted[index]), code, `${label} must be unique and sorted.`);
  return sorted;
}

function validateCapabilityBody(body) {
  assert(body.kind === CAPABILITY_KIND, 'INVALID_CAPABILITY_KIND', 'Not a capability grant.');
  const allowed = ['kind', 'subject', 'target', 'actions', 'delegationDepth', 'parentCapabilityId', 'oneUse'];
  const keys = Object.keys(body).sort();
  assert(keys.length === allowed.length && allowed.every((key) => keys.includes(key)), 'INVALID_CAPABILITY_SHAPE', 'Capability grant must use the exact v1 field set.');
  assert(typeof body.subject === 'string' && body.subject.startsWith('axm:key:ed25519:'), 'INVALID_SUBJECT', 'Capability subject must be a key id.');
  assert(typeof body.target === 'string' && body.target.length > 0 && body.target.length <= 256, 'INVALID_TARGET', 'Capability target must be bounded text.');
  uniqueSortedStrings(body.actions, 'INVALID_ACTIONS', 'actions');
  assert(Number.isSafeInteger(body.delegationDepth) && body.delegationDepth >= 0 && body.delegationDepth <= 16, 'INVALID_DELEGATION_DEPTH', 'delegationDepth must be 0-16.');
  assert(body.parentCapabilityId === null || (typeof body.parentCapabilityId === 'string' && /^[a-f0-9]{64}$/.test(body.parentCapabilityId)), 'INVALID_PARENT', 'parentCapabilityId must be null or sha256 hex.');
  assert(typeof body.oneUse === 'boolean', 'INVALID_ONE_USE', 'oneUse must be boolean.');
  return true;
}

function createCapability(identity, { subject, target, actions, delegationDepth = 0, parentCapabilityId = null, oneUse = false, issuedAt, expiresAt, nonce }) {
  const body = {
    kind: CAPABILITY_KIND,
    subject,
    target,
    actions: [...new Set(actions)].sort(),
    delegationDepth,
    parentCapabilityId,
    oneUse
  };
  validateCapabilityBody(body);
  return signEnvelope({ identity, body, issuedAt, expiresAt, nonce });
}

function validateDelegation(parent, child) {
  try {
    validateCapabilityBody(parent.body);
    validateCapabilityBody(child.body);
    assert(child.body.parentCapabilityId === envelopeDigest(parent), 'PARENT_MISMATCH', 'Child does not bind the exact parent capability.');
    assert(parent.body.delegationDepth > 0, 'DELEGATION_FORBIDDEN', 'Parent has no remaining delegation depth.');
    assert(child.issuer === parent.body.subject, 'DELEGATE_ISSUER_MISMATCH', 'Child must be signed by the parent subject.');
    assert(child.body.target === parent.body.target, 'TARGET_ESCALATION', 'Child target must equal parent target in v1.');
    assert(child.body.actions.every((action) => parent.body.actions.includes(action)), 'ACTION_ESCALATION', 'Child actions must be a subset of parent actions.');
    assert(child.body.delegationDepth <= parent.body.delegationDepth - 1, 'DELEGATION_ESCALATION', 'Child delegation depth exceeds parent ceiling.');
    assert(parseTime(child.issuedAt, 'issuedAt') >= parseTime(parent.issuedAt, 'issuedAt'), 'TIME_ESCALATION', 'Child cannot begin before parent.');
    assert(parseTime(child.expiresAt, 'expiresAt') <= parseTime(parent.expiresAt, 'expiresAt'), 'TIME_ESCALATION', 'Child cannot outlive parent.');
    if (parent.body.oneUse) assert(child.body.oneUse === true, 'USE_ESCALATION', 'A one-use parent cannot create a reusable child.');
    return { ok: true, code: 'DELEGATION_VALID' };
  } catch (error) {
    if (error instanceof TrustError) return { ok: false, code: error.code, message: error.message };
    throw error;
  }
}

function createRevocation(identity, { capabilityId, issuedAt, expiresAt, nonce, reasonCode = 'REVOKED' }) {
  assert(typeof capabilityId === 'string' && /^[a-f0-9]{64}$/.test(capabilityId), 'INVALID_CAPABILITY_ID', 'Revocation requires a capability id.');
  assert(typeof reasonCode === 'string' && /^[A-Z0-9_]{2,64}$/.test(reasonCode), 'INVALID_REASON', 'reasonCode must be a bounded machine code.');
  return signEnvelope({
    identity,
    issuedAt,
    expiresAt,
    nonce,
    body: { kind: REVOCATION_KIND, capabilityId, reasonCode }
  });
}

function evaluateCapability(capability, { nowMs, target, action, revocations = [], localConsumedIds = new Set() } = {}) {
  const verified = verifyEnvelope(capability, { nowMs });
  if (!verified.ok) return { authorized: false, code: verified.code, evidence: verified };
  try {
    validateCapabilityBody(capability.body);
  } catch (error) {
    if (error instanceof TrustError) return { authorized: false, code: error.code, evidence: verified };
    throw error;
  }

  if (verified.temporalStatus !== 'WITHIN_WINDOW') {
    return { authorized: false, code: verified.temporalStatus === 'CLOCK_UNKNOWN' ? 'HOLD_CLOCK_UNKNOWN' : verified.temporalStatus, evidence: verified };
  }
  if (typeof target !== 'string' || target !== capability.body.target) return { authorized: false, code: 'WRONG_TARGET', evidence: verified };
  if (typeof action !== 'string' || !capability.body.actions.includes(action)) return { authorized: false, code: 'WRONG_ACTION', evidence: verified };

  const capabilityId = verified.envelopeId;
  for (const revocation of revocations) {
    const rev = verifyEnvelope(revocation, { nowMs });
    if (!rev.ok || rev.temporalStatus !== 'WITHIN_WINDOW') continue;
    if (revocation.body && revocation.body.kind === REVOCATION_KIND && revocation.body.capabilityId === capabilityId && revocation.issuer === capability.issuer) {
      return { authorized: false, code: 'REVOKED', evidence: verified, revocationId: rev.envelopeId };
    }
  }

  if (capability.body.oneUse && localConsumedIds.has(capabilityId)) return { authorized: false, code: 'LOCAL_REPLAY', evidence: verified };
  return { authorized: true, code: 'AUTHORIZED_FOR_SCOPE', evidence: verified, capabilityId, oneUse: capability.body.oneUse };
}

function claimState(envelope, options = {}) {
  const verified = verifyEnvelope(envelope, options);
  return {
    integrity: verified.ok ? 'SIGNED_BYTES_MATCH' : 'UNVERIFIED',
    authorship: verified.ok ? 'KEY_POSSESSION_PROVEN_FOR_SIGNATURE' : 'UNVERIFIED',
    authority: 'REQUIRES_SCOPE_EVALUATION',
    identityContinuity: 'NOT_ESTABLISHED_BY_SIGNATURE_ALONE',
    truth: 'NOT_EVALUATED'
  };
}

module.exports = {
  ENVELOPE_VERSION,
  CAPABILITY_KIND,
  REVOCATION_KIND,
  TrustError,
  canonicalize,
  generateIdentity,
  keyIdFromPublicKey,
  envelopeDigest,
  signEnvelope,
  verifyEnvelope,
  createCapability,
  validateDelegation,
  createRevocation,
  evaluateCapability,
  claimState
};
