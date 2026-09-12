# Experiment — checkpoint lineage v1

Status: falsifier-first research lane. Not automatic CANON.

## Question

Can a verifier that already retains one accepted checkpoint head refuse a valid-but-older checkpoint rollback, while still admitting that it cannot know about a newer checkpoint it has never received?

## Falsifier

This experiment fails if any of the following is true:

- an older valid checkpoint can replace a retained newer lineage head without an explicit rollback result;
- a same-sequence conflicting checkpoint is silently accepted instead of exposed as a fork;
- a candidate can skip unknown lineage links and still be treated as continuous;
- a successor can point at something other than the exact retained predecessor link;
- a successor can reduce the issuer-attested `completeThrough` boundary and still be accepted as monotonic progress;
- a foreign signer can advance another issuer's retained lineage;
- the implementation claims that a retained local head proves no newer checkpoint exists elsewhere.

## Smallest bounded design

Do not rewrite the existing revocation checkpoint packet. Add a separate same-issuer signed link envelope that binds:

- the exact checkpoint envelope id;
- the exact predecessor link id, or `null` for genesis;
- a bounded monotonic sequence number.

Evaluation receives the candidate checkpoint/link plus an optional retained local head `{ checkpoint, link }`. A retained head is local continuity memory, not global discovery.

Expected bounded outcomes:

- `LINEAGE_GENESIS_ACCEPTABLE` for a valid sequence-0 genesis when no head is retained;
- `LINEAGE_ADVANCE_ACCEPTABLE` only for the exact next sequence linked to the retained head with non-regressing `completeThrough`;
- `LINEAGE_HEAD_CURRENT` when the presented candidate is the exact retained head;
- `CHECKPOINT_ROLLBACK_DETECTED` for an older sequence;
- `CHECKPOINT_FORK_DETECTED` for conflicting same-sequence or wrong-predecessor evidence;
- `HOLD_LINEAGE_GAP` when intermediate links are missing;
- `CHECKPOINT_COMPLETENESS_ROLLBACK` if a linked successor moves `completeThrough` backward;
- explicit issuer mismatch for foreign advancement.

## Truth boundary

This can only make rollback detectable relative to local lineage state that the verifier actually retained. If that state is deleted, replaced, never synchronized, or a newer checkpoint exists elsewhere but was never received, this experiment cannot discover that fact. It adds no network service, consensus, trusted timestamping, global freshness, or recovery mechanism.
