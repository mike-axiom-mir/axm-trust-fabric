# Root Gate Report — Trust Fabric v0.1

Status: candidate evidence for repository merge; not automatic CANON.

This is the primary consolidated root-gate report for the current bounded Trust Fabric v0.1 research state. Supplementary experiment reports remain useful history, but this file must track the repository's current authored evidence count and truth boundaries.

Current authored adversarial matrix: **110 bounded cases**.

A CI meta-guard checks that this count agrees with the machine-readable matrix, executable JavaScript + Go behavior fixtures, and the public README evidence count. The same guard also requires `TRUST_MODEL.md` to preserve selected bounded successor-possession and exact rotation-revocation truth boundaries already exercised by the protocol fixtures. The guard itself is evidence plumbing and is **not** counted as a protocol/security case. The rotation-revocation causality assertions extend the existing exact-revocation fixture rather than adding a new top-level counted case, so the authored matrix remains 110.

## Truth

PASS for the bounded repository state if the final published branch and CI agree.

- Signature validity remains separate from truth, safety, legal identity, identity continuity, and constitutional authority.
- Root authority is caller-supplied local policy; an arbitrary signer cannot self-authorize.
- A grant is not a live use: `AUTHORIZED_USE` still requires subject-key proof bound to the exact capability, target, and action.
- Delegation requires the complete signed parent chain and may only narrow authority.
- Known issuer-signed revocation of an ancestor invalidates authorization through the supplied descendant chain without relabeling descendants as directly revoked.
- Absence of locally supplied revocation evidence never becomes a global-freshness claim.
- Revocation checkpoints attest only the exact supplied same-issuer manifest through their historical `completeThrough` timestamp while temporally usable.
- Checkpoint lineage provides local anti-rollback only relative to exact retained signed history; losing that local history loses that protection.
- Complete-lineage comparison can classify only supplied valid histories as identical, exact-prefix descendant, fork after an exact common ancestor, or conflicting from genesis. It does not discover unseen history, prove a globally newest head, resolve consensus, or select a winner.
- Bounded key-rotation evidence proves only that an explicitly expected predecessor key signed an exact successor public key for one exact domain during one signed effective window. It does not prove same-person/device identity or automatically transfer capability/root authority.
- A bounded successor acknowledgement proves only that the exact successor key signed evidence bound to the exact accepted rotation, predecessor, successor, domain, and contained validity window.
- Successor possession does not prove human/device/legal identity continuity, transfer root/capability/revocation/checkpoint authority, or resolve a rotation fork.
- The bounded two-hop lineage experiment composes exactly one supplied `A -> B -> C` branch only when both rotations are usable, B and C each prove possession for their exact hop, B is exactly the first successor and second predecessor, the same domain is preserved, and the second rotation neither predates the first effective boundary nor outlives the first signed expiry.
- `TWO_HOP_ROTATION_LINEAGE_CONFIRMED` does not prove A/B/C are the same person/device/legal identity, transfer authority, establish a globally newest or unique branch, discover unseen rotations, generalize to arbitrary lineage length, or resolve a competing branch.
- Exact rotation-revocation evidence proves only that the same predecessor signed a revocation bound to one exact supplied rotation digest and context. A valid active exact match becomes `ROTATION_REVOKED`; unrelated or foreign packets do not spill over.
- An otherwise-authoritative exact rotation revocation whose signed `issuedAt` is earlier than the referenced rotation packet's signed `issuedAt` now fails closed as `HOLD_INVALID_ROTATION_REVOCATION_CAUSALITY`; the local creation helper refuses the same contradiction as `INVALID_ROTATION_REVOCATION_CAUSALITY`. Equal signed timestamps remain allowed.
- That causality comparison establishes only an ordering relation between two canonical timestamps already signed into the supplied packets. It does not prove either timestamp is externally true, synchronized, globally fresh, or globally ordered.
- A matching rotation revocation that expires before the referenced rotation produces `HOLD_INVALID_ROTATION_REVOCATION_WINDOW` rather than a clean withdrawal that can silently disappear before the original rotation expires.
- `KEY_ROTATION_USABLE_WITH_SUPPLIED_REVOCATION_EVIDENCE` means only that no active authoritative exact revocation was found in the evidence supplied to that evaluation. It does not prove no revocation exists elsewhere or that the rotation is globally fresh/newest.
- The revocation-aware two-hop wrapper refuses an otherwise-valid supplied lineage when either hop has a known supplied authoritative exact revocation and reports the affected hop; it does not rewrite the existing lineage evaluator or historical packets.
- Competing simultaneously usable rotations remain `ROTATION_FORK_EVIDENCE`; a successful lineage branch does not select a winner.
- Older predecessor-signed evidence remains independently verifiable and is not rewritten as successor-authored evidence.
- Same-repository JavaScript and Go implementations agree on one fixed root-capability interoperability vector; this does not establish separately authored or third-party interoperability.
- A second fixed vector freezes one exact two-hop `A -> B -> C` rotation lineage. The existing JavaScript lineage path and a separate Go standard-library path agree on that supplied success result and exact evidence digests; the Go path additionally refuses signed-byte mutation, wrong domain, and acknowledgement substitution.
- That second-vector agreement is only fixed-evidence portability. It does not prove general two-hop conformance, arbitrary-length lineage, identity continuity, authority transfer, branch freshness/uniqueness, fork resolution, external independence, or production security.
- Missing trusted time remains an explicit hold rather than invented certainty.
- The evidence consistency guard fails if the adversarial matrix count, executable authored behavior-fixture count, expected/observed matrix states, this primary report's count, the public README evidence count, or the required bounded truth boundaries in `TRUST_MODEL.md` drift apart.
- Current revocation freshness after `completeThrough`, synchronization/discovery, anti-rollback after local-state loss, disconnected-fork resolution, disconnected replay, key theft attribution, arbitrary-length rotation lineage beyond two hops, automatic successor authority integration, rotation-revocation discovery/synchronization/freshness/delegated revokers/fork policy, externally trustworthy/synchronized time, lost-key recovery, external third-party interoperability, and hostile-environment review remain unresolved.

