package trustvector

import (
	"crypto/ed25519"
	"encoding/json"
	"regexp"
)

const rotationRevocationLineageCompareTruthBoundary = "Compares only two supplied complete signed rotation-revocation checkpoint histories; does not discover unseen checkpoints or revocations, prove a globally newest/current head, synchronize peers, resolve consensus, choose a winning fork, or transfer identity or authority."

var rotationRevocationCompareHex256 = regexp.MustCompile(`^[a-f0-9]{64}$`)

type RotationRevocationCompareEntry struct {
	Checkpoint map[string]any
	Link       map[string]any
}

type RotationRevocationCompareEvidence struct {
	Sequence        int64
	LinkID          string
	CheckpointID    string
	PreviousLinkID  string
	CompleteThrough string
}

type RotationRevocationLineageCompareResult struct {
	OK                   bool
	Code                 string
	Relation             string
	Side                 string
	Index                int
	Cause                string
	CommonAncestor       *RotationRevocationCompareEvidence
	LeftDivergence       *RotationRevocationCompareEvidence
	RightDivergence      *RotationRevocationCompareEvidence
	DescendantSteps      int
	LeftHeadLinkID       string
	RightHeadLinkID      string
	TruthBoundary        string
}

type validatedRotationRevocationCompareLineage struct {
	entries       []RotationRevocationCompareEntry
	linkIDs       []string
	checkpointIDs []string
	sequences     []int64
}

func rotationRevocationCompareInteger(value any) (int64, bool) {
	switch typed := value.(type) {
	case json.Number:
		integer, err := typed.Int64()
		return integer, err == nil
	case float64:
		integer := int64(typed)
		return integer, typed == float64(integer)
	case int:
		return int64(typed), true
	case int64:
		return typed, true
	default:
		return 0, false
	}
}

func verifyRotationRevocationCompareEnvelope(envelope map[string]any) (string, string, string) {
	if !lineageExactKeys(envelope, []string{"version", "issuer", "publicKey", "issuedAt", "expiresAt", "nonce", "body", "signature"}) {
		return "", "", "INVALID_ENVELOPE_SHAPE"
	}
	version, err := lineageStringField(envelope, "version")
	if err != nil || version != lineageEnvelopeVersion {
		return "", "", "UNSUPPORTED_VERSION"
	}
	issuer, err := lineageStringField(envelope, "issuer")
	if err != nil {
		return "", "", "INVALID_ENVELOPE"
	}
	spki, err := lineageStringField(envelope, "publicKey")
	if err != nil {
		return "", "", "INVALID_PUBLIC_KEY"
	}
	publicKey, derivedKeyID, err := lineagePublicKeyAndID(spki)
	if err != nil {
		return "", "", "INVALID_PUBLIC_KEY"
	}
	if issuer != derivedKeyID {
		return "", "", "ISSUER_KEY_MISMATCH"
	}
	nonce, err := lineageStringField(envelope, "nonce")
	if err != nil || len(nonce) < 16 || len(nonce) > 128 {
		return "", "", "INVALID_NONCE"
	}
	if _, err := lineageDecodeBase64URL(nonce); err != nil {
		return "", "", "INVALID_NONCE"
	}
	canonical, err := lineageCanonicalJSON(lineageUnsignedEnvelope(envelope))
	if err != nil {
		return "", "", "NON_CANONICAL_ENVELOPE"
	}
	signatureText, err := lineageStringField(envelope, "signature")
	if err != nil {
		return "", "", "INVALID_SIGNATURE"
	}
	signature, err := lineageDecodeBase64URL(signatureText)
	if err != nil || !ed25519.Verify(publicKey, []byte(canonical), signature) {
		return "", "", "INVALID_SIGNATURE"
	}
	issuedText, err := lineageStringField(envelope, "issuedAt")
	if err != nil {
		return "", "", "INVALID_TIME"
	}
	expiresText, err := lineageStringField(envelope, "expiresAt")
	if err != nil {
		return "", "", "INVALID_TIME"
	}
	issuedAt, err := lineageExactTime(issuedText)
	if err != nil {
		return "", "", "INVALID_TIME"
	}
	expiresAt, err := lineageExactTime(expiresText)
	if err != nil || !expiresAt.After(issuedAt) {
		return "", "", "INVALID_TIME_WINDOW"
	}
	digest, err := lineageDigest(envelope)
	if err != nil {
		return "", "", "NON_CANONICAL_ENVELOPE"
	}
	return digest, issuer, ""
}

