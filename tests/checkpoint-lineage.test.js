'use strict';

const assert = require('node:assert/strict');
const {
  generateIdentity,
  envelopeDigest,
  signEnvelope
} = require('../src/trust-core');
const {
  createRevocationCheckpoint
} = require('../src/revocation-checkpoint');
const {
  createCheckpointLink,
  evaluateCheckpointLineage
} = require('../src/checkpoint-lineage');

const root = generateIdentity();
const stranger = generateIdentity();
const nonce = (seed) => Buffer.from(`axm-lineage-${seed}-nonce-material`).toString('base64url');

function checkpoint(identity, seed, completeThrough, issuedAt) {
  return createRevocationCheckpoint(identity, {
    revocations: [],
    completeThrough,
    issuedAt,
    expiresAt: '2026-09-12T14:00:00.000Z',
    nonce: nonce(`checkpoint-${seed}`)
  });
}

const genesisCheckpoint = checkpoint(root, 'genesis', '2026-09-12T09:00:00.000Z', '2026-09-12T09:05:00.000Z');
const genesisLink = createCheckpointLink(root, {
  checkpoint: genesisCheckpoint,
  issuedAt: '2026-09-12T09:06:00.000Z',
  expiresAt: '2026-09-12T14:00:00.000Z',
  nonce: nonce('link-genesis')
});

