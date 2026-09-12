'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const vector = require('../evidence/interop_vector_v1.json');
const {
  canonicalize,
  keyIdFromPublicKey,
  envelopeDigest,
  verifyEnvelope,
  evaluateCapability
} = require('../src/trust-core');

const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

const { signature, ...unsigned } = vector.envelope;

assert.match(vector.warning, /TEST VECTOR ONLY/);
assert.equal(vector.testOnlySeedHex.length, 64);

const privateKey = crypto.createPrivateKey({
  key: Buffer.from(vector.testOnlyPrivateKeyPkcs8, 'base64url'),
  format: 'der',
  type: 'pkcs8'
});
const derivedPublicKey = crypto.createPublicKey(privateKey).export({ format: 'der', type: 'spki' });
assert.equal(b64url(derivedPublicKey), vector.publicKeySpki, 'fixed seed/private key must derive the published public key');
assert.equal(keyIdFromPublicKey(vector.publicKeySpki), vector.keyId, 'published key id must match the published SPKI key');

const canonicalUnsigned = canonicalize(unsigned);
assert.equal(canonicalUnsigned, vector.canonicalUnsigned, 'canonical unsigned bytes changed');
assert.equal(envelopeDigest(vector.envelope), vector.envelopeDigest, 'envelope digest changed');

const independentlySigned = b64url(crypto.sign(null, Buffer.from(vector.canonicalUnsigned, 'utf8'), privateKey));
assert.equal(independentlySigned, signature, 'Ed25519 signature changed for fixed vector');

const publicKey = crypto.createPublicKey({
  key: Buffer.from(vector.publicKeySpki, 'base64url'),
  format: 'der',
  type: 'spki'
});
assert.equal(
  crypto.verify(null, Buffer.from(vector.canonicalUnsigned, 'utf8'), publicKey, Buffer.from(signature, 'base64url')),
  true,
  'published signature must verify independently of Trust Fabric verifier'
);

const verified = verifyEnvelope(vector.envelope, { nowMs: vector.evaluation.nowMs });
assert.equal(verified.ok, true);
assert.equal(verified.envelopeId, vector.envelopeDigest);
assert.equal(verified.temporalStatus, 'WITHIN_WINDOW');

const evaluated = evaluateCapability(vector.envelope, {
  nowMs: vector.evaluation.nowMs,
  target: vector.evaluation.target,
  action: vector.evaluation.action,
  trustedRootIssuers: new Set(vector.evaluation.trustedRootIssuers)
});
assert.equal(evaluated.grantValid, true);
assert.equal(evaluated.code, vector.evaluation.expectedCode);

console.log('PASS deterministic interoperability vector');
