package trustvector

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func loadRotationRevocationCompareVector(t *testing.T) map[string]any {
	t.Helper()
	data, err := os.ReadFile("../../evidence/rotation_revocation_lineage_compare_interop_v1.json")
	if err != nil {
		t.Fatal(err)
	}
	decoder := json.NewDecoder(strings.NewReader(string(data)))
	decoder.UseNumber()
	var value map[string]any
	if err := decoder.Decode(&value); err != nil {
		t.Fatal(err)
	}
	return value
}

func materializeRotationRevocationComparePackets(t *testing.T, vector map[string]any) map[string]RotationRevocationCompareEntry {
	t.Helper()
	identity := vector["identity"].(map[string]any)
	defaults := vector["defaults"].(map[string]any)
	issuer := identity["keyId"].(string)
	publicKey := identity["publicKeySpki"].(string)
	expiresAt := defaults["expiresAt"].(string)
	emptyDigest := defaults["revocationIdsDigestForEmptyManifest"].(string)
	packets := map[string]RotationRevocationCompareEntry{}

	for _, rawSpec := range vector["packetSpecs"].([]any) {
		spec := rawSpec.(map[string]any)
		name := spec["name"].(string)
		checkpointSpec := spec["checkpoint"].(map[string]any)
		linkSpec := spec["link"].(map[string]any)

		checkpoint := map[string]any{
			"version":   lineageEnvelopeVersion,
			"issuer":    issuer,
			"publicKey": publicKey,
			"issuedAt":  checkpointSpec["issuedAt"].(string),
			"expiresAt": expiresAt,
			"nonce":     checkpointSpec["nonce"].(string),
			"body": map[string]any{
				"kind":                "key-rotation-revocation-checkpoint",
				"completeThrough":     checkpointSpec["completeThrough"].(string),
				"revocationCount":     json.Number("0"),
				"revocationIdsDigest": emptyDigest,
			},
			"signature": checkpointSpec["expectedSignature"].(string),
		}
		checkpointDigest, err := lineageDigest(checkpoint)
		if err != nil {
			t.Fatal(err)
		}
		if checkpointDigest != checkpointSpec["expectedDigest"].(string) {
			t.Fatalf("%s checkpoint digest drift: %s", name, checkpointDigest)
		}

		var previousLinkID any = nil
		if linkSpec["previous"] != nil {
			previousName := linkSpec["previous"].(string)
			previousLinkID = vectorPacketLinkDigest(t, vector, previousName)
		}
		link := map[string]any{
			"version":   lineageEnvelopeVersion,
			"issuer":    issuer,
			"publicKey": publicKey,
			"issuedAt":  linkSpec["issuedAt"].(string),
			"expiresAt": expiresAt,
			"nonce":     linkSpec["nonce"].(string),
			"body": map[string]any{
				"kind":           "key-rotation-revocation-checkpoint-link",
				"checkpointId":   checkpointDigest,
				"previousLinkId": previousLinkID,
				"sequence":       linkSpec["sequence"],
			},
			"signature": linkSpec["expectedSignature"].(string),
		}
		linkDigest, err := lineageDigest(link)
		if err != nil {
			t.Fatal(err)
		}
		if linkDigest != linkSpec["expectedDigest"].(string) {
			t.Fatalf("%s link digest drift: %s", name, linkDigest)
		}
		packets[name] = RotationRevocationCompareEntry{Checkpoint: checkpoint, Link: link}
	}
	return packets
}

func vectorPacketLinkDigest(t *testing.T, vector map[string]any, name string) string {
	t.Helper()
	for _, rawSpec := range vector["packetSpecs"].([]any) {
		spec := rawSpec.(map[string]any)
		if spec["name"].(string) == name {
			return spec["link"].(map[string]any)["expectedDigest"].(string)
		}
	}
	t.Fatalf("unknown packet spec: %s", name)
	return ""
}

func rotationRevocationCompareHistory(t *testing.T, vector map[string]any, packets map[string]RotationRevocationCompareEntry, name string) []RotationRevocationCompareEntry {
	t.Helper()
	histories := vector["histories"].(map[string]any)
	rawNames := histories[name].([]any)
	result := make([]RotationRevocationCompareEntry, len(rawNames))
	for i, rawName := range rawNames {
		result[i] = packets[rawName.(string)]
	}
	return result
}

func cloneRotationRevocationCompareMap(t *testing.T, value map[string]any) map[string]any {
	t.Helper()
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	decoder := json.NewDecoder(strings.NewReader(string(encoded)))
	decoder.UseNumber()
	var cloned map[string]any
	if err := decoder.Decode(&cloned); err != nil {
		t.Fatal(err)
	}
	return cloned
}

func TestRotationRevocationLineageCompareGoDependencySeparation(t *testing.T) {
	source, err := os.ReadFile("rotation_revocation_lineage_compare_verifier.go")
	if err != nil {
		t.Fatal(err)
	}
	text := string(source)
	for _, forbidden := range []string{"key-rotation-revocation-checkpoint-lineage-compare.js", "trust-core.js", "os/exec", "cgo"} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("forbidden dependency marker: %s", forbidden)
		}
	}
}

