'use strict';

const assert = require('node:assert/strict');
const vector = require('../evidence/rotation_revocation_lineage_compare_interop_v1.json');
const { envelopeDigest } = require('../src/trust-core');
const {
  createKeyRotationRevocationCheckpoint
} = require('../src/key-rotation-revocation-checkpoint');
const {
  createKeyRotationRevocationCheckpointLink
} = require('../src/key-rotation-revocation-checkpoint-lineage');
const {
  compareKeyRotationRevocationCheckpointLineages
} = require('../src/key-rotation-revocation-checkpoint-lineage-compare');

const identity = {
  algorithm: 'Ed25519',
  keyId: vector.identity.keyId,
  publicKey: vector.identity.publicKeySpki,
  privateKey: vector.identity.privateKeyPkcs8
};

function buildPackets() {
  const packets = {};
  for (const spec of vector.packetSpecs) {
    const checkpoint = createKeyRotationRevocationCheckpoint(identity, {
      revocations: [],
      completeThrough: spec.checkpoint.completeThrough,
      issuedAt: spec.checkpoint.issuedAt,
      expiresAt: vector.defaults.expiresAt,
      nonce: spec.checkpoint.nonce
    });
    assert.equal(envelopeDigest(checkpoint), spec.checkpoint.expectedDigest, `${spec.name} checkpoint digest drift`);
    assert.equal(checkpoint.signature, spec.checkpoint.expectedSignature, `${spec.name} checkpoint signature drift`);

    const previousLink = spec.link.previous === null ? null : packets[spec.link.previous].link;
    const link = createKeyRotationRevocationCheckpointLink(identity, {
      checkpoint,
      previousLink,
      issuedAt: spec.link.issuedAt,
      expiresAt: vector.defaults.expiresAt,
      nonce: spec.link.nonce
    });
    assert.equal(link.body.sequence, spec.link.sequence, `${spec.name} sequence drift`);
    assert.equal(envelopeDigest(link), spec.link.expectedDigest, `${spec.name} link digest drift`);
    assert.equal(link.signature, spec.link.expectedSignature, `${spec.name} link signature drift`);
    packets[spec.name] = { checkpoint, link };
  }
  return packets;
}

function materializeHistory(packets, name) {
  return vector.histories[name].map((entry) => packets[entry]);
}

function test(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

test('fixed rotation-revocation lineage comparison vector reproduces exact bounded JavaScript relationships', () => {
  const packets = buildPackets();

  for (const comparison of vector.comparisons) {
    const result = compareKeyRotationRevocationCheckpointLineages(
      materializeHistory(packets, comparison.left),
      materializeHistory(packets, comparison.right),
      { expectedPredecessor: vector.identity.keyId }
    );

    assert.equal(result.ok, true, `${comparison.name} must classify supplied replay-valid histories`);
    assert.equal(result.code, comparison.expectedCode, `${comparison.name} code drift`);
    assert.equal(result.relation, comparison.expectedRelation, `${comparison.name} relation drift`);
    assert.equal(result.commonAncestor?.linkId ?? null, comparison.expectedCommonAncestorLinkId, `${comparison.name} ancestor drift`);
    if ('expectedDescendantSteps' in comparison) {
      assert.equal(result.descendantSteps, comparison.expectedDescendantSteps, `${comparison.name} descendant distance drift`);
    }
    if ('expectedLeftDivergenceLinkId' in comparison) {
      assert.equal(result.leftDivergence.linkId, comparison.expectedLeftDivergenceLinkId, `${comparison.name} left divergence drift`);
      assert.equal(result.rightDivergence.linkId, comparison.expectedRightDivergenceLinkId, `${comparison.name} right divergence drift`);
    }
    assert.equal('winner' in result, false, `${comparison.name} must not elect a winner`);
    assert.match(result.truthBoundary, /does not discover unseen checkpoints or revocations/);
    assert.match(result.truthBoundary, /globally newest\/current/);
  }
});
