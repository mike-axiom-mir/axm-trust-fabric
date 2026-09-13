# Trust Model v0.1

## Purpose

Trust Fabric proves bounded cryptographic statements about exact bytes and exact authorization scope. It must not convert cryptographic validity into moral, factual, social, legal, or constitutional authority.

## Five independent dimensions

| Dimension | v0.1 can establish | v0.1 must not claim |
|---|---|---|
| Integrity | signed canonical bytes still match | bytes are safe, correct, or desirable |
| Authorship | holder of a private key signed the bytes | a legal/named human authored them |
| Authority | an explicitly trusted root issued a valid grant chain for an exact subject/action/target, and the subject can sign an exact use request | signer has authority outside that chain |
| Identity continuity | bounded predecessor keys may attest exact successor keys for exact domains/windows, including one supplied two-hop A -> B -> C chain when possession is confirmed at both hops | key succession proves same person/device/legal identity or automatically transfers authority |
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

## Bounded key rotation experiment

`src/key-rotation.js` adds an isolated single-step predecessor-to-successor research primitive. It does **not** rewrite capability authorization, trusted-root policy, checkpoint authority, revocation authority, or donor systems.

A rotation is a normal signed Trust Fabric envelope whose body binds exactly:

- `predecessorKeyId` — and the envelope issuer must equal it;
- `successorKeyId`;
- `successorPublicKey` — which must derive exactly to `successorKeyId`;
- `domain` — exact bounded text selected by the consuming system;
- `effectiveAt` — a canonical timestamp inside the envelope's signed validity window.

Evaluation additionally requires a caller-supplied `expectedPredecessor`, exact expected `domain`, and trusted `nowMs`. A signed packet cannot become usable before `effectiveAt`; an unknown clock becomes `HOLD_CLOCK_UNKNOWN`.

A successful result is `KEY_SUCCESSOR_ATTESTED_FOR_DOMAIN`. It means only that the explicitly expected predecessor key signed this exact successor key statement for this exact domain and bounded active window.

It does **not** establish that predecessor and successor are the same human, device, account, legal identity, or constitutional authority. It also does not automatically add the successor to `trustedRootIssuers`, transfer existing capabilities, grant revocation/checkpoint authority, or relabel old signatures as successor-authored.

Old predecessor-signed evidence remains independently verifiable against its original embedded public key.

`compareKeyRotations` evaluates two supplied packets in the same predecessor/domain/time context. The exact same packet is `ROTATIONS_IDENTICAL`. Two different simultaneously usable predecessor-signed successor statements become `ROTATION_FORK_EVIDENCE`; both packet ids remain visible and no winner is selected.

The v0.1 rotation evaluator deliberately does not implement discovery/freshness, fork resolution/consensus, automatic successor authority integration, or lost-key recovery. Exact local rotation-revocation evidence is a separate layer below.

## Exact key rotation revocation experiment

`src/key-rotation-revocation.js` adds an isolated revocation-evidence layer for one exact already-signed key-rotation packet. It does not rewrite `src/key-rotation.js`, capability authorization, trusted-root policy, checkpoint authority, donor systems, or historical rotation/acknowledgement bytes.

A rotation-revocation envelope binds exactly:

- `rotationId` — the SHA-256 envelope digest of one exact rotation packet;
- `predecessorKeyId` — and the revocation envelope issuer must equal it;
- `successorKeyId` — the successor named by that exact rotation;
- `domain` — the exact rotation domain;
- `reasonCode` — a bounded machine-readable reason.

Only the same predecessor that signed the referenced rotation can make a supplied revocation authoritative for that exact rotation. Foreign-signed or differently bound revocations do not revoke it.

A valid active exact match produces `ROTATION_REVOKED`. A matching revocation whose signed expiry is earlier than the referenced rotation expiry produces `HOLD_INVALID_ROTATION_REVOCATION_WINDOW`; this avoids treating a short-lived revocation as a clean withdrawal that silently disappears while the original rotation later remains live. A matching not-yet-valid revocation is not treated as already active.