const successorCheckpoint = checkpoint(root, 'successor', '2026-09-12T10:00:00.000Z', '2026-09-12T10:05:00.000Z');
const successorLink = createCheckpointLink(root, {
  checkpoint: successorCheckpoint,
  previousLink: genesisLink,
  issuedAt: '2026-09-12T10:06:00.000Z',
  expiresAt: '2026-09-12T14:00:00.000Z',
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

test('sequence-zero checkpoint can become a local genesis observation', () => {
  const result = evaluateCheckpointLineage(genesisLink, { checkpoint: genesisCheckpoint, expectedIssuer: root.keyId });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'LINEAGE_GENESIS_ACCEPTABLE');
  assert.match(result.truthBoundary, /local genesis observation only/);
});

test('non-genesis checkpoint without retained history holds instead of inventing continuity', () => {
  const result = evaluateCheckpointLineage(successorLink, { checkpoint: successorCheckpoint, expectedIssuer: root.keyId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HOLD_LINEAGE_HISTORY_REQUIRED');
});

test('exact next signed link advances the retained local head', () => {
  const result = evaluateCheckpointLineage(successorLink, { checkpoint: successorCheckpoint, knownHead: genesisHead, expectedIssuer: root.keyId });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'LINEAGE_ADVANCE_ACCEPTABLE');
  assert.equal(result.sequence, 1);
  assert.match(result.truthBoundary, /exact locally retained predecessor/);
});

test('exact retained checkpoint is recognized without fabricating newer knowledge', () => {
  const result = evaluateCheckpointLineage(successorLink, { checkpoint: successorCheckpoint, knownHead: successorHead, expectedIssuer: root.keyId });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'LINEAGE_HEAD_CURRENT');
  assert.match(result.truthBoundary, /does not prove.*globally newest/);
});

test('older valid checkpoint cannot silently replace a retained newer head', () => {
  const result = evaluateCheckpointLineage(genesisLink, { checkpoint: genesisCheckpoint, knownHead: successorHead, expectedIssuer: root.keyId });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CHECKPOINT_ROLLBACK_DETECTED');
  assert.equal(result.candidateSequence, 0);
  assert.equal(result.retainedSequence, 1);
});

test('conflicting same-sequence signed checkpoint is exposed as a fork', () => {
  const forkCheckpoint = checkpoint(root, 'fork', '2026-09-12T10:01:00.000Z', '2026-09-12T10:07:00.000Z');
  const forkLink = signEnvelope({
    identity: root,
    issuedAt: '2026-09-12T10:08:00.000Z',
    expiresAt: '2026-09-12T14:00:00.000Z',
    nonce: nonce('fork'),
    body: {
      kind: 'revocation-checkpoint-link',
      checkpointId: envelopeDigest(forkCheckpoint),
      previousLinkId: envelopeDigest(genesisLink),
      sequence: 1
    }
  });
  const result = evaluateCheckpointLineage(forkLink, { checkpoint: forkCheckpoint, knownHead: successorHead, expectedIssuer: root.keyId });
  assert.equal(result.code, 'CHECKPOINT_FORK_DETECTED');
});

test('missing intermediate signed links produce an explicit lineage gap', () => {
  const gapCheckpoint = checkpoint(root, 'gap', '2026-09-12T11:00:00.000Z', '2026-09-12T11:05:00.000Z');
  const gapLink = signEnvelope({
    identity: root,
    issuedAt: '2026-09-12T11:06:00.000Z',
    expiresAt: '2026-09-12T14:00:00.000Z',
    nonce: nonce('gap'),
    body: {
      kind: 'revocation-checkpoint-link',
      checkpointId: envelopeDigest(gapCheckpoint),
      previousLinkId: 'a'.repeat(64),
      sequence: 3
    }
  });
  const result = evaluateCheckpointLineage(gapLink, { checkpoint: gapCheckpoint, knownHead: successorHead, expectedIssuer: root.keyId });
  assert.equal(result.code, 'HOLD_LINEAGE_GAP');
});

test('next sequence pointing at a different predecessor is exposed as a fork', () => {
  const wrongParentCheckpoint = checkpoint(root, 'wrong-parent', '2026-09-12T11:00:00.000Z', '2026-09-12T11:05:00.000Z');
  const wrongParentLink = signEnvelope({
    identity: root,
    issuedAt: '2026-09-12T11:06:00.000Z',
    expiresAt: '2026-09-12T14:00:00.000Z',
    nonce: nonce('wrong-parent'),
    body: {
      kind: 'revocation-checkpoint-link',
      checkpointId: envelopeDigest(wrongParentCheckpoint),
      previousLinkId: 'b'.repeat(64),
      sequence: 2
    }
  });
  const result = evaluateCheckpointLineage(wrongParentLink, { checkpoint: wrongParentCheckpoint, knownHead: successorHead, expectedIssuer: root.keyId });
  assert.equal(result.code, 'CHECKPOINT_FORK_DETECTED');
});

test('linked successor cannot move completeThrough backward', () => {
  const regressedCheckpoint = checkpoint(root, 'regressed', '2026-09-12T09:30:00.000Z', '2026-09-12T11:05:00.000Z');
  const regressedLink = createCheckpointLink(root, {
    checkpoint: regressedCheckpoint,
    previousLink: successorLink,
    issuedAt: '2026-09-12T11:06:00.000Z',
    expiresAt: '2026-09-12T14:00:00.000Z',
    nonce: nonce('regressed')
  });
  const result = evaluateCheckpointLineage(regressedLink, { checkpoint: regressedCheckpoint, knownHead: successorHead, expectedIssuer: root.keyId });
  assert.equal(result.code, 'CHECKPOINT_COMPLETENESS_ROLLBACK');
});

test('foreign signer cannot advance another issuer retained lineage', () => {
  const foreignCheckpoint = checkpoint(stranger, 'foreign', '2026-09-12T11:00:00.000Z', '2026-09-12T11:05:00.000Z');
  const foreignLink = createCheckpointLink(stranger, {
    checkpoint: foreignCheckpoint,
    issuedAt: '2026-09-12T11:06:00.000Z',
    expiresAt: '2026-09-12T14:00:00.000Z',
    nonce: nonce('foreign')
  });
  const result = evaluateCheckpointLineage(foreignLink, { checkpoint: foreignCheckpoint, knownHead: successorHead, expectedIssuer: root.keyId });
  assert.equal(result.code, 'CHECKPOINT_LINEAGE_ISSUER_MISMATCH');
});

console.log(`\n${passed} checkpoint-lineage tests passed.`);
