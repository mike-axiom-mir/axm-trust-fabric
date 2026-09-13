# Key Rotation / Recovery Research Contract

Status: **SINGLE-STEP ROTATION + SUCCESSOR POSSESSION + BOUNDED TWO-HOP LINEAGE + EXACT ROTATION REVOCATION IMPLEMENTED / RECOVERY NOT IMPLEMENTED**

## Implemented bounded property

Trust Fabric has an isolated single-step rotation experiment:

```text
Key A -> A signs exact bounded successor statement -> Key B
      -> exact domain
      -> explicit effectiveAt
      -> expires with the signed rotation envelope
      -> old A signatures remain independently verifiable
      -> competing simultaneously usable A -> B / A -> C statements become conflict evidence
```

The implementation lives in `src/key-rotation.js` and is deliberately **not** wired into capability/root authorization.

A successful result is `KEY_SUCCESSOR_ATTESTED_FOR_DOMAIN`.

That result means only that the explicitly expected predecessor key signed the exact successor public key for one exact domain and bounded active window. It does **not** prove A and B are the same human, device, legal identity, or constitutional authority.

## Successor possession acknowledgement

`src/key-rotation-ack.js` adds one isolated acknowledgement layer after a rotation already passes the bounded rotation evaluation.

Key B signs an acknowledgement that binds:

- the exact signed rotation digest;
- the exact predecessor key id;
- the exact successor key id;
- the exact domain.

The acknowledgement issuer must be the named successor key itself. Its signed validity window must be contained inside the predecessor rotation envelope window.

A successful result is `SUCCESSOR_POSSESSION_CONFIRMED_FOR_ROTATION`.

That proves only that the successor private key corresponding to the public key named in that exact rotation signed the acknowledgement. It does **not** prove same-person/device identity continuity, transfer root/capability authority, or make that rotation win over a competing predecessor-signed fork.

## Bounded two-hop rotation lineage

`src/key-rotation-lineage.js` composes exactly two already-existing rotation/acknowledgement pairs into one bounded supplied branch:

```text
A --signs--> B --acknowledges exact A->B packet
B --signs--> C --acknowledges exact B->C packet
```

The evaluator requires:

- exactly two rotations and exactly two successor acknowledgements;
- an explicit expected origin key A;
- the same exact domain at both hops;
- B to be the exact successor named by A and the exact signer/predecessor of the second rotation;
- the second rotation to be issued no earlier than the first rotation's `effectiveAt`;
- the second rotation to expire no later than the first rotation;
- trusted time so both rotations and acknowledgements are live under their existing checks.

A successful result is `TWO_HOP_ROTATION_LINEAGE_CONFIRMED`.

That means only that the supplied `A -> B -> C` evidence chain passed those exact bounded checks. It does **not** prove that A, B, and C are the same human/device/legal identity, transfer root/capability/revocation/checkpoint authority, prove the branch is globally newest or unique, discover unseen rotations, or resolve a competing branch.

The first implementation deliberately stops at exactly two hops rather than pretending arbitrary-length lineage is already understood.

## Exact key rotation revocation

`src/key-rotation-revocation.js` adds a separate local-evidence layer for withdrawing one exact predecessor-signed rotation packet. It does not rewrite `src/key-rotation.js`, the two-hop lineage evaluator, capability/root policy, donor systems, or historical signatures.

A rotation revocation is signed by the same predecessor that signed the referenced rotation and binds:

- the exact rotation envelope digest;
- the exact predecessor key id;
- the exact successor key id;
- the exact domain;
- a bounded machine-readable reason code.

A supplied valid active exact match produces `ROTATION_REVOKED`. A foreign signer or revocation bound to another rotation cannot revoke the supplied rotation.

The revocation envelope must remain valid through at least the referenced rotation's signed expiry. A shorter matching revocation produces `HOLD_INVALID_ROTATION_REVOCATION_WINDOW` rather than allowing a clean later resurrection after the revocation expires. A matching revocation that is not yet valid is not treated as already active.

When no active authoritative exact revocation is found, the bounded success state is `KEY_ROTATION_USABLE_WITH_SUPPLIED_REVOCATION_EVIDENCE`. That wording is intentional: it means only that the supplied local evidence contains no active authoritative exact revocation. It does **not** prove that no revocation exists elsewhere, that this peer is synchronized, or that the rotation is globally fresh/newest.

