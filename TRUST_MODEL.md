# Trust Model v0.1

## Purpose

Trust Fabric proves bounded cryptographic statements about exact bytes and exact authorization scope. It must not convert cryptographic validity into moral, factual, social, legal, or constitutional authority.

## Five independent dimensions

| Dimension | v0.1 can establish | v0.1 must not claim |
|---|---|---|
| Integrity | signed canonical bytes still match | bytes are safe, correct, or desirable |
| Authorship | holder of a private key signed the bytes | a legal/named human authored them |
| Authority | an explicitly trusted root issued a valid grant chain for an exact subject/action/target, and the subject can sign an exact use request | signer has authority outside that chain |
| Identity continuity | nothing from one signature alone | key = permanent person/device identity |
| Truth | not evaluated | signed statement is true |

## Trust roots are local policy

Cryptography cannot decide which key is allowed to originate authority for a target. The consuming AXM system supplies the accepted root issuer set for the evaluation context.

An arbitrary key signing its own capability therefore produces `UNTRUSTED_ROOT_ISSUER`, not authority.

This is intentionally local and explicit. Trust Fabric does not maintain a global root registry.

## Capability rule

Authority is explicit and closed. A v0.1 capability declares:

- subject key id;
- exact target;
- sorted action set;
- issue and expiry timestamps;
- remaining delegation depth;
- exact parent capability id or null;
- whether the capability is one-use.

A child capability may only narrow its parent. It cannot add actions, change target, begin before or outlive the parent, increase delegation depth, turn one-use into reusable, or be issued by anyone except the parent subject.

A delegated grant is not accepted without the complete parent chain back to an explicitly trusted root.

In v0.1, a one-use grant must have `delegationDepth = 0`. This deliberately forbids delegation from one-use grants because allowing one parent to mint multiple children would make the one-use claim ambiguous without a stronger shared consumption protocol.

## Grant is not use

A valid grant means the named subject has been granted a scope. It does not prove that the current requester controls that subject key.

For live use, v0.1 supports a subject-signed capability-use envelope bound to the exact capability id, target and action. Only then can the bounded result become `AUTHORIZED_USE`.

## Revocation rule

v0.1 accepts an exact capability revocation only when its signature is valid, it references the exact capability digest, and its issuer is the capability issuer. A matching revocation whose expiry is earlier than the capability produces `HOLD_INVALID_REVOCATION_WINDOW` instead of allowing a later silent resurrection.

### Ancestor invalidation in a supplied delegation chain

A revocation packet still names exactly one capability; Trust Fabric does **not** rewrite descendants as though they had each been directly revoked.

However, a delegated grant is valid only while every capability in its required chain remains valid. Therefore, when the evaluator is supplied a complete chain plus a valid issuer-signed revocation of any ancestor in that chain, authorization through the descendant fails at the revoked ancestor. The result preserves the affected chain index.

A foreign-signed ancestor revocation remains non-authoritative. A short-window ancestor revocation produces the existing `HOLD_INVALID_REVOCATION_WINDOW` fail-closed state for the descendant chain rather than allowing a clean later resurrection.

This is local evidence semantics, not a freshness protocol. If a peer has never received a newer ancestor revocation, Trust Fabric cannot infer that no such revocation exists elsewhere.

Delegated revokers, threshold revocation, recovery keys, revocation distribution, and globally fresh revocation state remain research questions.

## Revocation checkpoint experiment

`src/revocation-checkpoint.js` adds a separate bounded research primitive. It does **not** change capability authorization.

A checkpoint is a normal signed Trust Fabric envelope whose body binds:

- `completeThrough` — a historical timestamp no later than the checkpoint's own `issuedAt`;
- `revocationCount` — the exact number of revocation packets in the manifest;
- `revocationIdsDigest` — SHA-256 of the canonical sorted list of exact revocation envelope ids.

The checkpoint signer may attest only revocations signed by that same issuer. Evaluation also requires an explicit `expectedIssuer`; a valid signature from an arbitrary key is not enough.

