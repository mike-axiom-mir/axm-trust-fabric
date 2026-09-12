package trustvector

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	lineageEnvelopeVersion       = "axm.trust-envelope/v1"
	lineageRotationKind          = "key-rotation"
	lineageAckKind               = "key-rotation-ack"
	lineageKeyIDPrefix           = "axm:key:ed25519:"
	lineageMaxSafeInteger  int64 = 9007199254740991
)

var lineageCanonicalInteger = regexp.MustCompile(`^-?(0|[1-9][0-9]*)$`)

type RotationLineageContext struct {
	NowMS          *int64
	ExpectedOrigin string
	Domain         string
}

type RotationLineageResult struct {
	OK                 bool
	Code               string
	OriginKeyID        string
	IntermediateKeyID  string
	TerminalKeyID      string
	Domain             string
	ValidUntil         string
	RotationIDs        []string
	AcknowledgementIDs []string
}

type lineageEnvelopeEvidence struct {
	issuer    string
	issuedAt  time.Time
	expiresAt time.Time
	digest    string
}

type lineageRotationEvidence struct {
	predecessor string
	successor   string
	domain      string
	effectiveAt time.Time
	issuedAt    time.Time
	expiresAt   time.Time
	digest      string
}

func lineageQuoteJSONString(value string) (string, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return "", err
	}
	return strings.TrimSuffix(buffer.String(), "\n"), nil
}

