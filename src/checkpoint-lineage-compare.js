'use strict';

const { envelopeDigest } = require('./trust-core');
const { evaluateCheckpointLineage } = require('./checkpoint-lineage');

const TRUTH_BOUNDARY = 'Compares only the supplied complete signed histories; does not discover unseen lineages, prove a globally newest head, resolve consensus, or choose a winning fork.';

function invalidEvidence(side, index, cause) {
  return {
    ok: false,
    code: 'HOLD_INVALID_LINEAGE_EVIDENCE',
    side,
    index,
    cause,
    truthBoundary: TRUTH_BOUNDARY
  };
}

function validateCompleteLineage(lineage, expectedIssuer, side) {
  if (typeof expectedIssuer !== 'string' || expectedIssuer.length === 0) {
    return {
      ok: false,
      code: 'HOLD_EXPECTED_ISSUER_REQUIRED',
      side,
      truthBoundary: TRUTH_BOUNDARY
    };
  }
  if (!Array.isArray(lineage) || lineage.length === 0) {
    return invalidEvidence(side, 0, 'HOLD_LINEAGE_HISTORY_REQUIRED');
  }

  const linkIds = [];
  const checkpointIds = [];
  let knownHead = null;

  for (let index = 0; index < lineage.length; index += 1) {
    const entry = lineage[index];
    if (!entry || typeof entry !== 'object' || !entry.link || !entry.checkpoint) {
      return invalidEvidence(side, index, 'INVALID_LINEAGE_ENTRY');
    }

    const result = evaluateCheckpointLineage(entry.link, {
      checkpoint: entry.checkpoint,
      knownHead,
      expectedIssuer
    });
    const expectedCode = index === 0 ? 'LINEAGE_GENESIS_ACCEPTABLE' : 'LINEAGE_ADVANCE_ACCEPTABLE';
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

function compareCheckpointLineages(left, right, { expectedIssuer } = {}) {
  if (typeof expectedIssuer !== 'string' || expectedIssuer.length === 0) {
    return {
      ok: false,
      code: 'HOLD_EXPECTED_ISSUER_REQUIRED',
      truthBoundary: TRUTH_BOUNDARY
    };
  }

  const leftValidated = validateCompleteLineage(left, expectedIssuer, 'left');
  if (!leftValidated.ok) return leftValidated;
  const rightValidated = validateCompleteLineage(right, expectedIssuer, 'right');
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
      code: 'LINEAGES_IDENTICAL',
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
      code: 'RIGHT_DESCENDS_FROM_LEFT',
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
      code: 'LEFT_DESCENDS_FROM_RIGHT',
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
      code: 'LINEAGE_GENESIS_CONFLICT',
      relation: 'conflict-no-common-ancestor',
      commonAncestor: null,
      leftDivergence: divergenceEvidence(left, leftValidated, 0),
      rightDivergence: divergenceEvidence(right, rightValidated, 0),
      truthBoundary: TRUTH_BOUNDARY
    };
  }

  return {
    ok: true,
    code: 'LINEAGE_FORK_EVIDENCE',
    relation: 'fork',
    commonAncestor,
    leftDivergence: divergenceEvidence(left, leftValidated, commonLength),
    rightDivergence: divergenceEvidence(right, rightValidated, commonLength),
    truthBoundary: TRUTH_BOUNDARY
  };
}

module.exports = {
  compareCheckpointLineages
};
