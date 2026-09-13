'use strict';

const { envelopeDigest } = require('./trust-core');
const {
  evaluateKeyRotationRevocationCheckpointLineage
} = require('./key-rotation-revocation-checkpoint-lineage');

const TRUTH_BOUNDARY = 'Compares only the two supplied complete signed rotation-revocation checkpoint histories; does not discover unseen checkpoints or revocations, prove a globally newest/current head, synchronize peers, resolve consensus, or choose a winning fork.';

function invalidEvidence(side, index, cause) {
  return {
    ok: false,
    code: 'HOLD_INVALID_ROTATION_REVOCATION_LINEAGE_EVIDENCE',
    side,
    index,
    cause,
    truthBoundary: TRUTH_BOUNDARY
  };
}

function validateCompleteLineage(lineage, expectedPredecessor, side) {
  if (typeof expectedPredecessor !== 'string' || expectedPredecessor.length === 0) {
    return {
      ok: false,
      code: 'HOLD_EXPECTED_PREDECESSOR_REQUIRED',
      side,
      truthBoundary: TRUTH_BOUNDARY
    };
  }
  if (!Array.isArray(lineage) || lineage.length === 0) {
    return invalidEvidence(side, 0, 'HOLD_ROTATION_REVOCATION_LINEAGE_HISTORY_REQUIRED');
  }

  const linkIds = [];
  const checkpointIds = [];
  let knownHead = null;

  for (let index = 0; index < lineage.length; index += 1) {
    const entry = lineage[index];
    if (!entry || typeof entry !== 'object' || !entry.link || !entry.checkpoint) {
      return invalidEvidence(side, index, 'INVALID_ROTATION_REVOCATION_LINEAGE_ENTRY');
    }

    const result = evaluateKeyRotationRevocationCheckpointLineage(entry.link, {
      checkpoint: entry.checkpoint,
      knownHead,
      expectedPredecessor
    });
    const expectedCode = index === 0
      ? 'ROTATION_REVOCATION_LINEAGE_GENESIS_ACCEPTABLE'
      : 'ROTATION_REVOCATION_LINEAGE_ADVANCE_ACCEPTABLE';
    if (!result.ok || result.code !== expectedCode) {
      return invalidEvidence(side, index, result.code);
    }

    linkIds.push(envelopeDigest(entry.link));
    checkpointIds.push(envelopeDigest(entry.checkpoint));
    knownHead = entry;
  }

  return {
    ok: true,
    linkIds,
    checkpointIds,
    length: lineage.length,
    headLinkId: linkIds[linkIds.length - 1],
    headCheckpointId: checkpointIds[checkpointIds.length - 1]
  };
}

function ancestorEvidence(lineage, validated, index) {
  if (index < 0) return null;
  return {
    sequence: index,
    linkId: validated.linkIds[index],
    checkpointId: validated.checkpointIds[index],
    completeThrough: lineage[index].checkpoint.body.completeThrough
  };
}

function divergenceEvidence(lineage, validated, index) {
  return {
    sequence: index,
    linkId: validated.linkIds[index],
    checkpointId: validated.checkpointIds[index],
    previousLinkId: lineage[index].link.body.previousLinkId,
    completeThrough: lineage[index].checkpoint.body.completeThrough
  };
}

function compareKeyRotationRevocationCheckpointLineages(left, right, { expectedPredecessor } = {}) {
  if (typeof expectedPredecessor !== 'string' || expectedPredecessor.length === 0) {
    return {
      ok: false,
      code: 'HOLD_EXPECTED_PREDECESSOR_REQUIRED',
      truthBoundary: TRUTH_BOUNDARY
    };
  }

  const leftValidated = validateCompleteLineage(left, expectedPredecessor, 'left');
  if (!leftValidated.ok) return leftValidated;
  const rightValidated = validateCompleteLineage(right, expectedPredecessor, 'right');
  if (!rightValidated.ok) return rightValidated;

  const commonLimit = Math.min(leftValidated.length, rightValidated.length);
  let commonLength = 0;
  while (
    commonLength < commonLimit &&
    leftValidated.linkIds[commonLength] === rightValidated.linkIds[commonLength]
  ) {
    commonLength += 1;
  }

  const commonAncestor = ancestorEvidence(left, leftValidated, commonLength - 1);

  if (commonLength === leftValidated.length && commonLength === rightValidated.length) {
    return {
      ok: true,
      code: 'ROTATION_REVOCATION_LINEAGES_IDENTICAL',
      relation: 'identical',
      commonAncestor,
      leftHeadLinkId: leftValidated.headLinkId,
      rightHeadLinkId: rightValidated.headLinkId,
      truthBoundary: TRUTH_BOUNDARY
    };
  }

  if (commonLength === leftValidated.length) {
    return {
      ok: true,
      code: 'ROTATION_REVOCATION_RIGHT_DESCENDS_FROM_LEFT',
      relation: 'right-descends-from-left',
      commonAncestor,
      descendantSteps: rightValidated.length - leftValidated.length,
      leftHeadLinkId: leftValidated.headLinkId,
      rightHeadLinkId: rightValidated.headLinkId,
      truthBoundary: TRUTH_BOUNDARY
    };
  }

  if (commonLength === rightValidated.length) {
    return {
      ok: true,
      code: 'ROTATION_REVOCATION_LEFT_DESCENDS_FROM_RIGHT',
      relation: 'left-descends-from-right',
      commonAncestor,
      descendantSteps: leftValidated.length - rightValidated.length,
      leftHeadLinkId: leftValidated.headLinkId,
      rightHeadLinkId: rightValidated.headLinkId,
      truthBoundary: TRUTH_BOUNDARY
    };
  }

  if (commonLength === 0) {
    return {
      ok: true,
      code: 'ROTATION_REVOCATION_LINEAGE_GENESIS_CONFLICT',
      relation: 'conflict-no-common-ancestor',
      commonAncestor: null,
      leftDivergence: divergenceEvidence(left, leftValidated, 0),
      rightDivergence: divergenceEvidence(right, rightValidated, 0),
      truthBoundary: TRUTH_BOUNDARY
    };
  }

  return {
    ok: true,
    code: 'ROTATION_REVOCATION_LINEAGE_FORK_EVIDENCE',
    relation: 'fork',
    commonAncestor,
    leftDivergence: divergenceEvidence(left, leftValidated, commonLength),
    rightDivergence: divergenceEvidence(right, rightValidated, commonLength),
    truthBoundary: TRUTH_BOUNDARY
  };
}

module.exports = {
  compareKeyRotationRevocationCheckpointLineages
};