A successful result is `REVOCATION_SET_ATTESTED_THROUGH`. It means only that the expected issuer signed a manifest which exactly matches the supplied valid revocation packets and attested that manifest complete through the named historical timestamp, while the checkpoint envelope itself remains within its signed validity window.

It does **not** establish that the verifier knows the newest global revocation state. A revocation created after `completeThrough`, or one that never reached this peer, remains unknown. The result therefore carries an explicit truth-boundary string rather than a generic `FRESH` claim.

The checkpoint fails closed when:

- the expected issuer is missing or different;
- a packet is invalid, foreign-signed, duplicated, or issued after `completeThrough`;
- the supplied packet set does not exactly match the signed manifest digest/count;
- `completeThrough` is later than checkpoint `issuedAt`;
- trusted time is unavailable;
- the checkpoint is not yet valid or has expired.

An expired checkpoint becomes `STALE_REVOCATION_CHECKPOINT`; an unknown clock becomes `HOLD_CLOCK_UNKNOWN`. Neither becomes current authorization evidence.

The experiment does not add synchronization, distribution, background discovery, global freshness, delegated checkpoint issuers, or automatic dependence from `evaluateCapability*`.

## Checkpoint lineage / local anti-rollback experiment

`src/checkpoint-lineage.js` adds a second isolated research primitive. It does **not** rewrite checkpoint packets, alter capability authorization, or provide network discovery.

A checkpoint-lineage link is a same-issuer signed Trust Fabric envelope whose body binds:

- the exact checkpoint envelope id;
- the exact predecessor link id, or `null` for sequence zero;
- a bounded monotonic sequence number.

A verifier evaluates a candidate checkpoint/link against an optional exact local retained head `{ checkpoint, link }`. The retained head is continuity memory held by that verifier; it is not a global registry and it does not prove that no newer checkpoint exists elsewhere.

Without retained history, only a valid sequence-zero link can become `LINEAGE_GENESIS_ACCEPTABLE`. A non-genesis candidate becomes `HOLD_LINEAGE_HISTORY_REQUIRED` rather than fabricating a missing chain.

With a retained head:

- the exact retained pair becomes `LINEAGE_HEAD_CURRENT`;
- the exact next sequence must point to the retained link and may become `LINEAGE_ADVANCE_ACCEPTABLE`;
- an older sequence becomes `CHECKPOINT_ROLLBACK_DETECTED`;
- a conflicting same sequence or wrong predecessor becomes `CHECKPOINT_FORK_DETECTED`;
- skipped intermediate sequences become `HOLD_LINEAGE_GAP`;
- a direct successor whose checkpoint moves `completeThrough` backward becomes `CHECKPOINT_COMPLETENESS_ROLLBACK`;
- a foreign signer cannot advance the expected issuer lineage.

This is intentionally **local anti-rollback only**. If the retained head is deleted, replaced, corrupted outside this model, or never synchronized, the verifier loses that anti-rollback memory. Two disconnected peers may retain different issuer-signed forks; this primitive exposes the conflict when compared but does not resolve consensus. A newer unseen checkpoint remains unknowable.

Checkpoint-lineage envelope time is not used as revocation freshness evidence. The lineage primitive verifies signed continuity history; `src/revocation-checkpoint.js` separately decides whether a checkpoint is temporally usable as `REVOCATION_SET_ATTESTED_THROUGH`.

## Interoperability evidence

`evidence/interop_vector_v1.json` fixes one deliberately non-secret Ed25519 seed/private key, derived public key and key id, canonical unsigned envelope bytes, SHA-256 envelope digest, signature, evaluation time, trusted-root context, and expected scoped grant result.

The reference JavaScript test reproduces every fixed value exactly and verifies the signature directly with Node's Ed25519 primitive. Any mismatch is a failure rather than something to normalize silently.

A second JavaScript implementation path exists at `independent/vector-verifier-v1.js`. It does not import `src/trust-core.js`; its test enforces that dependency boundary and independently recomputes the fixed vector's canonical bytes, key id, digest, signature result, trusted-root decision, time decision, and exact scope decision. It also refuses mutated signed bytes, an untrusted root, expiry, wrong target, and wrong action.

