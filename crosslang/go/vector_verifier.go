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
	envelopeVersion       = "axm.trust-envelope/v1"
	capabilityKind        = "capability-grant"
	keyIDPrefix           = "axm:key:ed25519:"
	maxSafeInteger  int64 = 9007199254740991
)

var canonicalInteger = regexp.MustCompile(`^-?(0|[1-9][0-9]*)$`)

type Result struct {
	OK                bool
	Code              string
	SignatureValid    bool
	DerivedKeyID      string
	CanonicalUnsigned string
	EnvelopeDigest    string
	Subject           string
}

type Context struct {
	NowMS        *int64
	TrustedRoots map[string]bool
	Target       string
	Action       string
}

func quoteJSONString(value string) (string, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return "", err
	}
	return strings.TrimSuffix(buffer.String(), "\n"), nil
}

func canonicalJSON(value any) (string, error) {
	switch typed := value.(type) {
	case nil:
		return "null", nil
	case string:
		return quoteJSONString(typed)
	case bool:
		if typed {
			return "true", nil
		}
		return "false", nil
	case json.Number:
		text := typed.String()
		if !canonicalInteger.MatchString(text) {
			return "", fmt.Errorf("NON_CANONICAL_NUMBER")
		}
		integer, err := strconv.ParseInt(text, 10, 64)
		if err != nil || integer < -maxSafeInteger || integer > maxSafeInteger {
			return "", fmt.Errorf("NON_CANONICAL_NUMBER")
		}
		return text, nil
	case []any:
		parts := make([]string, len(typed))
		for index, item := range typed {
			encoded, err := canonicalJSON(item)
			if err != nil {
				return "", err
			}
			parts[index] = encoded
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
			encodedKey, err := quoteJSONString(key)
			if err != nil {
				return "", err
			}
			encodedValue, err := canonicalJSON(typed[key])
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

func decodeBase64URL(text string) ([]byte, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(text)
	if err != nil {
		return nil, err
	}
	if base64.RawURLEncoding.EncodeToString(decoded) != text {
		return nil, errors.New("non-canonical base64url")
	}
	return decoded, nil
}

func publicKeyAndID(spkiText string) (ed25519.PublicKey, string, error) {
	der, err := decodeBase64URL(spkiText)
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
	return publicKey, keyIDPrefix + hex.EncodeToString(digest[:]), nil
}

func unsignedEnvelope(envelope map[string]any) map[string]any {
	unsigned := make(map[string]any, len(envelope)-1)
	for key, value := range envelope {
		if key != "signature" {
			unsigned[key] = value
		}
	}
	return unsigned
}

func exactTime(text string) (time.Time, error) {
	return time.Parse("2006-01-02T15:04:05.000Z", text)
}

func stringField(object map[string]any, key string) (string, error) {
	value, ok := object[key].(string)
	if !ok {
		return "", fmt.Errorf("%s must be string", key)
	}
	return value, nil
}

func InspectEnvelope(envelope map[string]any, context Context) Result {
	version, err := stringField(envelope, "version")
	if err != nil || version != envelopeVersion {
		return Result{Code: "UNSUPPORTED_VERSION"}
	}
	issuer, err := stringField(envelope, "issuer")
	if err != nil {
		return Result{Code: "INVALID_ENVELOPE"}
	}
	spki, err := stringField(envelope, "publicKey")
	if err != nil {
		return Result{Code: "INVALID_PUBLIC_KEY"}
	}
	publicKey, derivedKeyID, err := publicKeyAndID(spki)
	if err != nil {
		return Result{Code: "INVALID_PUBLIC_KEY"}
	}
	if issuer != derivedKeyID {
		return Result{Code: "ISSUER_KEY_MISMATCH", DerivedKeyID: derivedKeyID}
	}

	canonicalUnsigned, err := canonicalJSON(unsignedEnvelope(envelope))
	if err != nil {
		return Result{Code: "NON_CANONICAL_ENVELOPE", DerivedKeyID: derivedKeyID}
	}
	digest := sha256.Sum256([]byte(canonicalUnsigned))
	digestHex := hex.EncodeToString(digest[:])
	signatureText, err := stringField(envelope, "signature")
	if err != nil {
		return Result{Code: "INVALID_SIGNATURE", DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex}
	}
	signature, err := decodeBase64URL(signatureText)
	if err != nil || !ed25519.Verify(publicKey, []byte(canonicalUnsigned), signature) {
		return Result{Code: "INVALID_SIGNATURE", DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex}
	}

	issuedText, err := stringField(envelope, "issuedAt")
	if err != nil {
		return Result{Code: "INVALID_TIME", SignatureValid: true, DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex}
	}
	expiresText, err := stringField(envelope, "expiresAt")
	if err != nil {
		return Result{Code: "INVALID_TIME", SignatureValid: true, DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex}
	}
	issuedAt, err := exactTime(issuedText)
	if err != nil {
		return Result{Code: "INVALID_TIME", SignatureValid: true, DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex}
	}
	expiresAt, err := exactTime(expiresText)
	if err != nil || !expiresAt.After(issuedAt) {
		return Result{Code: "INVALID_TIME_WINDOW", SignatureValid: true, DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex}
	}
	if context.NowMS == nil {
		return Result{Code: "HOLD_CLOCK_UNKNOWN", SignatureValid: true, DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex}
	}
	if *context.NowMS < issuedAt.UnixMilli() {
		return Result{Code: "NOT_YET_VALID", SignatureValid: true, DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex}
	}
	if *context.NowMS >= expiresAt.UnixMilli() {
		return Result{Code: "EXPIRED", SignatureValid: true, DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex}
	}
	if !context.TrustedRoots[issuer] {
		return Result{Code: "UNTRUSTED_ROOT_ISSUER", SignatureValid: true, DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex}
	}

	body, ok := envelope["body"].(map[string]any)
	if !ok {
		return Result{Code: "INVALID_BODY", SignatureValid: true, DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex}
	}
	kind, _ := body["kind"].(string)
	if kind != capabilityKind {
		return Result{Code: "INVALID_CAPABILITY_KIND", SignatureValid: true, DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex}
	}
	if body["parentCapabilityId"] != nil {
		return Result{Code: "HOLD_PARENT_CHAIN_REQUIRED", SignatureValid: true, DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex}
	}
	target, ok := body["target"].(string)
	if !ok {
		return Result{Code: "INVALID_CAPABILITY", SignatureValid: true, DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex}
	}
	if context.Target != target {
		return Result{Code: "WRONG_TARGET", SignatureValid: true, DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex}
	}
	actions, ok := body["actions"].([]any)
	if !ok {
		return Result{Code: "INVALID_CAPABILITY", SignatureValid: true, DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex}
	}
	actionAllowed := false
	for _, action := range actions {
		if actionText, ok := action.(string); ok && actionText == context.Action {
			actionAllowed = true
		}
	}
	if !actionAllowed {
		return Result{Code: "WRONG_ACTION", SignatureValid: true, DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex}
	}
	subject, _ := body["subject"].(string)
	return Result{OK: true, Code: "GRANT_VALID_FOR_SCOPE", SignatureValid: true, DerivedKeyID: derivedKeyID, CanonicalUnsigned: canonicalUnsigned, EnvelopeDigest: digestHex, Subject: subject}
}

func DecodeJSON(data []byte) (map[string]any, error) {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	var value map[string]any
	if err := decoder.Decode(&value); err != nil {
		return nil, err
	}
	return value, nil
}
