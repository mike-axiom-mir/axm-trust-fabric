'use strict';

const assert = require('node:assert/strict');
const {
  generateIdentity,
  envelopeDigest,
  signEnvelope
} = require('../src/trust-core');
const { createRevocationCheckpoint } = require('../src/revocation-checkpoint');
const { createCheckpointLink } = require('../src/checkpoint-lineage');
const { compareCheckpointLineages } = require('../src/checkpoint-lineage-compare');

const root = generateIdentity();
const stranger = generateIdentity();
const nonce = (seed) => Buffer.from(`axm-lineage-compare-${seed}-nonce-material`).toString('base64url');

function checkpoint(identity, seed, completeThrough, issuedAt) {
  return createRevocationCheckpoint(identity, {
    revocations: [],
    completeThrough,
    issuedAt,
    expiresAt: '2026-09-12T20:00:00.000Z',
    nonce: nonce(`checkpoint-${seed}`)
  });
}

function link(identity, seed, checkpointPacket, previousLink = null, issuedAt) {
  return createCheckpointLink(identity, {
    checkpoint: checkpointPacket,
    previousLink,
    issuedAt,
    expiresAt: '2026-09-12T20:00:00.000Z',
    nonce: nonce(`link-${seed}`)
  });
}

const genesisCheckpoint = checkpoint(root, 'genesis', '2026-09-12T09:00:00.000Z', '2026-09-12T09:05:00.000Z');
const genesisLink = link(root, 'genesis', genesisCheckpoint, null, '2026-09-12T09:06:00.000Z');
const successorCheckpoint = checkpoint(root, 'successor', '2026-09-12T10:00:00.000Z', '2026-09-12T10:05:00.000Z');
const successorLink = link(root, 'successor', successorCheckpoint, genesisLink, '2026-09-12T10:06:00.000Z');
const thirdCheckpoint = checkpoint(root, 'third', '2026-09-12T11:00:00.000Z', '2026-09-12T11:05:00.000Z');
const thirdLink = link(root, 'third', thirdCheckpoint, successorLink, '2026-09-12T11:06:00.000Z');

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

test('identical complete signed histories compare as identical', () => {
  const result = compareCheckpointLineages(longLineage, longLineage, { expectedIssuer: root.keyId });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'LINEAGES_IDENTICAL');
  assert.equal(result.commonAncestor.sequence, 2);
  assert.match(result.truthBoundary, /does not discover unseen lineages/);
});

test('verified exact prefix reports right descendant without global newest claim', () => {
  const result = compareCheckpointLineages(shortLineage, longLineage, { expectedIssuer: root.keyId });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'RIGHT_DESCENDS_FROM_LEFT');
  assert.equal(result.descendantSteps, 1);
  assert.equal(result.commonAncestor.linkId, envelopeDigest(successorLink));
  assert.match(result.truthBoundary, /globally newest/);
});

test('verified exact prefix reports left descendant symmetrically', () => {
  const result = compareCheckpointLineages(longLineage, shortLineage, { expectedIssuer: root.keyId });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'LEFT_DESCENDS_FROM_RIGHT');
  assert.equal(result.descendantSteps, 1);
});

test('divergent valid histories expose exact common ancestor and first divergent links', () => {
  const forkCheckpoint = checkpoint(root, 'fork', '2026-09-12T11:01:00.000Z', '2026-09-12T11:07:00.000Z');
  const forkLink = link(root, 'fork', forkCheckpoint, successorLink, '2026-09-12T11:08:00.000Z');
  const result = compareCheckpointLineages(longLineage, [genesis, successor, { checkpoint: forkCheckpoint, link: forkLink }], { expectedIssuer: root.keyId });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'LINEAGE_FORK_EVIDENCE');
  assert.equal(result.commonAncestor.sequence, 1);
  assert.equal(result.commonAncestor.linkId, envelopeDigest(successorLink));
  assert.equal(result.leftDivergence.sequence, 2);
  assert.equal(result.rightDivergence.sequence, 2);
  assert.equal('winner' in result, false);
});

