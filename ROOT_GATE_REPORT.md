# Root Gate Report — Trust Fabric v0.1

Status: candidate evidence for repository merge; not automatic CANON.

This is the primary consolidated root-gate report for the current bounded Trust Fabric v0.1 research state. Supplementary experiment reports remain useful history, but this file must track the repository's current authored evidence count and truth boundaries.

Current authored adversarial matrix: **75 bounded cases**.

A CI meta-guard checks that this count agrees with the machine-readable matrix and the executable JavaScript + Go behavior fixtures. The guard itself is evidence plumbing and is **not** counted as a protocol/security case.

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
- Competing simultaneously usable rotations for the same predecessor/domain are exposed as `ROTATION_FORK_EVIDENCE`; the primitive selects no winner.
- Older predecessor-signed evidence remains independently verifiable and is not rewritten as successor-authored evidence.
- Same-repository JavaScript and Go implementations agree on one fixed root-capability interoperability vector; this does not establish separately authored or third-party interoperability.
- Missing trusted time remains an explicit hold rather than invented certainty.
- The evidence consistency guard fails if the adversarial matrix count, executable authored behavior-fixture count, expected/observed matrix states, or this primary report's count drift apart.
- Current revocation freshness after `completeThrough`, synchronization/discovery, anti-rollback after local-state loss, disconnected-fork resolution, disconnected replay, key theft attribution, multi-hop rotation, automatic successor authority integration, rotation freshness/revocation, lost-key recovery, external third-party interoperability, and hostile-environment review remain unresolved.

## Agency / non-domination

PASS for the bounded repository state if the final published branch and CI agree.

- No account system, reputation score, global root registry, central trust server, blockchain, or ambient authority is introduced.
- Capabilities remain explicit, scoped, expiring, and rooted in caller-selected trust roots.
- Delegation cannot widen target, action set, time window, reuse, or delegation depth.
- Foreign signers cannot revoke another issuer's capability, attest another issuer's revocation checkpoint, or advance another issuer's checkpoint lineage.
- Key rotation requires an explicit expected predecessor and exact domain; naming a successor does not make that successor a root/capability authority automatically.
- A rotation statement expires with its signed window and does not create permanent identity ownership.
- Checkpoint comparison and rotation comparison expose conflicts as evidence states and grant no branch/successor automatic authority.
- Evidence-only JavaScript and Go verifiers remain evaluators of supplied evidence; they do not become authorities.
- The consistency guard changes no trust decision and grants no actor new authority.
- No repository merge automatically changes product-level user control or promotes the mechanism to AXM-wide CANON.

## Continuity

PASS for the bounded repository state if the final published branch and CI agree.

- City Multiplayer and Collaboration Platform remain donor references only; their working invite, authority-lease, review, UI, and merge paths are not rewritten.
- Exact signed capability, revocation, checkpoint, lineage, and key-rotation packets remain independently verifiable historical evidence.
- Parent capability digests preserve delegation lineage; checkpoint manifests bind exact revocation envelope ids; checkpoint-lineage links bind exact predecessor ids.
- Key rotation adds successor evidence without modifying old predecessor signatures or claiming the successor authored historical bytes.
- Forks, gaps, rollback, divergent common ancestry, and competing rotations are surfaced rather than silently normalized.
- `src/trust-core.js`, revocation-checkpoint behavior, capability authorization, and donor boundaries remain separable from the later research layers.
- Fixed interoperability bytes make serialization drift visible.
- The consistency guard makes evidence-summary drift visible without rewriting protocol history or inflating the adversarial-case count.

## Wisdom before speed

PASS for the bounded repository state if the final published branch and CI agree.

- v0.1 continues to use established Ed25519 implementations rather than inventing cryptography.
- Unknown states fail closed or remain explicit instead of being filled by convenient assumptions.
- Revocation semantics were fixture-locked before distribution/synchronization infrastructure.
- Checkpoint freshness was separated from lineage continuity before any network discovery or consensus attempt.
- Fork comparison exposes evidence before considering fork-resolution policy.
- Key rotation is introduced first as an isolated single-hop predecessor-signed evidence primitive with explicit falsifiers; it is not yet wired into capability/root authority, recovery, discovery, or consensus.
- Lost-key recovery remains a documented boundary rather than being fabricated from a missing predecessor.
- Interoperability remains deliberately narrow rather than being promoted into a broad protocol-conformance claim.
- Evidence/governance accounting remains CI-bound as new protocol cases are added.

## Evidence

The current 75 authored bounded cases are composed of:

- 24 trust-core fixtures;
- 8 revocation-checkpoint fixtures;
- 10 checkpoint-lineage / local anti-rollback fixtures;
- 10 complete-lineage comparison fixtures;
- 9 bounded key-rotation fixtures;
- 1 deterministic reference-vector check;
- 6 separate JavaScript verifier checks;
- 7 Go standard-library verifier checks.

The 9 key-rotation fixtures cover:

1. exact predecessor-signed successor attestation for one domain/window;
2. unknown-clock hold;
3. pre-effective-boundary refusal;
4. invalid effective window refusal;
5. foreign predecessor refusal;
6. exact successor-public-key binding;
7. exact domain isolation;
8. preservation of older predecessor signatures;
9. competing simultaneously usable rotations exposed as conflict with no winner.

The evidence-consistency guard remains deliberately outside the 75-case protocol matrix. It checks repository accounting and report alignment:

1. matrix `test_count` equals `tests.length`;
2. matrix case ids are unique;
3. every matrix entry's `observed` equals `expected`;
4. authored JavaScript + Go behavior-fixture count equals matrix `test_count`;
5. `evidence/consistency_guard_v1.json` names the same protocol-case count and states the meta-test is not itself a protocol case;
6. this primary report states the same current count.

Repository CI must run both:

```bash
npm test
cd crosslang/go && go test ./...
```

The final published PR head must pass remote CI before merge.

## Gate conclusion

The four roots permit merging the bounded single-step key-rotation experiment **only if** the final published branch, PR diff, evidence matrix, consistency guard, and remote CI remain consistent with this report.

This conclusion grants no automatic release, deployment, donor migration, security certification, external interoperability claim, automatic successor root/capability authority, rotation discovery/freshness/revocation, lost-key recovery authority, global synchronization/consensus, or AXM-wide CANON status.
