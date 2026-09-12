# Experiment — Checkpoint Lineage Comparison v1

Status: research / falsifier recorded before implementation.

## Question

Given two complete signed checkpoint lineages for one explicitly expected issuer, can a verifier classify only what the supplied histories prove:

- byte-identical lineage;
- one complete lineage is a verified descendant of the other;
- the two complete lineages diverge after an exact common ancestor;
- or they conflict from genesis;

without automatically selecting a winner or claiming knowledge of an unseen newer lineage?

## Falsifier first

The experiment fails if any of these occur:

1. an invalid or incomplete lineage is normalized into a comparison result;
2. a foreign issuer can participate in a lineage for the expected issuer;
3. a missing predecessor, sequence gap, wrong predecessor, or `completeThrough` regression is ignored;
4. two divergent histories are reported as ancestor/descendant;
5. an ancestor/descendant relationship is reported without an exact shared prefix of signed link ids;
6. a fork result hides the exact common ancestor when one exists;
7. two different genesis links are described as having a common ancestor;
8. the comparison automatically chooses one valid fork as authoritative;
9. the result implies that either supplied head is globally newest;
10. the comparison changes capability authorization, donor behavior, checkpoint bytes, or retained local lineage state.

## Bounded method

A complete lineage is supplied as an ordered array of exact `{ checkpoint, link }` pairs from sequence zero through its head.

Each lineage is independently replay-validated using the existing checkpoint-lineage rules:

- sequence zero must establish local genesis;
- each later pair must be the exact next signed predecessor-linked advance;
- issuer must equal the caller-supplied `expectedIssuer`;
- checkpoint/link binding and signature verification must pass;
- `completeThrough` must not regress.

Only after both supplied histories pass that validation may their exact link-envelope ids be compared.

## Allowed comparison states

- `LINEAGES_IDENTICAL` — every supplied link id is identical and both histories have the same length.
- `RIGHT_DESCENDS_FROM_LEFT` — the entire left history is an exact prefix of the right history.
- `LEFT_DESCENDS_FROM_RIGHT` — the entire right history is an exact prefix of the left history.
- `LINEAGE_FORK_EVIDENCE` — both histories share an exact prefix and then diverge; return the exact common ancestor evidence and both first divergent links.
- `LINEAGE_GENESIS_CONFLICT` — both histories are individually valid for the expected issuer but their sequence-zero links differ, so there is no supplied common ancestor.

Invalid/incomplete evidence must fail closed rather than enter those states.

## Truth boundary

This compares only the two complete signed histories supplied to this call. It does not discover another lineage, prove either head globally newest, decide consensus, infer signer intent, or choose a winning fork.

A descendant classification means only that one supplied valid history is an exact signed-prefix extension of the other. A fork classification means only that the supplied valid histories diverge after the returned exact common ancestor.

## Root pre-check

- **Truth:** classification names only relationships proven by exact supplied signed history.
- **Agency / non-domination:** no comparison state grants authority or elects a winner.
- **Continuity:** exact historical packets remain unchanged; common ancestry is expressed by their existing signed ids.
- **Wisdom before speed:** compare evidence before inventing fork resolution, consensus, networking, or global ordering.

Repository merge, if later permitted by the roots and CI, is not AXM-wide CANON promotion.