test('different valid genesis links are conflict evidence without invented common ancestor', () => {
  const alternateCheckpoint = checkpoint(root, 'alternate-genesis', '2026-09-12T09:01:00.000Z', '2026-09-12T09:07:00.000Z');
  const alternateLink = link(root, 'alternate-genesis', alternateCheckpoint, null, '2026-09-12T09:08:00.000Z');
  const result = compareCheckpointLineages([genesis], [{ checkpoint: alternateCheckpoint, link: alternateLink }], { expectedIssuer: root.keyId });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'LINEAGE_GENESIS_CONFLICT');
  assert.equal(result.commonAncestor, null);
  assert.equal('winner' in result, false);
});

test('omitted intermediate link fails closed instead of becoming descendant evidence', () => {
  const result = compareCheckpointLineages(shortLineage, [genesis, third], { expectedIssuer: root.keyId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_INVALID_LINEAGE_EVIDENCE');
  assert.equal(result.side, 'right');
  assert.equal(result.index, 1);
  assert.equal(result.cause, 'HOLD_LINEAGE_GAP');
});

test('exact next sequence with wrong predecessor fails closed before comparison', () => {
  const wrongParentCheckpoint = checkpoint(root, 'wrong-parent', '2026-09-12T11:00:00.000Z', '2026-09-12T11:05:00.000Z');
  const wrongParentLink = signEnvelope({
    identity: root,
    issuedAt: '2026-09-12T11:06:00.000Z',
    expiresAt: '2026-09-12T20:00:00.000Z',
    nonce: nonce('wrong-parent'),
    body: {
      kind: 'revocation-checkpoint-link',
      checkpointId: envelopeDigest(wrongParentCheckpoint),
      previousLinkId: 'b'.repeat(64),
      sequence: 2
    }
  });
  const result = compareCheckpointLineages(shortLineage, [genesis, successor, { checkpoint: wrongParentCheckpoint, link: wrongParentLink }], { expectedIssuer: root.keyId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_INVALID_LINEAGE_EVIDENCE');
  assert.equal(result.cause, 'CHECKPOINT_FORK_DETECTED');
});

test('foreign issuer lineage cannot enter comparison for expected issuer', () => {
  const foreignCheckpoint = checkpoint(stranger, 'foreign', '2026-09-12T09:00:00.000Z', '2026-09-12T09:05:00.000Z');
  const foreignLink = link(stranger, 'foreign', foreignCheckpoint, null, '2026-09-12T09:06:00.000Z');
  const result = compareCheckpointLineages([genesis], [{ checkpoint: foreignCheckpoint, link: foreignLink }], { expectedIssuer: root.keyId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_INVALID_LINEAGE_EVIDENCE');
  assert.equal(result.cause, 'CHECKPOINT_LINEAGE_ISSUER_MISMATCH');
});

test('completeThrough regression invalidates supplied lineage before relationship classification', () => {
  const regressedCheckpoint = checkpoint(root, 'regressed', '2026-09-12T09:30:00.000Z', '2026-09-12T11:05:00.000Z');
  const regressedLink = link(root, 'regressed', regressedCheckpoint, successorLink, '2026-09-12T11:06:00.000Z');
  const result = compareCheckpointLineages(shortLineage, [genesis, successor, { checkpoint: regressedCheckpoint, link: regressedLink }], { expectedIssuer: root.keyId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_INVALID_LINEAGE_EVIDENCE');
  assert.equal(result.cause, 'CHECKPOINT_COMPLETENESS_ROLLBACK');
});

test('comparison requires explicit expected issuer', () => {
  const result = compareCheckpointLineages(shortLineage, longLineage);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_EXPECTED_ISSUER_REQUIRED');
});

console.log(`\n${passed} checkpoint-lineage-compare tests passed.`);
