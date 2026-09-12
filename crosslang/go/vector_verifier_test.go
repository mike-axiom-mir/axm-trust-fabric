package trustvector

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func loadVector(t *testing.T) map[string]any {
	t.Helper()
	data, err := os.ReadFile("../../evidence/interop_vector_v1.json")
	if err != nil {
		t.Fatal(err)
	}
	value, err := DecodeJSON(data)
	if err != nil {
		t.Fatal(err)
	}
	return value
}

func envelopeFromVector(t *testing.T, vector map[string]any) map[string]any {
	t.Helper()
	envelope, ok := vector["envelope"].(map[string]any)
	if !ok {
		t.Fatal("missing envelope")
	}
	return envelope
}

func cloneMap(t *testing.T, value map[string]any) map[string]any {
	t.Helper()
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	cloned, err := DecodeJSON(encoded)
	if err != nil {
		t.Fatal(err)
	}
	return cloned
}

func vectorContext(t *testing.T, vector map[string]any) Context {
	t.Helper()
	evaluation := vector["evaluation"].(map[string]any)
	nowNumber := evaluation["nowMs"].(json.Number)
	nowMS, err := nowNumber.Int64()
	if err != nil {
		t.Fatal(err)
	}
	trustedRoots := map[string]bool{}
	for _, root := range evaluation["trustedRootIssuers"].([]any) {
		trustedRoots[root.(string)] = true
	}
	return Context{NowMS: &nowMS, TrustedRoots: trustedRoots, Target: evaluation["target"].(string), Action: evaluation["action"].(string)}
}

func TestLanguageAndDependencySeparation(t *testing.T) {
	source, err := os.ReadFile("vector_verifier.go")
	if err != nil {
		t.Fatal(err)
	}
	text := string(source)
	for _, forbidden := range []string{"trust-core.js", "vector-verifier-v1.js", "os/exec", "cgo"} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("forbidden dependency marker: %s", forbidden)
		}
	}
	module, err := os.ReadFile("go.mod")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(module), "require") {
		t.Fatal("cross-language verifier must remain standard-library only")
	}
}

func TestExactPublishedVector(t *testing.T) {
	vector := loadVector(t)
	envelope := envelopeFromVector(t, vector)
	result := InspectEnvelope(envelope, vectorContext(t, vector))
	if !result.OK || result.Code != vector["evaluation"].(map[string]any)["expectedCode"] {
		t.Fatalf("unexpected result: %+v", result)
	}
	if result.CanonicalUnsigned != vector["canonicalUnsigned"] {
		t.Fatal("canonical unsigned bytes mismatch")
	}
	if result.EnvelopeDigest != vector["envelopeDigest"] {
		t.Fatal("envelope digest mismatch")
	}
	if result.DerivedKeyID != vector["keyId"] {
		t.Fatal("key id mismatch")
	}
	if !result.SignatureValid {
		t.Fatal("signature did not verify")
	}
}

func TestSignedMutationRejected(t *testing.T) {
	vector := loadVector(t)
	envelope := cloneMap(t, envelopeFromVector(t, vector))
	envelope["body"].(map[string]any)["target"] = "fixture:tampered"
	result := InspectEnvelope(envelope, vectorContext(t, vector))
	if result.Code != "INVALID_SIGNATURE" {
		t.Fatalf("expected INVALID_SIGNATURE, got %+v", result)
	}
}

func TestUntrustedRootRefused(t *testing.T) {
	vector := loadVector(t)
	context := vectorContext(t, vector)
	context.TrustedRoots = map[string]bool{}
	result := InspectEnvelope(envelopeFromVector(t, vector), context)
	if result.Code != "UNTRUSTED_ROOT_ISSUER" {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestExpiryRefused(t *testing.T) {
	vector := loadVector(t)
	context := vectorContext(t, vector)
	expired := int64(1789210800000)
	context.NowMS = &expired
	result := InspectEnvelope(envelopeFromVector(t, vector), context)
	if result.Code != "EXPIRED" {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestWrongTargetRefused(t *testing.T) {
	vector := loadVector(t)
	context := vectorContext(t, vector)
	context.Target = "fixture:other"
	result := InspectEnvelope(envelopeFromVector(t, vector), context)
	if result.Code != "WRONG_TARGET" {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestWrongActionRefused(t *testing.T) {
	vector := loadVector(t)
	context := vectorContext(t, vector)
	context.Action = "write"
	result := InspectEnvelope(envelopeFromVector(t, vector), context)
	if result.Code != "WRONG_ACTION" {
		t.Fatalf("unexpected result: %+v", result)
	}
}
