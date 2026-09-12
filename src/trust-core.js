'use strict';

const crypto = require('node:crypto');

const ENVELOPE_VERSION = 'axm.trust-envelope/v1';
const CAPABILITY_KIND = 'capability-grant';
const REVOCATION_KIND = 'capability-revocation';
const USE_KIND = 'capability-use';
const KEY_ID_RE = /^axm:key:ed25519:[a-f0-9]{64}$/;
const HEX_256_RE = /^[a-f0-9]{64}$/;
const B64URL_RE = /^[A-Za-z0-9_-]+$/;
const ISO_MS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

class TrustError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TrustError';
    this.code = code;
  }
}

function demand(condition, code, message) {
  if (!condition) throw new TrustError(code, message);
}

function exactKeys(object, keys, code) {
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  demand(actual.length === expected.length && actual.every((key, index) => key === expected[index]), code, 'Object does not match the exact v1 field set.');
}

function canonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    demand(Number.isSafeInteger(value), 'NON_CANONICAL_NUMBER', 'Only safe integers are canonical in v1.');
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  demand(value && typeof value === 'object', 'UNSUPPORTED_CANONICAL_TYPE', 'Unsupported canonical JSON value.');
  const proto = Object.getPrototypeOf(value);
  demand(proto === Object.prototype || proto === null, 'NON_PLAIN_OBJECT', 'Only plain objects are canonical.');
  const keys = Object.keys(value).sort();
  for (const key of keys) demand(value[key] !== undefined, 'UNDEFINED_VALUE', `Undefined value at key ${key}.`);
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}

function b64url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

function fromB64url(text, code) {
  demand(typeof text === 'string' && text.length > 0 && B64URL_RE.test(text), code, 'Expected unpadded base64url text.');
  return Buffer.from(text, 'base64url');
}

function importPublicKey(text) {
  try {
    return crypto.createPublicKey({ key: fromB64url(text, 'INVALID_PUBLIC_KEY'), format: 'der', type: 'spki' });
  } catch (error) {
    if (error instanceof TrustError) throw error;
    throw new TrustError('INVALID_PUBLIC_KEY', 'Public key material is not a valid Ed25519 SPKI key.');
  }
}

function importPrivateKey(text) {
  try {
    return crypto.createPrivateKey({ key: fromB64url(text, 'INVALID_PRIVATE_KEY'), format: 'der', type: 'pkcs8' });
  } catch (error) {
    if (error instanceof TrustError) throw error;
    throw new TrustError('INVALID_PRIVATE_KEY', 'Private key material is not a valid Ed25519 PKCS8 key.');
  }
}

function keyIdFromPublicKey(publicKey) {
  const der = fromB64url(publicKey, 'INVALID_PUBLIC_KEY');
  return `axm:key:ed25519:${crypto.createHash('sha256').update(der).digest('hex')}`;
}

function generateIdentity() {
  const pair = crypto.generateKeyPairSync('ed25519');
  const publicKey = b64url(pair.publicKey.export({ format: 'der', type: 'spki' }));
  return {
    algorithm: 'Ed25519',
    keyId: keyIdFromPublicKey(publicKey),
    publicKey,
    privateKey: b64url(pair.privateKey.export({ format: 'der', type: 'pkcs8' }))
  };
}

function parseTime(text, field) {
  demand(typeof text === 'string' && ISO_MS_RE.test(text), 'INVALID_TIME', `${field} must be canonical UTC ISO time with milliseconds.`);
  const ms = Date.parse(text);
  demand(Number.isFinite(ms) && new Date(ms).toISOString() === text, 'INVALID_TIME', `${field} is not canonical UTC time.`);
  return ms;
}