When no active authoritative exact revocation is found, the bounded result is `KEY_ROTATION_USABLE_WITH_SUPPLIED_REVOCATION_EVIDENCE`. This means only that the revocation evidence supplied to this evaluation contains no active authoritative exact match. It **does not prove that no revocation exists elsewhere**, that the peer is synchronized, that the rotation is globally fresh/newest, or that the successor inherited authority.

The revocation-aware two-hop wrapper first requires the existing `A -> B -> C` lineage to pass unchanged. It then checks an explicit local revocation set for each hop. A known supplied exact revocation of either hop prevents the wrapper from confirming the lineage and reports the affected hop. The underlying rotations, acknowledgements, and existing lineage evaluator remain unchanged.

This experiment does not add rotation-revocation discovery/synchronization, global freshness, delegated or threshold rotation revokers, fork-interaction policy, automatic successor authority, or lost-key recovery.

## Successor possession acknowledgement experiment

`src/key-rotation-ack.js` adds an isolated possession-evidence layer after a rotation already passes the bounded key-rotation evaluation. It does not make the successor a root, capability issuer, revoker, checkpoint signer, or identity owner.

The successor signs an acknowledgement bound to the exact rotation digest, predecessor key id, successor key id, and domain. The acknowledgement issuer must equal the named successor and its signed validity window must stay inside the predecessor-signed rotation window.

A successful result is `SUCCESSOR_POSSESSION_CONFIRMED_FOR_ROTATION`. It proves control of the exact successor private key for this exact rotation evidence only.

It does not prove human, device, or legal identity continuity. It does not transfer root, capability, revocation, or checkpoint authority. It does not resolve a competing rotation fork or select a winning branch.

An acknowledgement therefore strengthens the evidence from “A named public key B” to “A named public key B and B demonstrated control of the corresponding private key for this exact bounded packet.” It still does not establish that A and B are the same actor, that B inherits unrelated authority, or that no other valid rotation branch exists.

The acknowledgement fails closed on a foreign signer, rotation-digest mismatch, predecessor/successor/domain substitution, validity-window escalation, unknown trusted time, not-yet-valid state, or expiry. Possession evidence for one branch remains branch-local evidence and cannot erase competing signed evidence.

## Bounded two-hop rotation lineage experiment

`src/key-rotation-lineage.js` composes exactly two supplied rotation/acknowledgement pairs. It does not introduce a new signer, rewrite either hop, generalize to arbitrary-length lineage, or alter root/capability/revocation/checkpoint authority.

The evaluator requires an explicit `expectedOrigin`, exact expected `domain`, trusted `nowMs`, exactly two rotations, and exactly two acknowledgements. It first proves a usable `A -> B` rotation plus B's exact acknowledgement, then requires the second rotation predecessor to be that exact B key and proves a usable `B -> C` rotation plus C's exact acknowledgement.

The second hop must preserve the same exact domain. It may not be issued before the first rotation's `effectiveAt`, and it may not expire after the first rotation's signed expiry. Those constraints prevent the supplied two-hop evidence from widening the first hop's temporal/domain boundary.

A successful result is `TWO_HOP_ROTATION_LINEAGE_CONFIRMED`.

It means only that this explicitly supplied `A -> B -> C` branch contains two currently usable predecessor-signed rotations, successor possession is confirmed at both hops, the domain is unchanged, and the second hop remains inside the first hop's effective/expiry bounds.

It does **not** prove A, B, and C are the same human, device, account, legal identity, or constitutional authority. It does not transfer root, capability, revocation, or checkpoint authority. It does not prove the supplied branch is globally newest or unique, discover an unseen rotation, resolve a competing branch, or establish arbitrary-length key continuity.

A competing `B -> C` / `B -> D` pair remains `ROTATION_FORK_EVIDENCE` under the existing comparator even when one supplied A -> B -> C branch independently passes the two-hop evaluator. No winner is selected and no historical rotation or acknowledgement bytes are rewritten.

## Interoperability evidence

