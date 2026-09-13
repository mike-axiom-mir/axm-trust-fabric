# Experiment — Rotation-Revocation Lineage Comparison Interoperability v1

Status: research / falsifier recorded before implementation.

## Question

Can one fixed set of exact signed rotation-revocation checkpoint histories reproduce the same bounded lineage-comparison relationships through:

1. the existing JavaScript comparator; and
2. a separate Go standard-library verifier that does not import or execute the JavaScript implementation,

without widening the result into synchronization, global freshness, fork resolution, authority transfer, or broad protocol-conformance claims?

## Falsifier first

The experiment fails if any of these occur:

1. the JavaScript and Go paths classify any fixed supplied history pair differently;
2. the Go path imports, executes, shells out to, or mechanically wraps the JavaScript comparator/reference runtime;
3. mutation of signed checkpoint/link bytes is accepted instead of failing signature verification;
4. a history with an omitted intermediate signed link is normalized into a relationship result instead of failing closed;
5. evidence signed by a predecessor different from the explicitly expected predecessor is accepted into a comparison result;
6. descendant classification occurs without an exact signed-link prefix;
7. fork evidence hides the exact common ancestor or chooses one branch as the winner;
8. different valid genesis histories are described as sharing an ancestor;
9. any result language implies discovery of unseen checkpoints/revocations, peer synchronization, global newest/current state, identity continuity, authority transfer, recovery, or consensus;
10. adding the portable vector rewrites existing runtime semantics, donor boundaries, historical packets, or existing evidence rather than adding an isolated evidence path.

## Bounded method

Freeze one deterministic test-only predecessor key and exact signed packets for:

- one genesis checkpoint/link;
- one shared direct successor checkpoint/link;
- two distinct valid sequence-two successors of that shared head;
- one distinct valid genesis checkpoint/link.

From those exact bytes, define only these fixed comparisons:

- identical history;
- right exact-prefix descent;
- left exact-prefix descent;
- fork after the exact shared sequence-one ancestor;
- conflicting genesis.

The JavaScript test must evaluate those bytes through the existing `compareKeyRotationRevocationCheckpointLineages` implementation. The Go verifier must independently canonicalize, verify Ed25519 signatures, validate checkpoint/link binding and replay continuity, and classify the same exact supplied histories using only the Go standard library.

Selected refusal evidence must also show signed-byte mutation, an omitted intermediate link, and a wrong expected predecessor fail closed in the separate Go path.

## Truth boundary

Agreement on this one fixed vector proves only same-repository portability for the supplied signed bytes and selected refusal states. It does not prove third-party interoperability, external implementation independence, broad protocol conformance, hostile-environment security, discovery of unseen state, synchronization, globally current revocation knowledge, fork resolution, winner selection, identity continuity, authority transfer, recovery, or AXM-wide CANON status.

## Root pre-check

- **Truth:** every portable result must name only a relationship visible in the exact supplied replay-valid histories.
- **Agency / non-domination:** reproducing a result grants no signer, verifier, maintainer, branch, successor, or implementation new authority.
- **Continuity:** the vector freezes exact signed historical bytes and digests; neither verifier may rewrite them or replace the existing JavaScript runtime.
- **Wisdom before speed:** test one portable fixed comparator vector before attempting synchronization, fork policy, recovery, broad conformance, or another trust primitive.

Repository merge, if later permitted by the roots and CI, is not AXM-wide CANON promotion.