`evaluateTwoHopKeyRotationLineageWithRevocations` composes the existing two-hop result with two explicit local revocation sets. If either already-valid lineage hop has a supplied authoritative exact revocation, the wrapper refuses the lineage and identifies the affected hop. It does not mutate the rotation, acknowledgement, or existing lineage evaluator.

This experiment does not implement rotation-revocation discovery/synchronization, delegated or threshold rotation revokers, fork-resolution policy, globally current rotation state, automatic successor authority, or lost-key recovery.

## Rules locked by fixtures

- the rotation envelope issuer must equal the body predecessor key id;
- the rotation evaluator must be given an explicit expected predecessor;
- the successor key id must derive from the exact signed successor public key;
- `effectiveAt` must lie inside the signed rotation envelope window;
- trusted time is required and the rotation is unusable before `effectiveAt`;
- the domain must match exactly;
- old predecessor-signed bytes remain independently verifiable and are never rewritten as successor signatures;
- two distinct simultaneously usable predecessor-signed rotations for the same expected predecessor/domain become `ROTATION_FORK_EVIDENCE`;
- the rotation comparator exposes both exact packet ids and chooses no winner;
- successor possession acknowledgement must be signed by the exact named successor;
- acknowledgement must bind the exact rotation digest, predecessor, successor, and domain;
- acknowledgement validity cannot outlive the rotation envelope;
- expired acknowledgement is not live possession evidence;
- possession proof for one branch does not resolve a competing rotation fork;
- two-hop lineage requires successor-possession acknowledgement at both hops;
- the second hop's predecessor must equal the first hop's named successor;
- the second hop cannot change the exact domain;
- the second hop cannot be issued before the first hop becomes effective or outlive the first hop's signed expiry;
- successful two-hop lineage remains branch-local evidence and does not hide or resolve a competing second-hop rotation;
- evaluating a lineage does not rewrite any historical rotation or acknowledgement packet;
- an exact rotation revocation must be signed by the same predecessor that signed the referenced rotation;
- rotation revocation binds the exact rotation digest, predecessor, successor, and domain, so unrelated rotations remain unaffected;
- a matching revocation whose expiry is shorter than the referenced rotation fails closed as `HOLD_INVALID_ROTATION_REVOCATION_WINDOW`;
- a known supplied authoritative revocation of either hop prevents a two-hop lineage from remaining confirmed under the revocation-aware wrapper;
- absence of supplied rotation-revocation evidence never becomes a global freshness or unseen-evidence claim;
- revocation evaluation leaves historical rotation and acknowledgement bytes/digests unchanged.

See `experiments/KEY_ROTATION_V1.md`, `experiments/KEY_ROTATION_ACK_V1.md`, `experiments/KEY_ROTATION_LINEAGE_V1.md`, and `experiments/KEY_ROTATION_REVOCATION_V1.md` for the falsifier-first contracts.

## Still unresolved

The bounded experiments do **not** yet define or claim:

- arbitrary-length rotation lineage beyond the bounded two-hop `A -> B -> C` experiment;
- automatic acceptance of B or C as a capability/root issuer because a predecessor named them or they acknowledged possession;
- rotation-revocation discovery, synchronization, freshness, delegated/threshold revokers, or fork-interaction policy;
- rotation discovery or globally current rotation state;
- fork resolution or consensus;
- rollback protection after local evidence loss;
- device replacement as proof of actor identity;
- lost-key recovery.

## Lost-key recovery

If the only authority key is irretrievably lost and no recovery mechanism was established beforehand, the honest state remains:

`IDENTITY_CONTINUITY_UNPROVEN`

A future recovery mechanism may use pre-authorized recovery keys, threshold schemes, or other bounded evidence, but it must not fabricate continuity after the fact.

## Stop conditions

Reject future rotation/recovery expansion if it:

- lets a central service silently become the owner;
- creates permanent global identity as a base requirement;
- rewrites prior signatures;
- hides or automatically resolves a disputed fork;
- treats successor/recovery possession as proof of legal/human identity;
- silently converts a rotation statement, acknowledgement, revocation result, or lineage result into unrelated capability/root authority;
- turns recovery into automatic CANON or permission escalation.