func validateRotationRevocationCompareCheckpoint(checkpoint map[string]any, expectedPredecessor string) (string, string, int64, string) {
	digest, issuer, code := verifyRotationRevocationCompareEnvelope(checkpoint)
	if code != "" {
		return "", "", 0, code
	}
	if issuer != expectedPredecessor {
		return "", "", 0, "ROTATION_REVOCATION_CHECKPOINT_LINEAGE_ISSUER_MISMATCH"
	}
	body, ok := checkpoint["body"].(map[string]any)
	if !ok || !lineageExactKeys(body, []string{"kind", "completeThrough", "revocationCount", "revocationIdsDigest"}) {
		return "", "", 0, "ROTATION_REVOCATION_LINEAGE_CHECKPOINT_INVALID"
	}
	kind, _ := body["kind"].(string)
	if kind != "key-rotation-revocation-checkpoint" {
		return "", "", 0, "ROTATION_REVOCATION_LINEAGE_CHECKPOINT_INVALID"
	}
	completeThrough, err := lineageStringField(body, "completeThrough")
	if err != nil {
		return "", "", 0, "ROTATION_REVOCATION_LINEAGE_CHECKPOINT_INVALID"
	}
	completeThroughTime, err := lineageExactTime(completeThrough)
	if err != nil {
		return "", "", 0, "ROTATION_REVOCATION_LINEAGE_CHECKPOINT_INVALID"
	}
	count, ok := rotationRevocationCompareInteger(body["revocationCount"])
	if !ok || count < 0 || count > 10000 {
		return "", "", 0, "ROTATION_REVOCATION_LINEAGE_CHECKPOINT_INVALID"
	}
	revocationDigest, err := lineageStringField(body, "revocationIdsDigest")
	if err != nil || !rotationRevocationCompareHex256.MatchString(revocationDigest) {
		return "", "", 0, "ROTATION_REVOCATION_LINEAGE_CHECKPOINT_INVALID"
	}
	return digest, completeThrough, completeThroughTime.UnixMilli(), ""
}

func validateRotationRevocationCompareLink(link map[string]any, checkpointID, expectedPredecessor string) (string, int64, *string, string) {
	digest, issuer, code := verifyRotationRevocationCompareEnvelope(link)
	if code != "" {
		return "", 0, nil, code
	}
	if issuer != expectedPredecessor {
		return "", 0, nil, "ROTATION_REVOCATION_CHECKPOINT_LINEAGE_ISSUER_MISMATCH"
	}
	body, ok := link["body"].(map[string]any)
	if !ok || !lineageExactKeys(body, []string{"kind", "checkpointId", "previousLinkId", "sequence"}) {
		return "", 0, nil, "INVALID_ROTATION_REVOCATION_CHECKPOINT_LINK_SHAPE"
	}
	kind, _ := body["kind"].(string)
	if kind != "key-rotation-revocation-checkpoint-link" {
		return "", 0, nil, "INVALID_ROTATION_REVOCATION_CHECKPOINT_LINK_KIND"
	}
	boundCheckpointID, err := lineageStringField(body, "checkpointId")
	if err != nil || !rotationRevocationCompareHex256.MatchString(boundCheckpointID) {
		return "", 0, nil, "INVALID_ROTATION_REVOCATION_CHECKPOINT_ID"
	}
	if boundCheckpointID != checkpointID {
		return "", 0, nil, "ROTATION_REVOCATION_CHECKPOINT_LINK_BINDING_MISMATCH"
	}
	sequence, ok := rotationRevocationCompareInteger(body["sequence"])
	if !ok || sequence < 0 || sequence > 1000000 {
		return "", 0, nil, "INVALID_ROTATION_REVOCATION_CHECKPOINT_SEQUENCE"
	}
	var previous *string
	if body["previousLinkId"] != nil {
		text, ok := body["previousLinkId"].(string)
		if !ok || !rotationRevocationCompareHex256.MatchString(text) {
			return "", 0, nil, "INVALID_ROTATION_REVOCATION_PREVIOUS_LINK_ID"
		}
		previous = &text
	}
	if sequence == 0 && previous != nil {
		return "", 0, nil, "INVALID_ROTATION_REVOCATION_CHECKPOINT_GENESIS_LINK"
	}
	if sequence > 0 && previous == nil {
		return "", 0, nil, "INVALID_ROTATION_REVOCATION_CHECKPOINT_NON_GENESIS_LINK"
	}
	linkIssued, err := lineageStringField(link, "issuedAt")
	if err != nil {
		return "", 0, nil, "INVALID_ROTATION_REVOCATION_CHECKPOINT_LINEAGE_TIME"
	}
	checkpointIssued := ""
	_ = checkpointIssued
	return digest, sequence, previous, linkIssued
}

