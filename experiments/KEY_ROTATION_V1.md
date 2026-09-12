# Key Rotation v1 — bounded predecessor-signed successor evidence

Status: **BOUNDED RESEARCH EXPERIMENT**

## Question

Can an available predecessor key explicitly attest one successor key for one exact domain and bounded effective window while preserving old signed evidence, refusing retroactive identity ownership, and exposing competing simultaneously usable successor statements as conflict rather than silently choosing a winner?

## Falsifier first

This experiment fails if any of the following is true:

1. a signer other than the explicitly expected predecessor can create accepted rotation evidence for that predecessor;
2. the successor key id is not cryptographically bound to the exact supplied successor public key;
3. the rotation becomes usable before its explicit `effectiveAt` boundary or without trusted time;
4. `effectiveAt` may lie outside the signed envelope window;
5. a rotation for one domain is accepted for another domain;
6. creating or evaluating a rotation rewrites, invalidates, or re-labels older predecessor signatures;
7. two distinct simultaneously usable rotations from the same predecessor for the same domain are silently normalized or a winner is selected;
8. successful rotation evidence is described as proof that the predecessor and successor are the same human, device, legal identity, or constitutional authority;
9. the primitive automatically transfers capability/root authority or becomes AXM-wide CANON.

## Bounded design

A v1 rotation packet is a normal signed Trust Fabric envelope. Its body binds exactly:

- `predecessorKeyId` — must equal the envelope issuer;
- `successorKeyId`;
- `successorPublicKey` — must derive exactly to `successorKeyId`;
- `domain` — exact bounded text interpreted only by the consuming system;
- `effectiveAt` — must lie inside the signed envelope's `[issuedAt, expiresAt)` window.

Evaluation additionally requires:

- an explicit caller-supplied `expectedPredecessor`;
- an exact expected `domain`;
- trusted `nowMs` within the envelope window and at/after `effectiveAt`.

The success state is `KEY_SUCCESSOR_ATTESTED_FOR_DOMAIN`.

That means only: **the predecessor key signed this exact successor statement for this exact domain and bounded window**.

It does not prove same-person/device identity and it does not automatically move capability grants, root trust, revocation authority, checkpoint authority, donor policy, or CANON status to the successor.

## Conflict rule

`compareKeyRotations` compares two supplied rotation packets only after each independently passes the same bounded evaluation context. Exact same signed evidence returns `ROTATIONS_IDENTICAL`. Two different simultaneously usable statements for the same expected predecessor/domain return `ROTATION_FORK_EVIDENCE`.

A fork result contains both exact rotation ids and successor ids but no winner field or precedence rule.

## Continuity rule

Old signatures remain verified against the old embedded public key exactly as before. The rotation packet is additional evidence; it does not rewrite historical bytes or claim old signatures were produced by the successor.

## Explicit non-goals

This experiment does not implement:

- lost-key recovery;
- rotation chains beyond one predecessor-to-successor hop;
- successor acceptance as a capability/root issuer;
- revocation of rotation packets;
- global rotation discovery or freshness;
- fork resolution, consensus, or winner policy;
- human/legal/device identity proof;
- hardware-backed key custody;
- automatic donor migration or AXM-wide CANON.