A third implementation path now exists in Go at `crosslang/go/vector_verifier.go`. It uses only the Go standard library and does not import or execute either JavaScript verifier. Its Go tests independently recompute the same canonical bytes, SPKI-derived key id, SHA-256 digest, Ed25519 signature result, trusted-root decision, temporal decision, and exact target/action result, while refusing bounded mutation/scope failures.

This establishes **same-repository cross-language and cross-standard-library agreement for one fixed root-capability vector**. It does not establish separately authored or third-party interoperability, broad protocol conformance, production certification, or hostile-deployment security.

## Offline truth boundary

An offline verifier cannot know facts it has never synchronized. Therefore:

- absence of a local revocation packet does not prove no newer revocation exists elsewhere;
- ancestor-chain invalidation only applies to revocation evidence actually supplied to the evaluator;
- a valid revocation checkpoint attests an exact supplied manifest only through its historical `completeThrough`; it does not prove no newer revocation exists;
- an expired checkpoint is stale and an unknown clock cannot become checkpoint freshness evidence;
- a retained checkpoint-lineage head can expose rollback only relative to that exact local memory;
- checkpoint lineage cannot discover newer unseen checkpoints, survive loss of retained state, or resolve disconnected valid forks by itself;
- `CLOCK_UNKNOWN` cannot become authorization;
- replay can be detected against local consumed evidence, but not globally across disconnected peers;
- copied private keys cannot be distinguished cryptographically from the original holder.

## Root merge gate

### Truth

- every success state names only what was measured;
- signed does not mean true;
- a valid grant does not equal a live authorized use;
- an ancestor revocation invalidates authorization through a supplied chain but does not claim the descendant capability was directly revoked;
- a checkpoint says `ATTESTED_THROUGH`, not `CURRENT_GLOBAL_STATE`;
- checkpoint lineage says locally retained continuity/rollback state, not global newest state;
- agreement among same-repository JavaScript and Go implementations does not equal third-party interoperability;
- missing time becomes `HOLD_CLOCK_UNKNOWN`;
- unresolved distributed replay and current revocation freshness remain explicit.

### Agency / non-domination

- no ambient authority from identity familiarity;
- root trust is explicit and caller-supplied;
- checkpoint evaluation requires an explicit expected issuer rather than trusting any signer by default;
- checkpoint lineage likewise requires an explicit expected issuer and cannot be advanced by a foreign signer;
- every capability is scoped and expiring;
- delegation only narrows;
- loss of ancestor authority removes downstream authority through that chain when the revocation evidence is known;
- foreign signers cannot revoke another issuer's capability or attest/advance another issuer's checkpoint state;
- one-use grants do not delegate in v0.1;
- no automatic permission escalation.

### Continuity

- donor systems are adapted, not destructively replaced;
- exact parent digests preserve delegation lineage;
- ancestor invalidation follows preserved lineage rather than rewriting descendant packets;
- old signed evidence remains independently verifiable if its key material is retained;
- checkpoint manifests bind exact revocation envelope ids instead of rewriting historical revocation packets;
- checkpoint lineage adds signed predecessor links without mutating old checkpoints;
- retained local heads expose rollback/forks instead of silently rewriting history;
- fixed vector bytes make future canonicalization drift visible rather than silently rewriting old evidence;
- evidence-only JavaScript and Go verifiers do not replace the reference runtime.

### Wisdom before speed

- v0.1 has no account system, global registry, blockchain, trust score, or automatic recovery;
- key rotation is documented before implementation;
- revocation-chain behavior is locked with local adversarial fixtures before attempting revocation distribution infrastructure;
- checkpoint semantics are isolated and falsifier-tested before any synchronization service or authorization dependency is attempted;
- checkpoint anti-rollback is first tested as local retained-state continuity instead of inventing consensus or a global service;
- ambiguous one-use delegation is refused rather than guessed;
- interoperability grew from one vector, to a separate same-language verifier, to one bounded Go verifier before any protocol service or broad compatibility claim;
- the Go verifier stays standard-library only and narrow instead of becoming a second runtime;
- unknown states fail closed rather than being filled by convenience.

Passing the roots permits a repository merge. It does not automatically declare the mechanism CANON for every AXM system.