func lineageCanonicalJSON(value any) (string, error) {
	switch typed := value.(type) {
	case nil:
		return "null", nil
	case string:
		return lineageQuoteJSONString(typed)
	case bool:
		if typed {
			return "true", nil
		}
		return "false", nil
	case json.Number:
		text := typed.String()
		if !lineageCanonicalInteger.MatchString(text) {
			return "", fmt.Errorf("NON_CANONICAL_NUMBER")
		}
		integer, err := strconv.ParseInt(text, 10, 64)
		if err != nil || integer < -lineageMaxSafeInteger || integer > lineageMaxSafeInteger {
			return "", fmt.Errorf("NON_CANONICAL_NUMBER")
		}
		return text, nil
	case float64:
		if typed != float64(int64(typed)) || typed < float64(-lineageMaxSafeInteger) || typed > float64(lineageMaxSafeInteger) {
			return "", fmt.Errorf("NON_CANONICAL_NUMBER")
		}
		return strconv.FormatInt(int64(typed), 10), nil
	case []any:
		parts := make([]string, len(typed))
		for i, item := range typed {
			encoded, err := lineageCanonicalJSON(item)
			if err != nil {
				return "", err
			}
			parts[i] = encoded
		}
		return "[" + strings.Join(parts, ",") + "]", nil
	case map[string]any:
		keys := make([]string, 0, len(typed))
		for key := range typed {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		parts := make([]string, 0, len(keys))
		for _, key := range keys {
			encodedKey, err := lineageQuoteJSONString(key)
			if err != nil {
				return "", err
			}
			encodedValue, err := lineageCanonicalJSON(typed[key])
			if err != nil {
				return "", err
			}
			parts = append(parts, encodedKey+":"+encodedValue)
		}
		return "{" + strings.Join(parts, ",") + "}", nil
	default:
		return "", fmt.Errorf("UNSUPPORTED_CANONICAL_TYPE: %T", value)
	}
}

func lineageDecodeBase64URL(text string) ([]byte, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(text)
	if err != nil {
		return nil, err
	}
	if base64.RawURLEncoding.EncodeToString(decoded) != text {
		return nil, errors.New("non-canonical base64url")
	}
	return decoded, nil
}

func lineagePublicKeyAndID(spkiText string) (ed25519.PublicKey, string, error) {
	der, err := lineageDecodeBase64URL(spkiText)
	if err != nil {
		return nil, "", err
	}
	parsed, err := x509.ParsePKIXPublicKey(der)
	if err != nil {
		return nil, "", err
	}
	publicKey, ok := parsed.(ed25519.PublicKey)
	if !ok {
		return nil, "", errors.New("expected Ed25519 public key")
	}
	digest := sha256.Sum256(der)
	return publicKey, lineageKeyIDPrefix + hex.EncodeToString(digest[:]), nil
}

func lineageUnsignedEnvelope(envelope map[string]any) map[string]any {
	unsigned := make(map[string]any, len(envelope)-1)
	for key, value := range envelope {
		if key != "signature" {
			unsigned[key] = value
		}
	}
	return unsigned
}

func lineageDigest(envelope map[string]any) (string, error) {
	canonical, err := lineageCanonicalJSON(lineageUnsignedEnvelope(envelope))
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256([]byte(canonical))
	return hex.EncodeToString(digest[:]), nil
}

func lineageExactTime(text string) (time.Time, error) {
	return time.Parse("2006-01-02T15:04:05.000Z", text)
}

func lineageStringField(object map[string]any, key string) (string, error) {
	value, ok := object[key].(string)
	if !ok {
		return "", fmt.Errorf("%s must be string", key)
	}
	return value, nil
}

func lineageExactKeys(object map[string]any, expected []string) bool {
	if len(object) != len(expected) {
		return false
	}
	for _, key := range expected {
		if _, ok := object[key]; !ok {
			return false
		}
	}
	return true
}

func inspectLineageEnvelope(envelope map[string]any, nowMS *int64) (lineageEnvelopeEvidence, string) {
	if !lineageExactKeys(envelope, []string{"version", "issuer", "publicKey", "issuedAt", "expiresAt", "nonce", "body", "signature"}) {
		return lineageEnvelopeEvidence{}, "INVALID_ENVELOPE_SHAPE"
	}
	version, err := lineageStringField(envelope, "version")
	if err != nil || version != lineageEnvelopeVersion {
		return lineageEnvelopeEvidence{}, "UNSUPPORTED_VERSION"
	}
	issuer, err := lineageStringField(envelope, "issuer")
	if err != nil {
		return lineageEnvelopeEvidence{}, "INVALID_ENVELOPE"
	}
	spki, err := lineageStringField(envelope, "publicKey")
	if err != nil {
		return lineageEnvelopeEvidence{}, "INVALID_PUBLIC_KEY"
	}
	publicKey, derivedKeyID, err := lineagePublicKeyAndID(spki)
	if err != nil {
		return lineageEnvelopeEvidence{}, "INVALID_PUBLIC_KEY"
	}
	if issuer != derivedKeyID {
		return lineageEnvelopeEvidence{}, "ISSUER_KEY_MISMATCH"
	}
	canonical, err := lineageCanonicalJSON(lineageUnsignedEnvelope(envelope))
	if err != nil {
		return lineageEnvelopeEvidence{}, "NON_CANONICAL_ENVELOPE"
	}
	digestBytes := sha256.Sum256([]byte(canonical))
	digest := hex.EncodeToString(digestBytes[:])
	signatureText, err := lineageStringField(envelope, "signature")
	if err != nil {
		return lineageEnvelopeEvidence{}, "INVALID_SIGNATURE"
	}
	signature, err := lineageDecodeBase64URL(signatureText)
	if err != nil || !ed25519.Verify(publicKey, []byte(canonical), signature) {
		return lineageEnvelopeEvidence{}, "INVALID_SIGNATURE"
	}
	issuedText, err := lineageStringField(envelope, "issuedAt")
	if err != nil {
		return lineageEnvelopeEvidence{}, "INVALID_TIME"
	}
	expiresText, err := lineageStringField(envelope, "expiresAt")
	if err != nil {
		return lineageEnvelopeEvidence{}, "INVALID_TIME"
	}
	issuedAt, err := lineageExactTime(issuedText)
	if err != nil {
		return lineageEnvelopeEvidence{}, "INVALID_TIME"
	}
	expiresAt, err := lineageExactTime(expiresText)
	if err != nil || !expiresAt.After(issuedAt) {
		return lineageEnvelopeEvidence{}, "INVALID_TIME_WINDOW"
	}
	if nowMS == nil {
		return lineageEnvelopeEvidence{}, "HOLD_CLOCK_UNKNOWN"
	}
	if *nowMS < issuedAt.UnixMilli() {
		return lineageEnvelopeEvidence{}, "NOT_YET_VALID"
	}
	if *nowMS >= expiresAt.UnixMilli() {
		return lineageEnvelopeEvidence{}, "EXPIRED"
	}
	return lineageEnvelopeEvidence{issuer: issuer, issuedAt: issuedAt, expiresAt: expiresAt, digest: digest}, ""
}

func evaluateLineageRotation(rotation map[string]any, nowMS *int64, expectedPredecessor, domain string) (lineageRotationEvidence, string) {
	env, code := inspectLineageEnvelope(rotation, nowMS)
	if code != "" {
		return lineageRotationEvidence{}, code
	}
	body, ok := rotation["body"].(map[string]any)
	if !ok {
		return lineageRotationEvidence{}, "INVALID_ROTATION"
	}
	if !lineageExactKeys(body, []string{"kind", "predecessorKeyId", "successorKeyId", "successorPublicKey", "domain", "effectiveAt"}) {
		return lineageRotationEvidence{}, "INVALID_ROTATION_SHAPE"
	}
	kind, _ := body["kind"].(string)
	if kind != lineageRotationKind {
		return lineageRotationEvidence{}, "INVALID_ROTATION_KIND"
	}
	predecessor, err := lineageStringField(body, "predecessorKeyId")
	if err != nil {
		return lineageRotationEvidence{}, "INVALID_PREDECESSOR_KEY"
	}
	successor, err := lineageStringField(body, "successorKeyId")
	if err != nil {
		return lineageRotationEvidence{}, "INVALID_SUCCESSOR_KEY"
	}
	successorPublicKey, err := lineageStringField(body, "successorPublicKey")
	if err != nil {
		return lineageRotationEvidence{}, "INVALID_SUCCESSOR_PUBLIC_KEY"
	}
	_, derivedSuccessor, err := lineagePublicKeyAndID(successorPublicKey)
	if err != nil || derivedSuccessor != successor {
		return lineageRotationEvidence{}, "SUCCESSOR_KEY_MISMATCH"
	}
	if predecessor != env.issuer {
		return lineageRotationEvidence{}, "ROTATION_ISSUER_MISMATCH"
	}
	if predecessor == successor {
		return lineageRotationEvidence{}, "ROTATION_SELF_SUCCESSION"
	}
	packetDomain, err := lineageStringField(body, "domain")
	if err != nil || packetDomain == "" {
		return lineageRotationEvidence{}, "INVALID_ROTATION_DOMAIN"
	}
	effectiveText, err := lineageStringField(body, "effectiveAt")
	if err != nil {
		return lineageRotationEvidence{}, "INVALID_ROTATION_TIME"
	}
	effectiveAt, err := lineageExactTime(effectiveText)
	if err != nil || effectiveAt.Before(env.issuedAt) || !effectiveAt.Before(env.expiresAt) {
		return lineageRotationEvidence{}, "INVALID_ROTATION_WINDOW"
	}
	if expectedPredecessor == "" {
		return lineageRotationEvidence{}, "HOLD_EXPECTED_PREDECESSOR_REQUIRED"
	}
	if env.issuer != expectedPredecessor {
		return lineageRotationEvidence{}, "ROTATION_PREDECESSOR_MISMATCH"
	}
	if packetDomain != domain {
		return lineageRotationEvidence{}, "ROTATION_DOMAIN_MISMATCH"
	}
	if *nowMS < effectiveAt.UnixMilli() {
		return lineageRotationEvidence{}, "ROTATION_NOT_YET_EFFECTIVE"
	}
	return lineageRotationEvidence{predecessor: predecessor, successor: successor, domain: packetDomain, effectiveAt: effectiveAt, issuedAt: env.issuedAt, expiresAt: env.expiresAt, digest: env.digest}, ""
}

func evaluateLineageAck(rotation map[string]any, rotationEvidence lineageRotationEvidence, ack map[string]any, nowMS *int64) (string, string) {
	env, code := inspectLineageEnvelope(ack, nowMS)
	if code != "" {
		return "", code
	}
	body, ok := ack["body"].(map[string]any)
	if !ok {
		return "", "INVALID_ACKNOWLEDGEMENT"
	}
	if !lineageExactKeys(body, []string{"kind", "rotationId", "predecessorKeyId", "successorKeyId", "domain"}) {
		return "", "INVALID_ACKNOWLEDGEMENT_SHAPE"
	}
	kind, _ := body["kind"].(string)
	if kind != lineageAckKind {
		return "", "INVALID_ACKNOWLEDGEMENT_KIND"
	}
	rotationID, err := lineageStringField(body, "rotationId")
	if err != nil {
		return "", "INVALID_ROTATION_ID"
	}
	predecessor, err := lineageStringField(body, "predecessorKeyId")
	if err != nil {
		return "", "INVALID_PREDECESSOR_KEY"
	}
	successor, err := lineageStringField(body, "successorKeyId")
	if err != nil {
		return "", "INVALID_SUCCESSOR_KEY"
	}
	packetDomain, err := lineageStringField(body, "domain")
	if err != nil {
		return "", "INVALID_ACKNOWLEDGEMENT_DOMAIN"
	}
	if env.issuer != successor {
		return "", "ACK_ISSUER_MISMATCH"
	}
	if rotationID != rotationEvidence.digest {
		return "", "ACK_ROTATION_BINDING_MISMATCH"
	}
	if predecessor != rotationEvidence.predecessor {
		return "", "ACK_PREDECESSOR_MISMATCH"
	}
	if successor != rotationEvidence.successor {
		return "", "ACK_SUCCESSOR_MISMATCH"
	}
	if packetDomain != rotationEvidence.domain {
		return "", "ACK_DOMAIN_MISMATCH"
	}
	if env.issuedAt.Before(rotationEvidence.issuedAt) || env.expiresAt.After(rotationEvidence.expiresAt) {
		return "", "ACK_WINDOW_ESCALATION"
	}
	_ = rotation
	return env.digest, ""
}

func EvaluateTwoHopRotationLineageGo(rotations []map[string]any, acknowledgements []map[string]any, context RotationLineageContext) RotationLineageResult {
	if len(rotations) != 2 {
		return RotationLineageResult{Code: "HOLD_EXACT_TWO_ROTATION_HOPS_REQUIRED"}
	}
	if len(acknowledgements) != 2 {
		return RotationLineageResult{Code: "HOLD_EXACT_TWO_ACKNOWLEDGEMENTS_REQUIRED"}
	}
	if context.ExpectedOrigin == "" {
		return RotationLineageResult{Code: "HOLD_EXPECTED_ORIGIN_REQUIRED"}
	}
	if context.Domain == "" {
		return RotationLineageResult{Code: "HOLD_ROTATION_DOMAIN_REQUIRED"}
	}
	first, code := evaluateLineageRotation(rotations[0], context.NowMS, context.ExpectedOrigin, context.Domain)
	if code != "" {
		return RotationLineageResult{Code: "HOLD_INVALID_ROTATION_HOP:" + code}
	}
	ack0, code := evaluateLineageAck(rotations[0], first, acknowledgements[0], context.NowMS)
	if code != "" {
		return RotationLineageResult{Code: "HOLD_INVALID_ROTATION_ACK:" + code}
	}
	second, code := evaluateLineageRotation(rotations[1], context.NowMS, first.successor, context.Domain)
	if code != "" {
		return RotationLineageResult{Code: "HOLD_INVALID_ROTATION_HOP:" + code}
	}
	if second.issuedAt.Before(first.effectiveAt) || second.expiresAt.After(first.expiresAt) {
		return RotationLineageResult{Code: "ROTATION_LINEAGE_WINDOW_ESCALATION"}
	}
	ack1, code := evaluateLineageAck(rotations[1], second, acknowledgements[1], context.NowMS)
	if code != "" {
		return RotationLineageResult{Code: "HOLD_INVALID_ROTATION_ACK:" + code}
	}
	validUntil := acknowledgements[1]["expiresAt"].(string)
	return RotationLineageResult{OK: true, Code: "TWO_HOP_ROTATION_LINEAGE_CONFIRMED", OriginKeyID: first.predecessor, IntermediateKeyID: first.successor, TerminalKeyID: second.successor, Domain: context.Domain, ValidUntil: validUntil, RotationIDs: []string{first.digest, second.digest}, AcknowledgementIDs: []string{ack0, ack1}}
}