func invalidRotationRevocationCompareEvidence(side string, index int, cause string) RotationRevocationLineageCompareResult {
	return RotationRevocationLineageCompareResult{
		OK:            false,
		Code:          "HOLD_INVALID_ROTATION_REVOCATION_LINEAGE_EVIDENCE",
		Side:          side,
		Index:         index,
		Cause:         cause,
		TruthBoundary: rotationRevocationLineageCompareTruthBoundary,
	}
}

func validateRotationRevocationCompareLineage(lineage []RotationRevocationCompareEntry, expectedPredecessor, side string) (validatedRotationRevocationCompareLineage, RotationRevocationLineageCompareResult) {
	if expectedPredecessor == "" {
		return validatedRotationRevocationCompareLineage{}, RotationRevocationLineageCompareResult{
			Code: "HOLD_EXPECTED_PREDECESSOR_REQUIRED", Side: side, TruthBoundary: rotationRevocationLineageCompareTruthBoundary,
		}
	}
	if len(lineage) == 0 {
		return validatedRotationRevocationCompareLineage{}, invalidRotationRevocationCompareEvidence(side, 0, "HOLD_ROTATION_REVOCATION_LINEAGE_HISTORY_REQUIRED")
	}

	validated := validatedRotationRevocationCompareLineage{entries: lineage}
	var previousLinkID string
	var previousSequence int64
	var previousCompleteThroughMS int64

	for index, entry := range lineage {
		if entry.Checkpoint == nil || entry.Link == nil {
			return validatedRotationRevocationCompareLineage{}, invalidRotationRevocationCompareEvidence(side, index, "INVALID_ROTATION_REVOCATION_LINEAGE_ENTRY")
		}
		checkpointID, _, completeThroughMS, code := validateRotationRevocationCompareCheckpoint(entry.Checkpoint, expectedPredecessor)
		if code != "" {
			return validatedRotationRevocationCompareLineage{}, invalidRotationRevocationCompareEvidence(side, index, code)
		}
		linkID, sequence, previous, linkIssuedOrCode := validateRotationRevocationCompareLink(entry.Link, checkpointID, expectedPredecessor)
		if linkID == "" {
			return validatedRotationRevocationCompareLineage{}, invalidRotationRevocationCompareEvidence(side, index, linkIssuedOrCode)
		}
		linkIssuedAt, err := lineageExactTime(linkIssuedOrCode)
		if err != nil {
			return validatedRotationRevocationCompareLineage{}, invalidRotationRevocationCompareEvidence(side, index, "INVALID_ROTATION_REVOCATION_CHECKPOINT_LINEAGE_TIME")
		}
		checkpointIssuedText, err := lineageStringField(entry.Checkpoint, "issuedAt")
		if err != nil {
			return validatedRotationRevocationCompareLineage{}, invalidRotationRevocationCompareEvidence(side, index, "INVALID_ROTATION_REVOCATION_CHECKPOINT_LINEAGE_TIME")
		}
		checkpointIssuedAt, err := lineageExactTime(checkpointIssuedText)
		if err != nil || linkIssuedAt.Before(checkpointIssuedAt) {
			return validatedRotationRevocationCompareLineage{}, invalidRotationRevocationCompareEvidence(side, index, "ROTATION_REVOCATION_CHECKPOINT_LINK_BEFORE_CHECKPOINT")
		}

		if index == 0 {
			if sequence != 0 || previous != nil {
				return validatedRotationRevocationCompareLineage{}, invalidRotationRevocationCompareEvidence(side, index, "HOLD_ROTATION_REVOCATION_LINEAGE_HISTORY_REQUIRED")
			}
		} else {
			if sequence > previousSequence+1 {
				return validatedRotationRevocationCompareLineage{}, invalidRotationRevocationCompareEvidence(side, index, "HOLD_ROTATION_REVOCATION_LINEAGE_GAP")
			}
			if sequence <= previousSequence || previous == nil || *previous != previousLinkID {
				return validatedRotationRevocationCompareLineage{}, invalidRotationRevocationCompareEvidence(side, index, "ROTATION_REVOCATION_CHECKPOINT_FORK_DETECTED")
			}
			if completeThroughMS < previousCompleteThroughMS {
				return validatedRotationRevocationCompareLineage{}, invalidRotationRevocationCompareEvidence(side, index, "ROTATION_REVOCATION_CHECKPOINT_COMPLETENESS_ROLLBACK")
			}
		}

		validated.linkIDs = append(validated.linkIDs, linkID)
		validated.checkpointIDs = append(validated.checkpointIDs, checkpointID)
		validated.sequences = append(validated.sequences, sequence)
		previousLinkID = linkID
		previousSequence = sequence
		previousCompleteThroughMS = completeThroughMS
	}

	return validated, RotationRevocationLineageCompareResult{OK: true}
}

