package trustvector

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func loadTwoHopVector(t *testing.T) map[string]any {
	t.Helper()
	data, err := os.ReadFile("../../evidence/two_hop_rotation_lineage_interop_v1.json")
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

func twoHopEvidence(t *testing.T, vector map[string]any) ([]map[string]any, []map[string]any) {
	t.Helper()
	evidence := vector["evidence"].(map[string]any)
	toMaps := func(items []any) []map[string]any {
		out := make([]map[string]any, len(items))
		for i, item := range items {
			out[i] = item.(map[string]any)
		}
		return out
	}
	return toMaps(evidence["rotations"].([]any)), toMaps(evidence["acknowledgements"].([]any))
}

func twoHopContext(t *testing.T, vector map[string]any) RotationLineageContext {
	t.Helper()
	evaluation := vector["evaluation"].(map[string]any)
	nowMS, err := evaluation["nowMs"].(json.Number).Int64()
	if err != nil {
		t.Fatal(err)
	}
	return RotationLineageContext{NowMS: &nowMS, ExpectedOrigin: evaluation["expectedOrigin"].(string), Domain: evaluation["domain"].(string)}
}

func cloneTwoHopMap(t *testing.T, value map[string]any) map[string]any {
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

func TestTwoHopLineageGoDependencySeparation(t *testing.T) {
	source, err := os.ReadFile("rotation_lineage_verifier.go")
	if err != nil {
		t.Fatal(err)
	}
	text := string(source)
	for _, forbidden := range []string{"key-rotation-lineage.js", "trust-core.js", "os/exec", "cgo"} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("forbidden dependency marker: %s", forbidden)
		}
	}
}

func TestTwoHopLineageExactPublishedVector(t *testing.T) {
	vector := loadTwoHopVector(t)
	rotations, acks := twoHopEvidence(t, vector)
	context := twoHopContext(t, vector)
	result := EvaluateTwoHopRotationLineageGo(rotations, acks, context)
	evaluation := vector["evaluation"].(map[string]any)
	if !result.OK || result.Code != evaluation["expectedCode"].(string) {
		t.Fatalf("unexpected result: %+v", result)
	}
	if result.OriginKeyID != evaluation["expectedOrigin"].(string) || result.IntermediateKeyID != evaluation["expectedIntermediate"].(string) || result.TerminalKeyID != evaluation["expectedTerminal"].(string) {
		t.Fatalf("lineage identities differ: %+v", result)
	}
	if result.ValidUntil != evaluation["expectedValidUntil"].(string) {
		t.Fatalf("validUntil differs: %+v", result)
	}
	digests := vector["digests"].(map[string]any)
	expectedRotationIDs := []string{digests["rotationAB"].(string), digests["rotationBC"].(string)}
	expectedAckIDs := []string{digests["ackAB"].(string), digests["ackBC"].(string)}
	for i := range expectedRotationIDs {
		if result.RotationIDs[i] != expectedRotationIDs[i] {
			t.Fatalf("rotation digest %d differs", i)
		}
		if result.AcknowledgementIDs[i] != expectedAckIDs[i] {
			t.Fatalf("ack digest %d differs", i)
		}
	}
}

func TestTwoHopLineageSignedMutationRejected(t *testing.T) {
	vector := loadTwoHopVector(t)
	rotations, acks := twoHopEvidence(t, vector)
	context := twoHopContext(t, vector)
	rotations[0] = cloneTwoHopMap(t, rotations[0])
	rotations[0]["body"].(map[string]any)["domain"] = "axm:interop:tampered"
	result := EvaluateTwoHopRotationLineageGo(rotations, acks, context)
	if result.Code != "HOLD_INVALID_ROTATION_HOP:INVALID_SIGNATURE" {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestTwoHopLineageWrongDomainRefused(t *testing.T) {
	vector := loadTwoHopVector(t)
	rotations, acks := twoHopEvidence(t, vector)
	context := twoHopContext(t, vector)
	context.Domain = "axm:interop:other-domain"
	result := EvaluateTwoHopRotationLineageGo(rotations, acks, context)
	if result.Code != "HOLD_INVALID_ROTATION_HOP:ROTATION_DOMAIN_MISMATCH" {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestTwoHopLineageSubstitutedAcknowledgementRefused(t *testing.T) {
	vector := loadTwoHopVector(t)
	rotations, acks := twoHopEvidence(t, vector)
	context := twoHopContext(t, vector)
	acks[1] = acks[0]
	result := EvaluateTwoHopRotationLineageGo(rotations, acks, context)
	if result.Code != "HOLD_INVALID_ROTATION_ACK:ACK_ROTATION_BINDING_MISMATCH" {
		t.Fatalf("unexpected result: %+v", result)
	}
}
