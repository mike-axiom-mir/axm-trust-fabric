'use strict';

const assert = require('node:assert/strict');
const {
  envelopeDigest,
  generateIdentity,
  signEnvelope
} = require('../src/trust-core');
const {
  createKeyRotationRevocationCheckpoint
} = require('../src/key-rotation-revocation-checkpoint');
const {
  createKeyRotationRevocationCheckpointLink,
  evaluateKeyRotationRevocationCheckpointLineage
} = require('../src/key-rotation-revocation-checkpoint-lineage');
const {
  compareKeyRotationRevocationCheckpointLineages
} = require('../src/key-rotation-revocation-checkpoint-lineage-compare');

const root = generateIdentity();
const stranger = generateIdentity();
const nonce = (seed) => Buffer.from(`axm-rotation-revocation-lineage-${seed}-nonce-material`).toString('base64url');

function checkpoint(identity, seed, completeThrough, issuedAt) {
  return createKeyRotationRevocationCheckpoint(identity, {
    revocations: [],
    completeThrough,
    issuedAt,
    expiresAt: '2026-09-13T06:00:00.000Z',
    nonce: nonce(`checkpoint-${seed}`)
  });
}

const genesisCheckpoint = checkpoint(root, 'genesis', '2026-09-13T01:00:00.000Z', '2026-09-13T01:05:00.000Z');
const genesisLink = createKeyRotationRevocationCheckpointLink(root, {
  checkpoint: genesisCheckpoint,
  issuedAt: '2026-09-13T01:06:00.000Z',
  expiresAt: '2026-09-13T06:00:00.000Z',
  nonce: nonce('link-genesis')
});

const successorCheckpoint = checkpoint(root, 'successor', '2026-09-13T02:00:00.000Z', '2026-09-13T02:05:00.000Z');
const successorLink = createKeyRotationRevocationCheckpointLink(root, {
  checkpoint: successorCheckpoint,
  previousLink: genesisLink,
  issuedAt: '2026-09-13T02:06:00.000Z',
  expiresAt: '2026-09-13T06:00:00.000Z',
  nonce: nonce('link-successor')
});

const genesisHead = { checkpoint: genesisCheckpoint, link: genesisLink };
const successorHead = { checkpoint: successorCheckpoint, link: successorLink };

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