function validateEnvelopeShape(envelope) {
  demand(envelope && typeof envelope === 'object' && !Array.isArray(envelope), 'INVALID_ENVELOPE', 'Envelope must be an object.');
  exactKeys(envelope, ['version', 'issuer', 'publicKey', 'issuedAt', 'expiresAt', 'nonce', 'body', 'signature'], 'INVALID_ENVELOPE_SHAPE');
  demand(envelope.version === ENVELOPE_VERSION, 'UNSUPPORTED_VERSION', 'Unsupported envelope version.');
  demand(KEY_ID_RE.test(envelope.issuer), 'INVALID_ISSUER', 'Invalid issuer key id.');
  demand(typeof envelope.publicKey === 'string', 'INVALID_PUBLIC_KEY', 'Missing public key.');
  demand(keyIdFromPublicKey(envelope.publicKey) === envelope.issuer, 'ISSUER_KEY_MISMATCH', 'Issuer id does not match embedded public key.');
  demand(typeof envelope.nonce === 'string' && envelope.nonce.length >= 16 && envelope.nonce.length <= 128 && B64URL_RE.test(envelope.nonce), 'INVALID_NONCE', 'Nonce must be bounded base64url text.');
  demand(envelope.body && typeof envelope.body === 'object' && !Array.isArray(envelope.body), 'INVALID_BODY', 'Body must be an object.');
  demand(typeof envelope.signature === 'string', 'INVALID_SIGNATURE', 'Signature is missing.');
  const issuedMs = parseTime(envelope.issuedAt, 'issuedAt');
  const expiresMs = parseTime(envelope.expiresAt, 'expiresAt');
  demand(expiresMs > issuedMs, 'INVALID_TIME_WINDOW', 'expiresAt must be later than issuedAt.');
  canonicalize(envelope.body);
  return { issuedMs, expiresMs };
}

function unsignedEnvelope(envelope) {
  const { signature, ...unsigned } = envelope;
  return unsigned;
}

function envelopeDigest(envelope) {
  return crypto.createHash('sha256').update(canonicalize(unsignedEnvelope(envelope))).digest('hex');
}

function signEnvelope({ identity, body, issuedAt, expiresAt, nonce }) {
  demand(identity && identity.keyId && identity.publicKey && identity.privateKey, 'INVALID_IDENTITY', 'Signing identity is incomplete.');
  const envelope = { version: ENVELOPE_VERSION, issuer: identity.keyId, publicKey: identity.publicKey, issuedAt, expiresAt, nonce, body, signature: 'AA' };
  validateEnvelopeShape(envelope);
  envelope.signature = b64url(crypto.sign(null, Buffer.from(canonicalize(unsignedEnvelope(envelope))), importPrivateKey(identity.privateKey)));
  return envelope;
}

function verifyEnvelope(envelope, { nowMs } = {}) {
  try {
    const { issuedMs, expiresMs } = validateEnvelopeShape(envelope);
    const signature = fromB64url(envelope.signature, 'INVALID_SIGNATURE');
    const valid = crypto.verify(null, Buffer.from(canonicalize(unsignedEnvelope(envelope))), importPublicKey(envelope.publicKey), signature);
    if (!valid) return { ok: false, code: 'INVALID_SIGNATURE', signatureValid: false, temporalStatus: 'NOT_EVALUATED' };
    let temporalStatus = 'CLOCK_UNKNOWN';
    if (Number.isFinite(nowMs)) temporalStatus = nowMs < issuedMs ? 'NOT_YET_VALID' : nowMs >= expiresMs ? 'EXPIRED' : 'WITHIN_WINDOW';
    return { ok: true, code: 'SIGNATURE_VALID', signatureValid: true, temporalStatus, envelopeId: envelopeDigest(envelope), issuer: envelope.issuer };
  } catch (error) {
    if (error instanceof TrustError) return { ok: false, code: error.code, message: error.message, signatureValid: false, temporalStatus: 'NOT_EVALUATED' };
    throw error;
  }
}

function validateActions(actions) {
  demand(Array.isArray(actions) && actions.length > 0 && actions.length <= 64, 'INVALID_ACTIONS', 'actions must contain 1-64 values.');
  demand(actions.every((value) => typeof value === 'string' && value.length > 0 && value.length <= 128), 'INVALID_ACTIONS', 'actions must be bounded strings.');
  const sorted = [...new Set(actions)].sort();
  demand(sorted.length === actions.length && actions.every((value, index) => value === sorted[index]), 'INVALID_ACTIONS', 'actions must be unique and sorted.');
}

