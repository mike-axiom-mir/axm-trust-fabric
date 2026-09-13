# Experiment — Key Rotation Revocation Checkpoint Lineage Comparison v1

Status: research / falsifier recorded before implementation.

## Question

Given two complete signed key-rotation-revocation checkpoint lineages for one explicitly expected predecessor, can a verifier classify only what the supplied histories prove:

- byte-identical lineage;
- one complete lineage is a verified exact-prefix descendant of the other;
- the two complete lineages diverge after an exact common ancestor;
- or they conflict from genesis;

without selecting a winner, claiming discovery of unseen checkpoints/revocations, or claiming either supplied head is globally newest/current?

## Falsifier first

The experiment fails if any of these occur:

1. an invalid or incomplete lineage is normalized into a comparison result;
2. a foreign predecessor can participate in a lineage for the explicitly expected predecessor;
3. a missing intermediate link, sequence gap, wrong predecessor, checkpoint/link binding mismatch, link-before-checkpoint contradiction, or `completeThrough` regression is ignored;
4. two divergent valid histories are reported as ancestor/descendant;
5. ancestor/descendant is reported without an exact shared prefix of signed link envelope ids;
6. a fork result hides the exact common ancestor when one exists;
7. different valid genesis links are described as sharing an ancestor;
8. comparison chooses one valid fork as authoritative or preferred;
9. result language implies either supplied head is globally newest/current or that unseen revocations/checkpoints do not exist;
10. comparison changes rotation validity, revocation validity, capability authorization, retained local lineage state, donor behavior, or historical checkpoint/link bytes.

## Bounded method

A complete supplied lineage is an ordered array of exact `{ checkpoint, link }` pairs from sequence zero through its supplied head.

Each lineage must first be independently replay-validated using the existing `evaluateKeyRotationRevocationCheckpointLineage` rules:

- sequence zero establishes only local genesis for the supplied history;
- every later pair must be the exact next signed predecessor-linked advance;
- checkpoint and link issuer must equal caller-supplied `expectedPredecessor`;
- exact checkpoint/link binding and signature verification must pass;
- link issuance may not predate the checkpoint it names;
- `completeThrough` may not move backward.

Only after both complete histories pass may exact link envelope ids be compared.

## Allowed comparison states

- `ROTATION_REVOCATION_LINEAGES_IDENTICAL` — every supplied link id is identical and both histories have the same length.
- `ROTATION_REVOCATION_RIGHT_DESCENDS_FROM_LEFT` — the entire left supplied valid history is an exact prefix of the right.
- `ROTATION_REVOCATION_LEFT_DESCENDS_FROM_RIGHT` — the entire right supplied valid history is an exact prefix of the left.
- `ROTATION_REVOCATION_LINEAGE_FORK_EVIDENCE` — both valid histories share an exact prefix and then diverge; return the exact common ancestor plus both first divergent links.
- `ROTATION_REVOCATION_LINEAGE_GENESIS_CONFLICT` — both histories are individually valid for the expected predecessor but sequence-zero links differ, so no supplied common ancestor exists.

Invalid or incomplete evidence must fail closed as `HOLD_INVALID_ROTATION_REVOCATION_LINEAGE_EVIDENCE` rather than enter a relationship state.

## Truth boundary

This compares only the two complete signed histories supplied to this call. It does not discover another checkpoint lineage or revocation, prove either supplied head globally newest/current, establish peer synchronization, resolve consensus, infer signer intent, choose a winning fork, survive loss of retained state, transfer identity/authority, or validate referenced rotations beyond existing checkpoint contracts.

A descendant result means only exact signed-prefix extension between the two supplied valid histories. A fork result means only divergence in the supplied valid histories after the returned exact common ancestor.

## Root pre-check

- **Truth:** relationship labels name only exact supplied signed-history relationships.
- **Agency / non-domination:** no comparison state grants revocation/checkpoint/capability/root authority or elects a winner.
- **Continuity:** exact historical checkpoint/link packets remain unchanged and common ancestry is expressed through their existing signed envelope ids.
- **Wisdom before speed:** compare explicit evidence before adding discovery, synchronization, retained-state recovery, fork resolution, consensus, or global ordering.

Repository merge, if later permitted by the roots and CI, is not AXM-wide CANON promotion.