test('sequence-zero rotation-revocation checkpoint can become a local genesis observation', () => {
  const result = evaluateKeyRotationRevocationCheckpointLineage(genesisLink, {
    checkpoint: genesisCheckpoint,
    expectedPredecessor: root.keyId
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'ROTATION_REVOCATION_LINEAGE_GENESIS_ACCEPTABLE');
  assert.match(result.truthBoundary, /local rotation-revocation checkpoint genesis observation/);
  assert.match(result.truthBoundary, /does not prove no earlier or newer checkpoint exists elsewhere/);
});

test('non-genesis rotation-revocation checkpoint without retained history holds', () => {
  const result = evaluateKeyRotationRevocationCheckpointLineage(successorLink, {
    checkpoint: successorCheckpoint,
    expectedPredecessor: root.keyId
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_ROTATION_REVOCATION_LINEAGE_HISTORY_REQUIRED');
});

test('exact direct signed successor advances the retained local head', () => {
  const result = evaluateKeyRotationRevocationCheckpointLineage(successorLink, {
    checkpoint: successorCheckpoint,
    knownHead: genesisHead,
    expectedPredecessor: root.keyId
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'ROTATION_REVOCATION_LINEAGE_ADVANCE_ACCEPTABLE');
  assert.equal(result.sequence, 1);
  assert.match(result.truthBoundary, /exact locally retained predecessor checkpoint\/link/);
  assert.match(result.truthBoundary, /does not discover newer unseen checkpoints/);
  assert.match(result.truthBoundary, /does not.*resolve forks/);
});

test('exact retained rotation-revocation checkpoint head is recognized without global-newest claim', () => {
  const result = evaluateKeyRotationRevocationCheckpointLineage(successorLink, {
    checkpoint: successorCheckpoint,
    knownHead: successorHead,
    expectedPredecessor: root.keyId
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'ROTATION_REVOCATION_LINEAGE_HEAD_CURRENT');
  assert.match(result.truthBoundary, /does not prove.*globally newest or globally fresh/);
});

test('older valid rotation-revocation checkpoint cannot silently replace retained newer head', () => {
  const result = evaluateKeyRotationRevocationCheckpointLineage(genesisLink, {
    checkpoint: genesisCheckpoint,
    knownHead: successorHead,
    expectedPredecessor: root.keyId
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ROTATION_REVOCATION_CHECKPOINT_ROLLBACK_DETECTED');
  assert.equal(result.candidateSequence, 0);
  assert.equal(result.retainedSequence, 1);
});

test('conflicting same-sequence signed rotation-revocation checkpoint is exposed as a fork', () => {
  const forkCheckpoint = checkpoint(root, 'fork', '2026-09-13T02:01:00.000Z', '2026-09-13T02:07:00.000Z');
  const forkLink = signEnvelope({
    identity: root,
    issuedAt: '2026-09-13T02:08:00.000Z',
    expiresAt: '2026-09-13T06:00:00.000Z',
    nonce: nonce('fork'),
    body: {
      kind: 'key-rotation-revocation-checkpoint-link',
      checkpointId: envelopeDigest(forkCheckpoint),
      previousLinkId: envelopeDigest(genesisLink),
      sequence: 1
    }
  });
  const result = evaluateKeyRotationRevocationCheckpointLineage(forkLink, {
    checkpoint: forkCheckpoint,
    knownHead: successorHead,
    expectedPredecessor: root.keyId
  });
  assert.equal(result.code, 'ROTATION_REVOCATION_CHECKPOINT_FORK_DETECTED');
});

test('missing intermediate rotation-revocation checkpoint links produce an explicit gap', () => {
  const gapCheckpoint = checkpoint(root, 'gap', '2026-09-13T03:00:00.000Z', '2026-09-13T03:05:00.000Z');
  const gapLink = signEnvelope({
    identity: root,
    issuedAt: '2026-09-13T03:06:00.000Z',
    expiresAt: '2026-09-13T06:00:00.000Z',
    nonce: nonce('gap'),
    body: {
      kind: 'key-rotation-revocation-checkpoint-link',
      checkpointId: envelopeDigest(gapCheckpoint),
      previousLinkId: 'a'.repeat(64),
      sequence: 3
    }
  });
  const result = evaluateKeyRotationRevocationCheckpointLineage(gapLink, {
    checkpoint: gapCheckpoint,
    knownHead: successorHead,
    expectedPredecessor: root.keyId
  });
  assert.equal(result.code, 'HOLD_ROTATION_REVOCATION_LINEAGE_GAP');
});

test('direct successor pointing at a different predecessor is exposed as a fork', () => {
  const wrongParentCheckpoint = checkpoint(root, 'wrong-parent', '2026-09-13T03:00:00.000Z', '2026-09-13T03:05:00.000Z');
  const wrongParentLink = signEnvelope({
    identity: root,
    issuedAt: '2026-09-13T03:06:00.000Z',
    expiresAt: '2026-09-13T06:00:00.000Z',
    nonce: nonce('wrong-parent'),
    body: {
      kind: 'key-rotation-revocation-checkpoint-link',
      checkpointId: envelopeDigest(wrongParentCheckpoint),
      previousLinkId: 'b'.repeat(64),
      sequence: 2
    }
  });
  const result = evaluateKeyRotationRevocationCheckpointLineage(wrongParentLink, {
    checkpoint: wrongParentCheckpoint,
    knownHead: successorHead,
    expectedPredecessor: root.keyId
  });
  assert.equal(result.code, 'ROTATION_REVOCATION_CHECKPOINT_FORK_DETECTED');
});

test('linked successor cannot move rotation-revocation completeThrough backward', () => {
  const regressedCheckpoint = checkpoint(root, 'regressed', '2026-09-13T01:30:00.000Z', '2026-09-13T03:05:00.000Z');
  const regressedLink = createKeyRotationRevocationCheckpointLink(root, {
    checkpoint: regressedCheckpoint,
    previousLink: successorLink,
    issuedAt: '2026-09-13T03:06:00.000Z',
    expiresAt: '2026-09-13T06:00:00.000Z',
    nonce: nonce('regressed')
  });
  const result = evaluateKeyRotationRevocationCheckpointLineage(regressedLink, {
    checkpoint: regressedCheckpoint,
    knownHead: successorHead,
    expectedPredecessor: root.keyId
  });
  assert.equal(result.code, 'ROTATION_REVOCATION_CHECKPOINT_COMPLETENESS_ROLLBACK');
});

test('authority, exact-binding, and complete-history comparison boundaries fail closed without rewriting retained history', () => {
  const foreignCheckpoint = checkpoint(stranger, 'foreign', '2026-09-13T03:00:00.000Z', '2026-09-13T03:05:00.000Z');
  const foreignLink = createKeyRotationRevocationCheckpointLink(stranger, {
    checkpoint: foreignCheckpoint,
    issuedAt: '2026-09-13T03:06:00.000Z',
    expiresAt: '2026-09-13T06:00:00.000Z',
    nonce: nonce('foreign')
  });
  const foreignResult = evaluateKeyRotationRevocationCheckpointLineage(foreignLink, {
    checkpoint: foreignCheckpoint,
    knownHead: successorHead,
    expectedPredecessor: root.keyId
  });
  assert.equal(foreignResult.code, 'ROTATION_REVOCATION_CHECKPOINT_LINEAGE_ISSUER_MISMATCH');

  const candidateCheckpoint = checkpoint(root, 'candidate', '2026-09-13T03:00:00.000Z', '2026-09-13T03:05:00.000Z');
  const wrongBindingLink = signEnvelope({
    identity: root,
    issuedAt: '2026-09-13T03:06:00.000Z',
    expiresAt: '2026-09-13T06:00:00.000Z',
    nonce: nonce('wrong-binding'),
    body: {
      kind: 'key-rotation-revocation-checkpoint-link',
      checkpointId: 'c'.repeat(64),
      previousLinkId: envelopeDigest(successorLink),
      sequence: 2
    }
  });
  const wrongBindingResult = evaluateKeyRotationRevocationCheckpointLineage(wrongBindingLink, {
    checkpoint: candidateCheckpoint,
    knownHead: successorHead,
    expectedPredecessor: root.keyId
  });
  assert.equal(wrongBindingResult.code, 'ROTATION_REVOCATION_CHECKPOINT_LINK_BINDING_MISMATCH');

  const earlyLink = signEnvelope({
    identity: root,
    issuedAt: '2026-09-13T03:04:00.000Z',
    expiresAt: '2026-09-13T06:00:00.000Z',
    nonce: nonce('early-link'),
    body: {
      kind: 'key-rotation-revocation-checkpoint-link',
      checkpointId: envelopeDigest(candidateCheckpoint),
      previousLinkId: envelopeDigest(successorLink),
      sequence: 2
    }
  });
  const earlyResult = evaluateKeyRotationRevocationCheckpointLineage(earlyLink, {
    checkpoint: candidateCheckpoint,
    knownHead: successorHead,
    expectedPredecessor: root.keyId
  });
  assert.equal(earlyResult.code, 'ROTATION_REVOCATION_CHECKPOINT_LINK_BEFORE_CHECKPOINT');

  const thirdCheckpoint = checkpoint(root, 'compare-third', '2026-09-13T04:00:00.000Z', '2026-09-13T04:05:00.000Z');
  const thirdLink = createKeyRotationRevocationCheckpointLink(root, {
    checkpoint: thirdCheckpoint,
    previousLink: successorLink,
    issuedAt: '2026-09-13T04:06:00.000Z',
    expiresAt: '2026-09-13T06:00:00.000Z',
    nonce: nonce('compare-third')
  });
  const shortLineage = [genesisHead, successorHead];
  const longLineage = [genesisHead, successorHead, { checkpoint: thirdCheckpoint, link: thirdLink }];

  const identical = compareKeyRotationRevocationCheckpointLineages(longLineage, longLineage, {
    expectedPredecessor: root.keyId
  });
  assert.equal(identical.code, 'ROTATION_REVOCATION_LINEAGES_IDENTICAL');
  assert.match(identical.truthBoundary, /does not discover unseen checkpoints or revocations/);

  const descendant = compareKeyRotationRevocationCheckpointLineages(shortLineage, longLineage, {
    expectedPredecessor: root.keyId
  });
  assert.equal(descendant.code, 'ROTATION_REVOCATION_RIGHT_DESCENDS_FROM_LEFT');
  assert.equal(descendant.descendantSteps, 1);
  assert.match(descendant.truthBoundary, /globally newest\/current/);

  const compareForkCheckpoint = checkpoint(root, 'compare-fork', '2026-09-13T04:01:00.000Z', '2026-09-13T04:07:00.000Z');
  const compareForkLink = createKeyRotationRevocationCheckpointLink(root, {
    checkpoint: compareForkCheckpoint,
    previousLink: successorLink,
    issuedAt: '2026-09-13T04:08:00.000Z',
    expiresAt: '2026-09-13T06:00:00.000Z',
    nonce: nonce('compare-fork')
  });
  const fork = compareKeyRotationRevocationCheckpointLineages(
    longLineage,
    [genesisHead, successorHead, { checkpoint: compareForkCheckpoint, link: compareForkLink }],
    { expectedPredecessor: root.keyId }
  );
  assert.equal(fork.code, 'ROTATION_REVOCATION_LINEAGE_FORK_EVIDENCE');
  assert.equal(fork.commonAncestor.linkId, envelopeDigest(successorLink));
  assert.equal('winner' in fork, false);

  const alternateGenesisCheckpoint = checkpoint(root, 'compare-alternate-genesis', '2026-09-13T01:01:00.000Z', '2026-09-13T01:07:00.000Z');
  const alternateGenesisLink = createKeyRotationRevocationCheckpointLink(root, {
    checkpoint: alternateGenesisCheckpoint,
    issuedAt: '2026-09-13T01:08:00.000Z',
    expiresAt: '2026-09-13T06:00:00.000Z',
    nonce: nonce('compare-alternate-genesis')
  });
  const genesisConflict = compareKeyRotationRevocationCheckpointLineages(
    [genesisHead],
    [{ checkpoint: alternateGenesisCheckpoint, link: alternateGenesisLink }],
    { expectedPredecessor: root.keyId }
  );
  assert.equal(genesisConflict.code, 'ROTATION_REVOCATION_LINEAGE_GENESIS_CONFLICT');
  assert.equal(genesisConflict.commonAncestor, null);

  const omittedIntermediate = compareKeyRotationRevocationCheckpointLineages(
    shortLineage,
    [genesisHead, { checkpoint: thirdCheckpoint, link: thirdLink }],
    { expectedPredecessor: root.keyId }
  );
  assert.equal(omittedIntermediate.code, 'HOLD_INVALID_ROTATION_REVOCATION_LINEAGE_EVIDENCE');
  assert.equal(omittedIntermediate.cause, 'HOLD_ROTATION_REVOCATION_LINEAGE_GAP');

  const foreignComparison = compareKeyRotationRevocationCheckpointLineages(
    [genesisHead],
    [{ checkpoint: foreignCheckpoint, link: foreignLink }],
    { expectedPredecessor: root.keyId }
  );
  assert.equal(foreignComparison.code, 'HOLD_INVALID_ROTATION_REVOCATION_LINEAGE_EVIDENCE');
  assert.equal(foreignComparison.cause, 'ROTATION_REVOCATION_CHECKPOINT_LINEAGE_ISSUER_MISMATCH');

  const missingExpectedPredecessor = compareKeyRotationRevocationCheckpointLineages(shortLineage, longLineage);
  assert.equal(missingExpectedPredecessor.code, 'HOLD_EXPECTED_PREDECESSOR_REQUIRED');

  assert.equal(envelopeDigest(successorHead.checkpoint), envelopeDigest(successorCheckpoint));
  assert.equal(envelopeDigest(successorHead.link), envelopeDigest(successorLink));
});

console.log(`\n${passed} key-rotation revocation checkpoint-lineage tests passed.`);