function validateCapabilityBody(body) {
  demand(body && typeof body === 'object' && !Array.isArray(body), 'INVALID_CAPABILITY', 'Capability body must be an object.');
  exactKeys(body, ['kind', 'subject', 'target', 'actions', 'delegationDepth', 'parentCapabilityId', 'oneUse'], 'INVALID_CAPABILITY_SHAPE');
  demand(body.kind === CAPABILITY_KIND, 'INVALID_CAPABILITY_KIND', 'Not a capability grant.');
  demand(KEY_ID_RE.test(body.subject), 'INVALID_SUBJECT', 'Capability subject must be an Ed25519 key id.');
  demand(typeof body.target === 'string' && body.target.length > 0 && body.target.length <= 256, 'INVALID_TARGET', 'Capability target must be bounded text.');
  validateActions(body.actions);
  demand(Number.isSafeInteger(body.delegationDepth) && body.delegationDepth >= 0 && body.delegationDepth <= 16, 'INVALID_DELEGATION_DEPTH', 'delegationDepth must be 0-16.');
  demand(body.parentCapabilityId === null || (typeof body.parentCapabilityId === 'string' && HEX_256_RE.test(body.parentCapabilityId)), 'INVALID_PARENT', 'parentCapabilityId must be null or sha256 hex.');
  demand(typeof body.oneUse === 'boolean', 'INVALID_ONE_USE', 'oneUse must be boolean.');
  if (body.oneUse) demand(body.delegationDepth === 0, 'ONE_USE_DELEGATION_FORBIDDEN', 'one-use capabilities cannot delegate in v0.1.');
}

function createCapability(identity, { subject, target, actions, delegationDepth = 0, parentCapabilityId = null, oneUse = false, issuedAt, expiresAt, nonce }) {
  const body = { kind: CAPABILITY_KIND, subject, target, actions: [...new Set(actions)].sort(), delegationDepth, parentCapabilityId, oneUse };
  validateCapabilityBody(body);
  return signEnvelope({ identity, body, issuedAt, expiresAt, nonce });
}

function validateDelegation(parent, child) {
  try {
    validateCapabilityBody(parent.body);
    validateCapabilityBody(child.body);
    demand(child.body.parentCapabilityId === envelopeDigest(parent), 'PARENT_MISMATCH', 'Child does not bind the exact parent capability.');
    demand(parent.body.delegationDepth > 0, 'DELEGATION_FORBIDDEN', 'Parent has no remaining delegation depth.');
    demand(child.issuer === parent.body.subject, 'DELEGATE_ISSUER_MISMATCH', 'Child must be signed by the parent subject.');
    demand(child.body.target === parent.body.target, 'TARGET_ESCALATION', 'Child target must equal parent target in v1.');
    demand(child.body.actions.every((action) => parent.body.actions.includes(action)), 'ACTION_ESCALATION', 'Child actions must be a subset of parent actions.');
    demand(child.body.delegationDepth <= parent.body.delegationDepth - 1, 'DELEGATION_ESCALATION', 'Child delegation depth exceeds parent ceiling.');
    demand(parseTime(child.issuedAt, 'issuedAt') >= parseTime(parent.issuedAt, 'issuedAt'), 'TIME_ESCALATION', 'Child cannot begin before parent.');
    demand(parseTime(child.expiresAt, 'expiresAt') <= parseTime(parent.expiresAt, 'expiresAt'), 'TIME_ESCALATION', 'Child cannot outlive parent.');
    if (parent.body.oneUse) demand(child.body.oneUse, 'USE_ESCALATION', 'A one-use parent cannot create a reusable child.');
    return { ok: true, code: 'DELEGATION_VALID' };
  } catch (error) {
    if (error instanceof TrustError) return { ok: false, code: error.code, message: error.message };
    throw error;
  }
}

function validateRevocationBody(body) {
  demand(body && typeof body === 'object' && !Array.isArray(body), 'INVALID_REVOCATION', 'Revocation body must be an object.');
  exactKeys(body, ['kind', 'capabilityId', 'reasonCode'], 'INVALID_REVOCATION_SHAPE');
  demand(body.kind === REVOCATION_KIND, 'INVALID_REVOCATION_KIND', 'Not a revocation packet.');
  demand(HEX_256_RE.test(body.capabilityId), 'INVALID_CAPABILITY_ID', 'Revocation requires a capability id.');
  demand(typeof body.reasonCode === 'string' && /^[A-Z0-9_]{2,64}$/.test(body.reasonCode), 'INVALID_REASON', 'reasonCode must be a bounded machine code.');
}