func TestRotationRevocationLineageCompareGoExactPublishedVector(t *testing.T) {
	vector := loadRotationRevocationCompareVector(t)
	packets := materializeRotationRevocationComparePackets(t, vector)
	predecessor := vector["identity"].(map[string]any)["keyId"].(string)

	for _, rawComparison := range vector["comparisons"].([]any) {
		comparison := rawComparison.(map[string]any)
		result := CompareRotationRevocationCheckpointLineagesGo(
			rotationRevocationCompareHistory(t, vector, packets, comparison["left"].(string)),
			rotationRevocationCompareHistory(t, vector, packets, comparison["right"].(string)),
			predecessor,
		)
		if !result.OK || result.Code != comparison["expectedCode"].(string) || result.Relation != comparison["expectedRelation"].(string) {
			t.Fatalf("%s mismatch: %+v", comparison["name"].(string), result)
		}
		expectedAncestor := comparison["expectedCommonAncestorLinkId"]
		if expectedAncestor == nil {
			if result.CommonAncestor != nil {
				t.Fatalf("%s invented common ancestor: %+v", comparison["name"].(string), result.CommonAncestor)
			}
		} else if result.CommonAncestor == nil || result.CommonAncestor.LinkID != expectedAncestor.(string) {
			t.Fatalf("%s common ancestor mismatch: %+v", comparison["name"].(string), result.CommonAncestor)
		}
		if expectedSteps, ok := comparison["expectedDescendantSteps"].(json.Number); ok {
			steps, err := expectedSteps.Int64()
			if err != nil || result.DescendantSteps != int(steps) {
				t.Fatalf("%s descendant distance mismatch: %+v", comparison["name"].(string), result)
			}
		}
		if expectedLeft, ok := comparison["expectedLeftDivergenceLinkId"].(string); ok {
			if result.LeftDivergence == nil || result.RightDivergence == nil || result.LeftDivergence.LinkID != expectedLeft || result.RightDivergence.LinkID != comparison["expectedRightDivergenceLinkId"].(string) {
				t.Fatalf("%s divergence mismatch: %+v", comparison["name"].(string), result)
			}
		}
		if !strings.Contains(result.TruthBoundary, "does not discover unseen checkpoints or revocations") || !strings.Contains(result.TruthBoundary, "globally newest/current") || !strings.Contains(result.TruthBoundary, "choose a winning fork") {
			t.Fatalf("%s truth boundary widened: %s", comparison["name"].(string), result.TruthBoundary)
		}
	}
}

func TestRotationRevocationLineageCompareGoSignedMutationRejected(t *testing.T) {
	vector := loadRotationRevocationCompareVector(t)
	packets := materializeRotationRevocationComparePackets(t, vector)
	predecessor := vector["identity"].(map[string]any)["keyId"].(string)
	left := rotationRevocationCompareHistory(t, vector, packets, "branchA")
	left[2].Link = cloneRotationRevocationCompareMap(t, left[2].Link)
	left[2].Link["body"].(map[string]any)["checkpointId"] = strings.Repeat("0", 64)
	result := CompareRotationRevocationCheckpointLineagesGo(left, rotationRevocationCompareHistory(t, vector, packets, "branchA"), predecessor)
	if result.Code != "HOLD_INVALID_ROTATION_REVOCATION_LINEAGE_EVIDENCE" || result.Side != "left" || result.Index != 2 || result.Cause != "INVALID_SIGNATURE" {
		t.Fatalf("unexpected mutation result: %+v", result)
	}
}

func TestRotationRevocationLineageCompareGoMissingIntermediateRejected(t *testing.T) {
	vector := loadRotationRevocationCompareVector(t)
	packets := materializeRotationRevocationComparePackets(t, vector)
	predecessor := vector["identity"].(map[string]any)["keyId"].(string)
	omitted := []RotationRevocationCompareEntry{packets["genesis"], packets["branchA"]}
	result := CompareRotationRevocationCheckpointLineagesGo(rotationRevocationCompareHistory(t, vector, packets, "short"), omitted, predecessor)
	if result.Code != "HOLD_INVALID_ROTATION_REVOCATION_LINEAGE_EVIDENCE" || result.Side != "right" || result.Index != 1 || result.Cause != "HOLD_ROTATION_REVOCATION_LINEAGE_GAP" {
		t.Fatalf("unexpected omitted-intermediate result: %+v", result)
	}
}

func TestRotationRevocationLineageCompareGoWrongExpectedPredecessorRejected(t *testing.T) {
	vector := loadRotationRevocationCompareVector(t)
	packets := materializeRotationRevocationComparePackets(t, vector)
	wrongPredecessor := "axm:key:ed25519:" + strings.Repeat("0", 64)
	result := CompareRotationRevocationCheckpointLineagesGo(
		rotationRevocationCompareHistory(t, vector, packets, "short"),
		rotationRevocationCompareHistory(t, vector, packets, "branchA"),
		wrongPredecessor,
	)
	if result.Code != "HOLD_INVALID_ROTATION_REVOCATION_LINEAGE_EVIDENCE" || result.Side != "left" || result.Index != 0 || result.Cause != "ROTATION_REVOCATION_CHECKPOINT_LINEAGE_ISSUER_MISMATCH" {
		t.Fatalf("unexpected wrong-predecessor result: %+v", result)
	}
}