`evidence/interop_vector_v1.json` fixes one deliberately non-secret Ed25519 seed/private key, derived public key and key id, canonical unsigned envelope bytes, SHA-256 envelope digest, signature, evaluation time, trusted-root context, and expected scoped grant result.

The reference JavaScript test reproduces every fixed value exactly and verifies the signature directly with Node's Ed25519 primitive. Any mismatch is a failure rather than something to normalize silently.

A second JavaScript implementation path exists at `independent/vector-verifier-v1.js`. It does not import `src/trust-core.js`; its test enforces that dependency boundary and independently recomputes the fixed vector's canonical bytes, key id, digest, signature result, trusted-root decision, time decision, and exact scope decision. It also refuses mutated signed bytes, an untrusted root, expiry, wrong target, and wrong action.

A third implementation path exists in Go at `crosslang/go/vector_verifier.go`. It uses only the Go standard library and does not import or execute either JavaScript verifier. Its Go tests independently recompute the same canonical bytes, SPKI-derived key id, SHA-256 digest, Ed25519 signature result, trusted-root decision, temporal decision, and exact target/action result, while refusing bounded mutation/scope failures.

`evidence/two_hop_rotation_lineage_interop_v1.json` adds a second fixed vector family for the exact bounded `A -> B -> C` experiment. It contains two predecessor-signed rotations and two successor-signed acknowledgements with fixed test-only keys, exact envelope digests, evaluation context, and the expected `TWO_HOP_ROTATION_LINEAGE_CONFIRMED` result.

The existing JavaScript `src/key-rotation-lineage.js` path is bound to those exact bytes by `tests/key-rotation-lineage-interop.test.js`. A separate Go standard-library path at `crosslang/go/rotation_lineage_verifier.go` independently canonicalizes and verifies the envelopes, derives key identifiers and digests, checks exact predecessor/domain/acknowledgement binding and the two-hop no-widening rule, and reproduces the same bounded success. Its tests also refuse a signed-byte mutation, wrong expected domain, and substituted acknowledgement while statically guarding against JavaScript import or execution.

This establishes **same-repository cross-language and cross-standard-library agreement for one fixed root-capability vector and one fixed two-hop rotation-lineage vector plus selected refusal states**. It does not establish separately authored or third-party interoperability, arbitrary-length lineage conformance, broad protocol conformance, production certification, identity continuity, authority transfer, branch freshness/uniqueness, fork resolution, or hostile-deployment security.

## Offline truth boundary

An offline verifier cannot know facts it has never synchronized. Therefore:

- absence of a local revocation packet does not prove no newer revocation exists elsewhere;
- ancestor-chain invalidation only applies to revocation evidence actually supplied to the evaluator;
- a valid revocation checkpoint attests an exact supplied manifest only through its historical `completeThrough`; it does not prove no newer revocation exists;
- an expired checkpoint is stale and an unknown clock cannot become checkpoint freshness evidence;
- a retained checkpoint-lineage head can expose rollback only relative to that exact local memory;
- checkpoint lineage cannot discover newer unseen checkpoints, survive loss of retained state, or resolve disconnected valid forks by itself;
- a key-rotation verifier cannot discover a rotation it never received, prove that its supplied rotation is globally newest, or resolve two valid competing rotations;
- absence of a supplied exact rotation revocation does not prove that no rotation revocation exists elsewhere or that the supplied rotation is globally fresh;
- a known supplied authoritative exact rotation revocation can invalidate that exact hop locally without making any claim about unseen rotation state;
- a valid single-hop or two-hop rotation result does not prove successor/root/capability authority beyond its exact bounded attestation;
- a confirmed two-hop branch does not prove that branch is unique, globally newest, or free of unseen competitors;
- same-repository cross-language agreement on fixed lineage bytes cannot establish unseen branch absence or current global rotation state;
- `CLOCK_UNKNOWN` cannot become authorization or active rotation evidence;
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
- key rotation says the predecessor key attested this successor for one domain/window, not that both keys are the same person/device or that successor authority is globally current;
- exact rotation revocation says only that the same predecessor revoked one exact supplied rotation packet; absence of supplied revocation evidence is not global freshness;
- successor possession says the exact named successor key controlled its private key for the exact acknowledged rotation, not that identity or authority transferred;
- two-hop rotation lineage says the exact supplied A -> B -> C evidence composed under bounded domain/time rules, not that identity/authority transferred or the branch is unique/newest;
- competing rotations are conflict evidence, not a winner election;
- agreement among same-repository JavaScript and Go implementations on fixed root-capability or two-hop-lineage vectors does not equal third-party interoperability or general conformance;
- missing time becomes `HOLD_CLOCK_UNKNOWN`;
- unresolved distributed replay, current revocation freshness, rotation-revocation synchronization/freshness, arbitrary-length lineage, and lost-key recovery remain explicit.