function createRevocation(identity, { capabilityId, issuedAt, expiresAt, nonce, reasonCode = 'REVOKED' }) {
  const body = { kind: REVOCATION_KIND, capabilityId, reasonCode };
  validateRevocationBody(body);
  return signEnvelope({ identity, body, issuedAt, expiresAt, nonce });
}

function evaluateCapabilityEvidence(capability, { nowMs, revocations = [] } = {}) {
  const verified = verifyEnvelope(capability, { nowMs });
  if (!verified.ok) return { ok: false, code: verified.code, evidence: verified };
  try { validateCapabilityBody(capability.body); } catch (error) {
    if (error instanceof TrustError) return { ok: false, code: error.code, evidence: verified };
    throw error;
  }
  if (verified.temporalStatus !== 'WITHIN_WINDOW') return { ok: false, code: verified.temporalStatus === 'CLOCK_UNKNOWN' ? 'HOLD_CLOCK_UNKNOWN' : verified.temporalStatus, evidence: verified };

  const capabilityId = verified.envelopeId;
  for (const packet of revocations) {
    const rev = verifyEnvelope(packet, { nowMs });
    if (!rev.ok) continue;
    try { validateRevocationBody(packet.body); } catch { continue; }
    if (packet.body.capabilityId !== capabilityId || packet.issuer !== capability.issuer) continue;
    if (parseTime(packet.expiresAt, 'expiresAt') < parseTime(capability.expiresAt, 'expiresAt')) return { ok: false, code: 'HOLD_INVALID_REVOCATION_WINDOW', evidence: verified, revocationId: rev.envelopeId };
    if (rev.temporalStatus === 'NOT_YET_VALID') continue;
    return { ok: false, code: 'REVOKED', evidence: verified, revocationId: rev.envelopeId };
  }
  return { ok: true, code: 'CAPABILITY_EVIDENCE_VALID', evidence: verified, capabilityId };
}

function rootTrusted(issuer, trustedRootIssuers) {
  return trustedRootIssuers instanceof Set && trustedRootIssuers.has(issuer);
}

function evaluateCapability(capability, { nowMs, target, action, revocations = [], localConsumedIds = new Set(), trustedRootIssuers = new Set() } = {}) {
  const base = evaluateCapabilityEvidence(capability, { nowMs, revocations });
  if (!base.ok) return { grantValid: false, ...base };
  if (capability.body.parentCapabilityId !== null) return { grantValid: false, code: 'HOLD_PARENT_CHAIN_REQUIRED', evidence: base.evidence };
  if (!rootTrusted(capability.issuer, trustedRootIssuers)) return { grantValid: false, code: 'UNTRUSTED_ROOT_ISSUER', evidence: base.evidence };
  if (target !== capability.body.target) return { grantValid: false, code: 'WRONG_TARGET', evidence: base.evidence };
  if (!capability.body.actions.includes(action)) return { grantValid: false, code: 'WRONG_ACTION', evidence: base.evidence };
  if (capability.body.oneUse && localConsumedIds.has(base.capabilityId)) return { grantValid: false, code: 'LOCAL_REPLAY', evidence: base.evidence };
  return { grantValid: true, code: 'GRANT_VALID_FOR_SCOPE', evidence: base.evidence, capabilityId: base.capabilityId, subject: capability.body.subject, oneUse: capability.body.oneUse };
}

function evaluateCapabilityChain(chain, { nowMs, target, action, revocations = [], localConsumedIds = new Set(), trustedRootIssuers = new Set() } = {}) {
  if (!Array.isArray(chain) || chain.length === 0 || chain.length > 17) return { grantValid: false, code: 'INVALID_CHAIN' };
  const root = chain[0];
  if (!rootTrusted(root.issuer, trustedRootIssuers)) return { grantValid: false, code: 'UNTRUSTED_ROOT_ISSUER' };
  if (!root.body || root.body.parentCapabilityId !== null) return { grantValid: false, code: 'INVALID_ROOT_CAPABILITY' };
  for (let index = 0; index < chain.length; index += 1) {
    const evidence = evaluateCapabilityEvidence(chain[index], { nowMs, revocations });
    if (!evidence.ok) return { grantValid: false, code: evidence.code, chainIndex: index, evidence: evidence.evidence };
    if (index > 0) {
      const delegation = validateDelegation(chain[index - 1], chain[index]);
      if (!delegation.ok) return { grantValid: false, code: delegation.code, chainIndex: index };
    }
  }
  const leaf = chain.at(-1);
  const capabilityId = envelopeDigest(leaf);
  if (target !== leaf.body.target) return { grantValid: false, code: 'WRONG_TARGET' };
  if (!leaf.body.actions.includes(action)) return { grantValid: false, code: 'WRONG_ACTION' };
  if (leaf.body.oneUse && localConsumedIds.has(capabilityId)) return { grantValid: false, code: 'LOCAL_REPLAY' };
  return { grantValid: true, code: 'GRANT_VALID_FOR_SCOPE', capabilityId, subject: leaf.body.subject, oneUse: leaf.body.oneUse, chainDepth: chain.length };
}