## Agency / non-domination

PASS for the bounded repository state if the final published branch and CI agree.

- No account system, reputation score, global root registry, central trust server, blockchain, or ambient authority is introduced.
- Capabilities remain explicit, scoped, expiring, and rooted in caller-selected trust roots.
- Delegation cannot widen target, action set, time window, reuse, or delegation depth.
- Foreign signers cannot revoke another issuer's capability or rotation, attest another issuer's revocation checkpoint, or advance another issuer's checkpoint lineage.
- Key rotation requires an explicit expected predecessor and exact domain; naming a successor does not make that successor a root/capability authority automatically.
- Exact rotation revocation is limited to the predecessor that signed the exact referenced rotation; no successor, unrelated signer, verifier, or maintainer gains ambient revocation authority.
- Rotation-revocation causal ordering changes no signer authority: the timestamp comparison is evaluated only after the exact packet/predecessor/context match is established.
- Successor acknowledgement must be signed by that exact successor and remains branch-local evidence; it grants no unrelated authority.
- The two-hop lineage evaluator requires an explicit expected origin and exact domain; neither B nor C becomes an ambient root, capability issuer, revoker, checkpoint signer, or fork winner because it appears in a valid lineage.
- The revocation-aware wrapper evaluates explicit supplied revocation sets and does not create a registry, central revocation service, automatic authority transfer, or winner election.
- The JavaScript and Go interoperability paths evaluate exact supplied evidence only; reproducing a result grants no signer, verifier, implementation, or maintainer new authority.
- A rotation statement, acknowledgement, and rotation-revocation packet all use bounded signed windows and do not create permanent identity ownership.
- Checkpoint comparison and rotation comparison expose conflicts as evidence states and grant no branch/successor automatic authority.
- The consistency guard changes no trust decision and grants no actor new authority.
- No repository merge automatically changes product-level user control or promotes the mechanism to AXM-wide CANON.

## Continuity

PASS for the bounded repository state if the final published branch and CI agree.