### Agency / non-domination

- no ambient authority from identity familiarity;
- root trust is explicit and caller-supplied;
- checkpoint evaluation requires an explicit expected issuer rather than trusting any signer by default;
- checkpoint lineage likewise requires an explicit expected issuer and cannot be advanced by a foreign signer;
- key rotation requires an explicit expected predecessor and exact domain; naming a successor grants no unrelated authority;
- exact rotation revocation requires the same predecessor that signed the exact referenced rotation; foreign keys gain no revocation power;
- successor possession acknowledgement grants no root, capability, revocation, checkpoint, or fork-selection authority;
- two-hop lineage requires an explicit origin and does not make B or C ambient authorities outside the supplied lineage evidence;
- interoperability verifiers only evaluate supplied evidence and gain no authority from reproducing a result;
- every capability is scoped and expiring;
- delegation only narrows;
- loss of ancestor authority removes downstream authority through that chain when the revocation evidence is known;
- foreign signers cannot revoke another issuer's capability or rotation, or attest/advance another issuer's checkpoint state;
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
- key rotation adds bounded successor evidence without rewriting old signatures or pretending the successor authored old bytes;
- exact rotation revocation binds one exact rotation digest and invalidates use of that supplied hop without rewriting the rotation or acknowledgement bytes;
- successor acknowledgement binds the exact rotation digest without rewriting the predecessor rotation or older evidence;
- two-hop rotation lineage composes exact existing rotation/acknowledgement packets and leaves every packet independently verifiable and byte-identical;
- the two-hop interoperability vector freezes exact signed lineage bytes/digests so implementation drift becomes visible rather than silently normalized;
- competing rotations remain visible as distinct signed evidence;
- fixed vector bytes make future canonicalization drift visible rather than silently rewriting old evidence;
- evidence-only JavaScript and Go verifiers do not replace the reference runtime.

### Wisdom before speed

- v0.1 has no account system, global registry, blockchain, trust score, or automatic recovery;
- key rotation began as a documented contract and is implemented only as an isolated single-hop attestation before any authority integration or recovery mechanism;
- successor possession remains a separate bounded acknowledgement layer before authority integration or recovery;
- rotation lineage advances only to exactly two hops with possession required at both hops, rather than jumping to arbitrary chain length, discovery, recovery, or consensus;
- exact rotation revocation is added as a separate local-evidence layer before extending lineage length, building revocation distribution, or inventing recovery/fork policy;
- revocation-chain behavior is locked with local adversarial fixtures before attempting revocation distribution infrastructure;
- checkpoint semantics are isolated and falsifier-tested before any synchronization service or authorization dependency is attempted;
- checkpoint anti-rollback is first tested as local retained-state continuity instead of inventing consensus or a global service;
- ambiguous one-use delegation is refused rather than guessed;
- interoperability grew from one root-capability vector, to a separate same-language verifier, to a bounded Go verifier, and only then to one exact two-hop-lineage vector with a separate Go path before any arbitrary-lineage or broad compatibility claim;
- the Go verifiers stay standard-library only and evidence-scoped instead of becoming second production runtimes;
- unknown states fail closed rather than being filled by convenience.

Passing the roots permits a repository merge. It does not automatically declare the mechanism CANON for every AXM system.
