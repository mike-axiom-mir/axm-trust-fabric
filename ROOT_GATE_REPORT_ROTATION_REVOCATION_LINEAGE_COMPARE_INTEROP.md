# Root Gate Report — Rotation-Revocation Lineage Comparator Portability v1

Status: candidate supplemental evidence for repository merge; not automatic CANON.

## Question tested

Can the already-bounded complete rotation-revocation checkpoint-lineage comparator be reproduced from one fixed deterministic signed-history vector by a separate Go standard-library path without importing/executing the JavaScript comparator, and without widening the claim into discovery, synchronization, global freshness, fork resolution, authority transfer, recovery, or broad conformance?

The falsifier was recorded first in `experiments/ROTATION_REVOCATION_LINEAGE_COMPARE_INTEROP_V1.md`.

## Exact bounded delta

This experiment adds:

- one deterministic test-only vector at `evidence/rotation_revocation_lineage_compare_interop_v1.json`;
- one JavaScript vector-binding check that reconstructs exact checkpoint/link packets, requires the published signatures/digests, and evaluates them through the existing comparator;
- one separate Go standard-library comparator verifier plus five supplemental Go checks;
- machine-readable portability evidence;
- explicit supplemental-evidence accounting in the evidence consistency guard;
- interoperability documentation.

It does **not** modify `src/trust-core.js`, `src/key-rotation-revocation-checkpoint.js`, `src/key-rotation-revocation-checkpoint-lineage.js`, `src/key-rotation-revocation-checkpoint-lineage-compare.js`, capability authorization, key-rotation/revocation semantics, donor mappings, signed historical evidence, or the 130-case protocol matrix.

The JavaScript + Go portability checks are supplemental because they reproduce already-bounded comparator relationships and selected refusal states through another implementation path; they do not introduce a new Trust Fabric protocol success state.

## Evidence

The fixed vector freezes one test-only predecessor key and exact deterministic checkpoint/link signatures/digests for:

- one genesis history;
- one shared direct successor;
- two distinct valid sequence-two successors of that shared head;
- one distinct valid genesis history.

Both implementation paths are required to reproduce:

1. `ROTATION_REVOCATION_LINEAGES_IDENTICAL`;
2. `ROTATION_REVOCATION_RIGHT_DESCENDS_FROM_LEFT`;
3. `ROTATION_REVOCATION_LEFT_DESCENDS_FROM_RIGHT`;
4. `ROTATION_REVOCATION_LINEAGE_FORK_EVIDENCE` with the exact common ancestor and first divergent links;
5. `ROTATION_REVOCATION_LINEAGE_GENESIS_CONFLICT` with no invented common ancestor.

The separate Go path also checks:

- no JavaScript/reference-runtime import or execution;
- signed-byte mutation refusal;
- omitted-intermediate history refusal as gap evidence;
- wrong explicitly expected predecessor refusal.

The existing JavaScript runtime comparator is not copied or rewritten into the Go path. The Go verifier independently checks canonical envelope bytes, SPKI-derived Ed25519 issuer identity, signatures, exact checkpoint/link binding, replay continuity, previous-link continuity, monotonic `completeThrough`, and signed-link prefix/divergence relationships using only the Go standard library plus existing same-package canonical evidence helpers.

Repository CI must pass both:

```bash
npm test
cd crosslang/go && go test ./...
```

on the exact final published PR head before merge.

## Truth

**PASS if final exact-head CI remains green.**

- Agreement proves only same-repository portability for the exact supplied fixed vector and selected refusal states.
- Exact-prefix descent remains a relationship between supplied replay-valid histories, not a globally newest/current-state claim.
- Fork evidence preserves the exact common ancestor and first divergent links; it elects no winner.
- Genesis conflict invents no common ancestor.
- Mutation/gap/wrong-predecessor evidence fails closed rather than being normalized.
- The result is not third-party interoperability, broad conformance, external independence, discovery, synchronization, global freshness, production security, or hostile-environment review.

## Agency / non-domination

**PASS if final exact-head CI remains green.**

- Reproducing a classification grants no signer, verifier, implementation, maintainer, branch, successor, or peer new authority.
- The expected predecessor remains explicit caller-supplied context.
- No fork winner, checkpoint authority, revocation authority, root authority, capability authority, recovery power, or consensus role is introduced.
- The deterministic private key is test-only evidence and must never become real authority.

## Continuity

**PASS if final exact-head CI remains green.**

- Existing JavaScript comparator/runtime behavior remains unchanged.
- Fixed signatures/digests make canonicalization or packet drift visible rather than silently normalized.
- The Go path is evidence-only and does not replace the reference runtime.
- Donor boundaries remain untouched.
- Historical checkpoint/link packets are compared by exact immutable digests; no packet is rewritten to manufacture continuity.
- The authored protocol matrix remains 130 cases; supplemental portability evidence is explicitly accounted rather than silently inflating or hiding the matrix.

## Wisdom before speed

**PASS if final exact-head CI remains green.**

- Portability of the already-tested comparator is checked before adding another trust primitive, synchronization service, fork policy, or recovery mechanism.
- The separate path uses established standard-library Ed25519/SHA-256 support rather than inventing cryptography.
- The experiment stays on one fixed vector and selected refusal states rather than claiming general conformance.
- External or separately authored reproduction remains the next meaningful interoperability boundary; more same-repository vectors must not be mistaken for independence.

## Gate conclusion

The four roots permit repository merge only if the final PR diff remains bounded as described, overlap is re-scanned, exact-head Node + Go CI is green, donor/runtime boundaries remain unchanged, and the published evidence/docs retain the no-global-state/no-winner/no-authority/no-external-conformance boundaries above.

Repository merge does not automatically release, deploy, migrate donors, certify security, establish external interoperability, choose a fork, synchronize peers, recover lost state/keys, or promote the mechanism to AXM-wide CANON.