- City Multiplayer and Collaboration Platform remain donor references only; their working invite, authority-lease, review, UI, and merge paths are not rewritten.
- Exact signed capability, revocation, checkpoint, lineage, key-rotation, successor-acknowledgement, and rotation-revocation packets remain independently verifiable historical evidence.
- Parent capability digests preserve delegation lineage; checkpoint manifests bind exact revocation envelope ids; checkpoint-lineage links bind exact predecessor ids.
- Key rotation adds successor evidence without modifying old predecessor signatures or claiming the successor authored historical bytes.
- Successor acknowledgement binds the exact rotation digest instead of rewriting the rotation or any earlier signature.
- Exact rotation revocation also binds the exact rotation digest and context instead of mutating or relabeling the referenced rotation.
- Rotation-revocation causality is evaluated from signed timestamps already present in the two immutable packets; no historical packet is edited to manufacture a consistent order.
- Two-hop rotation lineage composes four existing signed packets without modifying any of them; the continuity fixture verifies packet bytes and envelope ids remain unchanged after evaluation.
- The revocation-aware two-hop fixtures verify that rejecting a known revoked hop leaves all historical rotation and acknowledgement bytes/digests unchanged.
- The two-hop interoperability vector freezes the exact four signed packets and their digests; the separate Go verifier reads those bytes rather than rewriting the JavaScript lineage implementation.
- Forks, gaps, rollback, divergent common ancestry, competing rotations, competing second-hop branches, exact known revoked rotation hops, and predated exact revocation evidence are surfaced rather than silently normalized.
- `src/trust-core.js`, revocation-checkpoint behavior, capability authorization, donor boundaries, and existing single-hop/two-hop JavaScript rotation semantics remain unchanged by the rotation-revocation causality addition.
- Fixed interoperability bytes make serialization and cross-implementation drift visible.
- The consistency guard makes evidence-summary drift visible across machine evidence, the primary gate report, the public README, and selected bounded contracts in `TRUST_MODEL.md` without rewriting protocol history or inflating the meta-test into protocol evidence.

## Wisdom before speed

PASS for the bounded repository state if the final published branch and CI agree.

- v0.1 continues to use established Ed25519 implementations rather than inventing cryptography.
- Unknown states fail closed or remain explicit instead of being filled by convenient assumptions.
- Revocation semantics are fixture-locked before distribution/synchronization infrastructure.
- Checkpoint freshness was separated from lineage continuity before any network discovery or consensus attempt.
- Fork comparison exposes evidence before considering fork-resolution policy.
- Key rotation was introduced first as an isolated single-hop predecessor-signed evidence primitive; successor possession was added as a separate exact-rotation acknowledgement before authority integration or recovery.
- Multi-hop research advances only to exactly two supplied hops, reusing existing rotation and acknowledgement checks, requiring possession at both hops, and forbidding domain/time widening before any arbitrary-length lineage engine, discovery system, authority transfer, or recovery protocol is attempted.
- Before extending lineage length, Trust Fabric tests the smaller withdrawal question: whether one exact known rotation can be locally revoked without spillover, silent resurrection, global-freshness claims, or historical rewrite.
- Before adding revocation distribution or checkpointing, the exact revocation layer now closes the smaller signed-evidence causality gap: a revocation cannot claim to withdraw an exact rotation before that exact rotation packet was signed.
- The causal rule deliberately compares only packet-internal signed timestamps and does not invent network time, synchronization, or global ordering infrastructure.
- The exact rotation-revocation layer is separate from discovery/synchronization, delegated/threshold revocation, recovery, and fork policy rather than pretending those harder problems are solved.
- Before extending lineage length or adding policy, the exact two-hop semantics remain frozen into one portable vector and reproduced through a separate standard-library implementation path.
- Lost-key recovery remains a documented boundary rather than being fabricated from a missing predecessor.
- Interoperability remains deliberately narrow: two fixed vector families in one repository are not promoted into a broad protocol-conformance or external-independence claim.
- Evidence/governance accounting, including the public summary count and selected Trust Model truth boundaries, remains CI-bound as new protocol cases are added.

## Evidence

The current 110 authored bounded cases are composed of:

- 24 trust-core fixtures;
- 8 revocation-checkpoint fixtures;
- 10 checkpoint-lineage / local anti-rollback fixtures;
- 10 complete-lineage comparison fixtures;
- 9 bounded key-rotation fixtures;
- 9 bounded successor-possession acknowledgement fixtures;
- 10 bounded two-hop key-rotation-lineage fixtures;
- 10 exact key-rotation-revocation fixtures;
- 1 root-capability deterministic reference-vector check;
- 6 separate JavaScript root-capability verifier checks;
- 7 Go standard-library root-capability verifier checks;
- 1 JavaScript exact-two-hop lineage vector check;
- 5 Go standard-library exact-two-hop lineage verifier checks.

