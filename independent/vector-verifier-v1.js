'use strict';

const crypto = require('node:crypto');

const ENVELOPE_VERSION = 'axm.trust-envelope/v1';
const CAPABILITY_KIND = 'capability-grant';
const KEY_ID_PREFIX = 'axm:key:ed25519:';

class IndependentVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'IndependentVerificationError';
    this.code = code;
  }
}

function failUnless(condition, code, message) {
  if (!condition) throw new IndependentVerificationError(code, message);
}

function decodeBase64url(text, code) {
  failUnless(typeof text === 'string' && /^[A-Za-z0-9_-]+$/.test(text), code, 'Expected unpadded base64url text.');
  const bytes = Buffer.from(text, 'base64url');
  failUnless(bytes.toString('base64url') === text, code, 'Base64url text is not canonical.');
  return bytes;
}

function canonicalJson(value) {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'number':
      failUnless(Number.isSafeInteger(value), 'NON_CANONICAL_NUMBER', 'Only safe integers are canonical in v1.');
      return `${value}`;
    case 'object':
      break;
    default:
      throw new IndependentVerificationError('UNSUPPORTED_CANONICAL_TYPE', 'Unsupported canonical JSON value.');
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  const prototype = Object.getPrototypeOf(value);
  failUnless(prototype === Object.prototype || prototype === null, 'NON_PLAIN_OBJECT', 'Only plain objects are canonical.');

  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  for (const [, entryValue] of entries) {
    failUnless(entryValue !== undefined, 'UNDEFINED_VALUE', 'Undefined values are not canonical.');
  }

  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`).join(',')}}`;
}

function unsignedEnvelope(envelope) {
  const result = {};
  for (const [key, value] of Object.entries(envelope)) {
    if (key !== 'signature') result[key] = value;
  }
  return result;
}

function keyIdFromSpki(publicKeySpki) {
  const der = decodeBase64url(publicKeySpki, 'INVALID_PUBLIC_KEY');
  return `${KEY_ID_PREFIX}${crypto.createHash('sha256').update(der).digest('hex')}`;
}

function digestUnsignedEnvelope(envelope) {
  return crypto.createHash('sha256').update(canonicalJson(unsignedEnvelope(envelope)), 'utf8').digest('hex');
}

function parseCanonicalTime(text, field) {
  failUnless(typeof text === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text), 'INVALID_TIME', `${field} is not canonical UTC milliseconds.`);
  const milliseconds = Date.parse(text);
  failUnless(Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === text, 'INVALID_TIME', `${field} is invalid.`);
  return milliseconds;
}

function inspectEnvelope(envelope, context = {}) {
  try {
    failUnless(envelope && typeof envelope === 'object' && !Array.isArray(envelope), 'INVALID_ENVELOPE', 'Envelope must be an object.');
    failUnless(envelope.version === ENVELOPE_VERSION, 'UNSUPPORTED_VERSION', 'Unsupported envelope version.');
    failUnless(envelope.body && typeof envelope.body === 'object' && !Array.isArray(envelope.body), 'INVALID_BODY', 'Envelope body must be an object.');

    const derivedKeyId = keyIdFromSpki(envelope.publicKey);
    failUnless(envelope.issuer === derivedKeyId, 'ISSUER_KEY_MISMATCH', 'Issuer does not match the embedded public key.');

    const publicKey = crypto.createPublicKey({
      key: decodeBase64url(envelope.publicKey, 'INVALID_PUBLIC_KEY'),
      format: 'der',
      type: 'spki'
    });
    failUnless(publicKey.asymmetricKeyType === 'ed25519', 'INVALID_PUBLIC_KEY', 'Expected an Ed25519 public key.');

    const canonicalUnsigned = canonicalJson(unsignedEnvelope(envelope));
    const envelopeDigest = crypto.createHash('sha256').update(canonicalUnsigned, 'utf8').digest('hex');
    const signatureBytes = decodeBase64url(envelope.signature, 'INVALID_SIGNATURE');
    const signatureValid = crypto.verify(null, Buffer.from(canonicalUnsigned, 'utf8'), publicKey, signatureBytes);

    if (!signatureValid) {
      return { ok: false, code: 'INVALID_SIGNATURE', signatureValid, derivedKeyId, canonicalUnsigned, envelopeDigest };
    }

    const issuedMs = parseCanonicalTime(envelope.issuedAt, 'issuedAt');
    const expiresMs = parseCanonicalTime(envelope.expiresAt, 'expiresAt');
    failUnless(expiresMs > issuedMs, 'INVALID_TIME_WINDOW', 'expiresAt must be later than issuedAt.');

    if (!Number.isFinite(context.nowMs)) {
      return { ok: false, code: 'HOLD_CLOCK_UNKNOWN', signatureValid, derivedKeyId, canonicalUnsigned, envelopeDigest };
    }
    if (context.nowMs < issuedMs) {
      return { ok: false, code: 'NOT_YET_VALID', signatureValid, derivedKeyId, canonicalUnsigned, envelopeDigest };
    }
    if (context.nowMs >= expiresMs) {
      return { ok: false, code: 'EXPIRED', signatureValid, derivedKeyId, canonicalUnsigned, envelopeDigest };
    }

    const trustedRoots = context.trustedRootIssuers instanceof Set
      ? context.trustedRootIssuers
      : new Set(context.trustedRootIssuers || []);
    if (!trustedRoots.has(envelope.issuer)) {
      return { ok: false, code: 'UNTRUSTED_ROOT_ISSUER', signatureValid, derivedKeyId, canonicalUnsigned, envelopeDigest };
    }

    const body = envelope.body;
    failUnless(body.kind === CAPABILITY_KIND, 'INVALID_CAPABILITY_KIND', 'Vector body is not a capability grant.');
    failUnless(body.parentCapabilityId === null, 'HOLD_PARENT_CHAIN_REQUIRED', 'Independent vector verifier only evaluates root capability fixtures.');
    failUnless(typeof body.target === 'string' && Array.isArray(body.actions), 'INVALID_CAPABILITY', 'Malformed capability fixture.');

    if (context.target !== body.target) {
      return { ok: false, code: 'WRONG_TARGET', signatureValid, derivedKeyId, canonicalUnsigned, envelopeDigest };
    }
    if (!body.actions.includes(context.action)) {
      return { ok: false, code: 'WRONG_ACTION', signatureValid, derivedKeyId, canonicalUnsigned, envelopeDigest };
    }

    return {
      ok: true,
      code: 'GRANT_VALID_FOR_SCOPE',
      signatureValid,
      derivedKeyId,
      canonicalUnsigned,
      envelopeDigest,
      subject: body.subject
    };
  } catch (error) {
    if (error instanceof IndependentVerificationError) {
      return { ok: false, code: error.code, message: error.message, signatureValid: false };
    }
    return { ok: false, code: 'INVALID_CRYPTO_MATERIAL', message: error.message, signatureValid: false };
  }
}

module.exports = {
  canonicalJson,
  keyIdFromSpki,
  digestUnsignedEnvelope,
  inspectEnvelope
};