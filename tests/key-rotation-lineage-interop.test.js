'use strict';

const assert = require('node:assert/strict');
const vector = require('../evidence/two_hop_rotation_lineage_interop_v1.json');
const { envelopeDigest } = require('../src/trust-core');
const { evaluateTwoHopKeyRotationLineage } = require('../src/key-rotation-lineage');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

test('published two-hop lineage interoperability vector matches the JavaScript reference path exactly', () => {
  const result = evaluateTwoHopKeyRotationLineage(
    vector.evidence.rotations,
    vector.evidence.acknowledgements,
    {
      nowMs: vector.evaluation.nowMs,
      expectedOrigin: vector.evaluation.expectedOrigin,
      domain: vector.evaluation.domain
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.code, vector.evaluation.expectedCode);
  assert.equal(result.originKeyId, vector.evaluation.expectedOrigin);
  assert.equal(result.intermediateKeyId, vector.evaluation.expectedIntermediate);
  assert.equal(result.terminalKeyId, vector.evaluation.expectedTerminal);
  assert.equal(result.validUntil, vector.evaluation.expectedValidUntil);
  assert.equal(envelopeDigest(vector.evidence.rotations[0]), vector.digests.rotationAB);
  assert.equal(envelopeDigest(vector.evidence.acknowledgements[0]), vector.digests.ackAB);
  assert.equal(envelopeDigest(vector.evidence.rotations[1]), vector.digests.rotationBC);
  assert.equal(envelopeDigest(vector.evidence.acknowledgements[1]), vector.digests.ackBC);
  assert.equal(result.rotations[0].rotationId, vector.digests.rotationAB);
  assert.equal(result.rotations[0].acknowledgementId, vector.digests.ackAB);
  assert.equal(result.rotations[1].rotationId, vector.digests.rotationBC);
  assert.equal(result.rotations[1].acknowledgementId, vector.digests.ackBC);
  assert.equal(result.authority, undefined);
  assert.equal(result.winner, undefined);
});

console.log(`\n${passed} two-hop lineage interoperability reference test passed.`);