func rotationRevocationCompareEvidence(lineage []RotationRevocationCompareEntry, validated validatedRotationRevocationCompareLineage, index int) *RotationRevocationCompareEvidence {
	if index < 0 {
		return nil
	}
	previous := ""
	if value := lineage[index].Link["body"].(map[string]any)["previousLinkId"]; value != nil {
		previous = value.(string)
	}
	return &RotationRevocationCompareEvidence{
		Sequence:        validated.sequences[index],
		LinkID:          validated.linkIDs[index],
		CheckpointID:    validated.checkpointIDs[index],
		PreviousLinkID:  previous,
		CompleteThrough: lineage[index].Checkpoint["body"].(map[string]any)["completeThrough"].(string),
	}
}

func CompareRotationRevocationCheckpointLineagesGo(left, right []RotationRevocationCompareEntry, expectedPredecessor string) RotationRevocationLineageCompareResult {
	if expectedPredecessor == "" {
		return RotationRevocationLineageCompareResult{Code: "HOLD_EXPECTED_PREDECESSOR_REQUIRED", TruthBoundary: rotationRevocationLineageCompareTruthBoundary}
	}
	leftValidated, leftResult := validateRotationRevocationCompareLineage(left, expectedPredecessor, "left")
	if !leftResult.OK {
		return leftResult
	}
	rightValidated, rightResult := validateRotationRevocationCompareLineage(right, expectedPredecessor, "right")
	if !rightResult.OK {
		return rightResult
	}

	commonLimit := len(leftValidated.linkIDs)
	if len(rightValidated.linkIDs) < commonLimit {
		commonLimit = len(rightValidated.linkIDs)
	}
	commonLength := 0
	for commonLength < commonLimit && leftValidated.linkIDs[commonLength] == rightValidated.linkIDs[commonLength] {
		commonLength++
	}
	commonAncestor := rotationRevocationCompareEvidence(left, leftValidated, commonLength-1)
	base := RotationRevocationLineageCompareResult{
		OK:              true,
		CommonAncestor:  commonAncestor,
		LeftHeadLinkID:  leftValidated.linkIDs[len(leftValidated.linkIDs)-1],
		RightHeadLinkID: rightValidated.linkIDs[len(rightValidated.linkIDs)-1],
		TruthBoundary:   rotationRevocationLineageCompareTruthBoundary,
	}

	if commonLength == len(leftValidated.linkIDs) && commonLength == len(rightValidated.linkIDs) {
		base.Code = "ROTATION_REVOCATION_LINEAGES_IDENTICAL"
		base.Relation = "identical"
		return base
	}
	if commonLength == len(leftValidated.linkIDs) {
		base.Code = "ROTATION_REVOCATION_RIGHT_DESCENDS_FROM_LEFT"
		base.Relation = "right-descends-from-left"
		base.DescendantSteps = len(rightValidated.linkIDs) - len(leftValidated.linkIDs)
		return base
	}
	if commonLength == len(rightValidated.linkIDs) {
		base.Code = "ROTATION_REVOCATION_LEFT_DESCENDS_FROM_RIGHT"
		base.Relation = "left-descends-from-right"
		base.DescendantSteps = len(leftValidated.linkIDs) - len(rightValidated.linkIDs)
		return base
	}
	if commonLength == 0 {
		base.Code = "ROTATION_REVOCATION_LINEAGE_GENESIS_CONFLICT"
		base.Relation = "conflict-no-common-ancestor"
		base.LeftDivergence = rotationRevocationCompareEvidence(left, leftValidated, 0)
		base.RightDivergence = rotationRevocationCompareEvidence(right, rightValidated, 0)
		return base
	}
	base.Code = "ROTATION_REVOCATION_LINEAGE_FORK_EVIDENCE"
	base.Relation = "fork"
	base.LeftDivergence = rotationRevocationCompareEvidence(left, leftValidated, commonLength)
	base.RightDivergence = rotationRevocationCompareEvidence(right, rightValidated, commonLength)
	return base
}
