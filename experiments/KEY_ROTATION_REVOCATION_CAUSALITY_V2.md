# Key Rotation Revocation Causality v0.2 — falsifier-first experiment

## Question

Can Trust Fabric refuse a signed key-rotation revocation whose own `issuedAt` predates the exact rotation packet it claims to revoke, without inventing global time freshness, rewriting the referenced rotation, or weakening the existing exact-packet and predecessor-only revocation rules?

## Why this is the next bounded question

The exact rotation-revocation layer already binds one predecessor-signed revocation to one exact rotation digest and fails closed when the revocation expires before that rotation. One temporal causality edge remains: a cryptographically valid revocation envelope can currently be signed with an `issuedAt` earlier than the referenced rotation's `issuedAt` and later presented as if it withdrew evidence that did not yet exist.

The smallest correction is local and relational: compare the two signed envelope timestamps only after the exact packet, predecessor, successor, and domain bindings are proven. This is not a claim that either timestamp is globally trustworthy or synchronized.

## Falsifiers

This experiment fails if any of the following are observed:

1. an authoritative exact-match revocation with `revocation.issuedAt < rotation.issuedAt` can still produce `ROTATION_REVOKED`;
2. the implementation silently ignores that causal contradiction and returns the rotation as cleanly usable;
3. the rule depends on wall-clock freshness, network time, discovery, synchronization, consensus, or a global ordering service;
4. a foreign or unrelated revocation gains authority because of timestamp comparison;
5. equal timestamps are rejected even though the revocation and rotation can be signed in the same canonical millisecond;
6. historical rotation or acknowledgement bytes are rewritten or relabeled;
7. the change modifies `src/trust-core.js`, capability/root authorization, checkpoint behavior, donor-system behavior, or promotes repository merge to AXM-wide CANON.

## Bounded expected result

For an otherwise authoritative exact-match rotation revocation:

- if `Date.parse(revocation.issuedAt) < Date.parse(rotation.issuedAt)`, evaluation must fail closed as `HOLD_INVALID_ROTATION_REVOCATION_CAUSALITY`;
- if `revocation.issuedAt === rotation.issuedAt`, causality alone does not invalidate the revocation;
- all existing signature, exact-digest, predecessor, successor, domain, temporal-window, and local-evidence truth boundaries remain in force.

The same causality check should be enforced by the helper that creates a revocation, so locally constructed evidence cannot accidentally encode the contradiction. Evaluation must still detect the contradiction independently because externally supplied signed packets can bypass local creation helpers.

This result proves only that one supplied revocation packet is not signed earlier than the exact supplied rotation packet it names. It does not prove either timestamp is externally true, synchronized, globally ordered, newest, or authoritative beyond the signed local evidence relationship.