The 10 exact key-rotation-revocation fixtures cover:

1. an exact same-predecessor revocation invalidates the exact supplied rotation, the local helper rejects a revocation signed before that rotation packet, an externally supplied signed predated exact match fails closed as `HOLD_INVALID_ROTATION_REVOCATION_CAUSALITY`, and an equal signed `issuedAt` remains causally acceptable;
2. a foreign signer cannot revoke another predecessor's rotation;
3. an exact revocation cannot be replayed against another rotation packet with the same predecessor/successor/domain;
4. revoking an unrelated `A -> C` rotation does not revoke `A -> B`;
5. a matching revocation with a shorter signed expiry fails closed as `HOLD_INVALID_ROTATION_REVOCATION_WINDOW`;
6. a matching not-yet-valid revocation is not treated as already active;
7. absence of a supplied matching revocation remains explicitly local evidence and not a global freshness claim;
8. a known supplied first-hop revocation invalidates an otherwise-valid two-hop lineage at hop 0;
9. a known supplied second-hop revocation invalidates an otherwise-valid two-hop lineage at hop 1;
10. revocation-aware lineage evaluation preserves the exact historical rotation and acknowledgement bytes/digests.

`evidence/rotation_revocation_causality_v2.json` records the causality falsifier/result boundary and explicitly notes that the causal assertions extend fixture 1 rather than inflating the 110-case matrix.

The 10 two-hop key-rotation-lineage fixtures cover:

1. exact `A -> B -> C` composition with successor possession confirmed at both hops;
2. first-hop acknowledgement required;
3. second-hop acknowledgement required;
4. exact first-successor / second-predecessor continuity;
5. exact domain preservation;
6. refusal when the second rotation is issued before the first rotation becomes effective;
7. refusal when the second rotation outlives the first signed expiry;
8. exact binding of the second acknowledgement to the supplied second rotation;
9. trusted-time requirement;
10. successful supplied lineage leaves a competing second-hop fork unresolved while historical packet bytes and ids remain unchanged.

The 6 two-hop interoperability cases cover:

1. the published two-hop vector reproduces the JavaScript reference lineage result and exact four evidence digests;
2. the Go lineage verifier remains standard-library-only and does not import or execute the JavaScript lineage evaluator;
3. the Go path reproduces the exact published two-hop vector result and lineage identities/digests;
4. a mutation of signed lineage bytes is rejected as an invalid signature;
5. a wrong expected domain is refused;
6. a substituted acknowledgement is refused because it is not bound to the exact second rotation.

The evidence-consistency guard remains deliberately outside the 110-case protocol matrix. It checks repository accounting and report alignment:

1. matrix `test_count` equals `tests.length`;
2. matrix case ids are unique;
3. every matrix entry's `observed` equals `expected`;
4. authored JavaScript + Go behavior-fixture count equals matrix `test_count`;
5. `evidence/consistency_guard_v1.json` names the same protocol-case count and states the meta-test is not itself a protocol case;
6. this primary report states the same current count;
7. the public README states the same current count;
8. `TRUST_MODEL.md` preserves selected bounded successor-possession and exact rotation-revocation success states and explicit no-identity/no-authority/no-global-freshness boundaries.

Repository CI must run both:

```bash
npm test
cd crosslang/go && go test ./...
```

The final published PR head must pass remote CI before merge.

## Gate conclusion

The four roots permit merging the bounded exact key-rotation-revocation causality addition **only if** the final published branch, PR diff, 110-case evidence matrix, extended exact-revocation fixture, causality evidence record, `TRUST_MODEL.md`, `KEY_ROTATION.md`, public README, donor boundaries, and remote CI remain consistent with this report.

This conclusion grants no automatic release, deployment, donor migration, security certification, arbitrary-length lineage conformance, external interoperability claim, automatic successor root/capability/revocation/checkpoint authority, rotation-revocation discovery/synchronization/global freshness/delegated revocation, externally trustworthy time, fork resolution, lost-key recovery authority, global synchronization/consensus, or AXM-wide CANON status.