function validateUseBody(body) {
  demand(body && typeof body === 'object' && !Array.isArray(body), 'INVALID_USE', 'Use body must be an object.');
  exactKeys(body, ['kind', 'capabilityId', 'target', 'action'], 'INVALID_USE_SHAPE');
  demand(body.kind === USE_KIND, 'INVALID_USE_KIND', 'Not a capability-use request.');
  demand(HEX_256_RE.test(body.capabilityId), 'INVALID_CAPABILITY_ID', 'Use request requires a capability id.');
  demand(typeof body.target === 'string' && body.target.length > 0 && body.target.length <= 256, 'INVALID_TARGET', 'Use target must be bounded text.');
  demand(typeof body.action === 'string' && body.action.length > 0 && body.action.length <= 128, 'INVALID_ACTION', 'Use action must be bounded text.');
}

function createUseRequest(identity, { capabilityId, target, action, issuedAt, expiresAt, nonce }) {
  const body = { kind: USE_KIND, capabilityId, target, action };
  validateUseBody(body);
  return signEnvelope({ identity, body, issuedAt, expiresAt, nonce });
}

function evaluateUseRequest(chain, request, options = {}) {
  const grant = evaluateCapabilityChain(chain, { ...options, target: request?.body?.target, action: request?.body?.action });
  if (!grant.grantValid) return { authorized: false, code: grant.code, grant };
  const use = verifyEnvelope(request, { nowMs: options.nowMs });
  if (!use.ok) return { authorized: false, code: use.code, grant };
  if (use.temporalStatus !== 'WITHIN_WINDOW') return { authorized: false, code: use.temporalStatus === 'CLOCK_UNKNOWN' ? 'HOLD_CLOCK_UNKNOWN' : use.temporalStatus, grant };
  try { validateUseBody(request.body); } catch (error) {
    if (error instanceof TrustError) return { authorized: false, code: error.code, grant };
    throw error;
  }
  if (request.issuer !== grant.subject) return { authorized: false, code: 'SUBJECT_POSSESSION_MISMATCH', grant };
  if (request.body.capabilityId !== grant.capabilityId) return { authorized: false, code: 'CAPABILITY_BINDING_MISMATCH', grant };
  const requestId = use.envelopeId;
  if (options.localConsumedRequestIds instanceof Set && options.localConsumedRequestIds.has(requestId)) return { authorized: false, code: 'LOCAL_USE_REPLAY', grant, requestId };
  return { authorized: true, code: 'AUTHORIZED_USE', grant, requestId, subject: grant.subject };
}

function claimState(envelope, options = {}) {
  const verified = verifyEnvelope(envelope, options);
  return {
    integrity: verified.ok ? 'SIGNED_BYTES_MATCH' : 'UNVERIFIED',
    authorship: verified.ok ? 'KEY_POSSESSION_PROVEN_FOR_SIGNATURE' : 'UNVERIFIED',
    authority: 'REQUIRES_TRUST_ROOT_SCOPE_CHAIN_AND_SUBJECT_USE_PROOF',
    identityContinuity: 'NOT_ESTABLISHED_BY_SIGNATURE_ALONE',
    truth: 'NOT_EVALUATED'
  };
}

module.exports = {
  ENVELOPE_VERSION,
  CAPABILITY_KIND,
  REVOCATION_KIND,
  USE_KIND,
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
  evaluateCapabilityChain,
  createUseRequest,
  evaluateUseRequest,
  claimState
};
