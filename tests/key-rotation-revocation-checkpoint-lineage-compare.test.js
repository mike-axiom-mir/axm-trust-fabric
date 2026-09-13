'use strict';

const assert = require('node:assert/strict');
const {
  generateIdentity,
  envelopeDigest,
  signEnvelope
} = require('../src/trust-core');
const {
  createKeyRotationRevocationCheckpoint
} = require('../src/key-rotation-revocation-checkpoint');
const {
  createKeyRotationRevocationCheckpointLink
} = require('../src/key-rotation-revocation-checkpoint-lineage');
const {
  compareKeyRotationRevocationCheckpointLineages
} = require('../src/key-rotation-revocation-checkpoint-lineage-compare');

const root = generateIdentity();
const stranger = generateIdentity();
const nonce = (seed) => Buffer.from(`axm-rotation-revocation-lineage-compare-${seed}-nonce-material`).toString('base64url');

function checkpoint(identity, seed, completeThrough, issuedAt) {
  return createKeyRotationRevocationCheckpoint(identity, {
    revocations: [],
    completeThrough,
    issuedAt,
    expiresAt: '2026-09-13T12:00:00.000Z',
    nonce: nonce(`checkpoint-${seed}`)
  });
}

function link(identity, seed, checkpointPacket, previousLink = null, issuedAt) {
  return createKeyRotationRevocationCheckpointLink(identity, {
    checkpoint: checkpointPacket,
    previousLink,
    issuedAt,
    expiresAt: '2026-09-13T12:00:00.000Z',
    nonce: nonce(`link-${seed}`)
  });
}

const genesisCheckpoint = checkpoint(root, 'genesis', '2026-09-13T06:00:00.000Z', '2026-09-13T06:05:00.000Z');
const genesisLink = link(root, 'genesis', genesisCheckpoint, null, '2026-09-13T06:06:00.000Z');
const successorCheckpoint = checkpoint(root, 'successor', '2026-09-13T07:00:00.000Z', '2026-09-13T07:05:00.000Z');
const successorLink = link(root, 'successor', successorCheckpoint, genesisLink, '2026-09-13T07:06:00.000Z');
const thirdCheckpoint = checkpoint(root, 'third', '2026-09-13T08:00:00.000Z', '2026-09-13T08:05:00.000Z');
const thirdLink = link(root, 'third', thirdCheckpoint, successorLink, '2026-09-13T08:06:00.000Z');

const genesis = { checkpoint: genesisCheckpoint, link: genesisLink };
const successor = { checkpoint: successorCheckpoint, link: successorLink };
const third = { checkpoint: thirdCheckpoint, link: thirdLink };
const shortLineage = [genesis, successor];
const longLineage = [genesis, successor, third];

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

test('identical complete rotation-revocation histories compare as identical', () => {
  const result = compareKeyRotationRevocationCheckpointLineages(longLineage, longLineage, {
    expectedPredecessor: root.keyId
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'ROTATION_REVOCATION_LINEAGES_IDENTICAL');
  assert.equal(result.commonAncestor.sequence, 2);
  assert.match(result.truthBoundary, /does not discover unseen checkpoints or revocations/);
});

test('verified exact prefix reports right descendant without global-current claim', () => {
  const result = compareKeyRotationRevocationCheckpointLineages(shortLineage, longLineage, {
    expectedPredecessor: root.keyId
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'ROTATION_REVOCATION_RIGHT_DESCENDS_FROM_LEFT');
  assert.equal(result.descendantSteps, 1);
  assert.equal(result.commonAncestor.linkId, envelopeDigest(successorLink));
  assert.match(result.truthBoundary, /globally newest\/current/);
});

test('verified exact prefix reports left descendant symmetrically', () => {
  const result = compareKeyRotationRevocationCheckpointLineages(longLineage, shortLineage, {
    expectedPredecessor: root.keyId
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'ROTATION_REVOCATION_LEFT_DESCENDS_FROM_RIGHT');
  assert.equal(result.descendantSteps, 1);
});

test('divergent valid histories expose exact common ancestor and first divergent links', () => {
  const forkCheckpoint = checkpoint(root, 'fork', '2026-09-13T08:01:00.000Z', '2026-09-13T08:07:00.000Z');
  const forkLink = link(root, 'fork', forkCheckpoint, successorLink, '2026-09-13T08:08:00.000Z');
  const result = compareKeyRotationRevocationCheckpointLineages(
    longLineage,
    [genesis, successor, { checkpoint: forkCheckpoint, link: forkLink }],
    { expectedPredecessor: root.keyId }
  );
  assert.equal(result.ok, true);
  assert.equal(result.code, 'ROTATION_REVOCATION_LINEAGE_FORK_EVIDENCE');
  assert.equal(result.commonAncestor.sequence, 1);
  assert.equal(result.commonAncestor.linkId, envelopeDigest(successorLink));
  assert.equal(result.leftDivergence.sequence, 2);
  assert.equal(result.rightDivergence.sequence, 2);
  assert.equal('winner' in result, false);
});

test('different valid genesis links are conflict evidence without invented common ancestor', () => {
  const alternateCheckpoint = checkpoint(root, 'alternate-genesis', '2026-09-13T06:01:00.000Z', '2026-09-13T06:07:00.000Z');
  const alternateLink = link(root, 'alternate-genesis', alternateCheckpoint, null, '2026-09-13T06:08:00.000Z');
  const result = compareKeyRotationRevocationCheckpointLineages(
    [genesis],
    [{ checkpoint: alternateCheckpoint, link: alternateLink }],
    { expectedPredecessor: root.keyId }
  );
  assert.equal(result.ok, true);
  assert.equal(result.code, 'ROTATION_REVOCATION_LINEAGE_GENESIS_CONFLICT');
  assert.equal(result.commonAncestor, null);
  assert.equal('winner' in result, false);
});

test('omitted intermediate link fails closed instead of becoming descendant evidence', () => {
  const result = compareKeyRotationRevocationCheckpointLineages(shortLineage, [genesis, third], {
    expectedPredecessor: root.keyId
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_INVALID_ROTATION_REVOCATION_LINEAGE_EVIDENCE');
  assert.equal(result.side, 'right');
  assert.equal(result.index, 1);
  assert.equal(result.cause, 'HOLD_ROTATION_REVOCATION_LINEAGE_GAP');
});

test('exact next sequence with wrong predecessor fails closed before comparison', () => {
  const wrongParentCheckpoint = checkpoint(root, 'wrong-parent', '2026-09-13T08:00:00.000Z', '2026-09-13T08:05:00.000Z');
  const wrongParentLink = signEnvelope({
    identity: root,
    issuedAt: '2026-09-13T08:06:00.000Z',
    expiresAt: '2026-09-13T12:00:00.000Z',
    nonce: nonce('wrong-parent'),
    body: {
      kind: 'key-rotation-revocation-checkpoint-link',
      checkpointId: envelopeDigest(wrongParentCheckpoint),
      previousLinkId: 'b'.repeat(64),
      sequence: 2
    }
  });
  const result = compareKeyRotationRevocationCheckpointLineages(
    shortLineage,
    [genesis, successor, { checkpoint: wrongParentCheckpoint, link: wrongParentLink }],
    { expectedPredecessor: root.keyId }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_INVALID_ROTATION_REVOCATION_LINEAGE_EVIDENCE');
  assert.equal(result.cause, 'ROTATION_REVOCATION_CHECKPOINT_FORK_DETECTED');
});

test('foreign predecessor lineage cannot enter comparison for expected predecessor', () => {
  const foreignCheckpoint = checkpoint(stranger, 'foreign', '2026-09-13T06:00:00.000Z', '2026-09-13T06:05:00.000Z');
  const foreignLink = link(stranger, 'foreign', foreignCheckpoint, null, '2026-09-13T06:06:00.000Z');
  const result = compareKeyRotationRevocationCheckpointLineages(
    [genesis],
    [{ checkpoint: foreignCheckpoint, link: foreignLink }],
    { expectedPredecessor: root.keyId }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_INVALID_ROTATION_REVOCATION_LINEAGE_EVIDENCE');
  assert.equal(result.cause, 'ROTATION_REVOCATION_CHECKPOINT_LINEAGE_ISSUER_MISMATCH');
});

test('completeThrough regression invalidates supplied lineage before relationship classification', () => {
  const regressedCheckpoint = checkpoint(root, 'regressed', '2026-09-13T06:30:00.000Z', '2026-09-13T08:05:00.000Z');
  const regressedLink = link(root, 'regressed', regressedCheckpoint, successorLink, '2026-09-13T08:06:00.000Z');
  const result = compareKeyRotationRevocationCheckpointLineages(
    shortLineage,
    [genesis, successor, { checkpoint: regressedCheckpoint, link: regressedLink }],
    { expectedPredecessor: root.keyId }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_INVALID_ROTATION_REVOCATION_LINEAGE_EVIDENCE');
  assert.equal(result.cause, 'ROTATION_REVOCATION_CHECKPOINT_COMPLETENESS_ROLLBACK');
});

test('comparison requires explicit expected predecessor', () => {
  const result = compareKeyRotationRevocationCheckpointLineages(shortLineage, longLineage);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_EXPECTED_PREDECESSOR_REQUIRED');
});

console.log(`\n${passed} key-rotation revocation checkpoint-lineage-compare tests passed.`);
