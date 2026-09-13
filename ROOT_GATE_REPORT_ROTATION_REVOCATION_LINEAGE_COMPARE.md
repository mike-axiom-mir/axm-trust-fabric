# Root Gate Report — rotation-revocation checkpoint-lineage comparison v1

Status: candidate evidence for repository merge; not automatic CANON.

This report supplements `ROOT_GATE_REPORT.md` for one isolated bounded comparison experiment. It does not replace the existing exact-rotation-revocation, historical rotation-revocation checkpoint, retained-head checkpoint-lineage, capability authorization, interoperability, or donor-boundary evidence.

## Question tested

Can Trust Fabric compare two **complete explicitly supplied signed key-rotation-revocation checkpoint histories** for one explicitly expected predecessor and classify only exact identity, exact-prefix descent, fork after an exact common ancestor, or different valid genesis — without selecting a winner or claiming discovery, synchronization, or globally newest/current revocation state?

The falsifier was recorded first in `experiments/KEY_ROTATION_REVOCATION_CHECKPOINT_LINEAGE_COMPARE_V1.md` before implementation.

## Exact delta

- add `src/key-rotation-revocation-checkpoint-lineage-compare.js` as an evidence-only comparator over existing immutable checkpoint/link packets;
- extend the existing final rotation-revocation checkpoint-lineage adversarial fixture with complete-history comparison assertions rather than inflating authored-case accounting;
- add `evidence/rotation_revocation_checkpoint_lineage_compare_v1.json`;
- add the falsifier-first experiment and this supplementary root-gate report.

The comparator reuses `evaluateKeyRotationRevocationCheckpointLineage` for complete replay validation. It does not change `src/trust-core.js`, `src/key-rotation-revocation.js`, `src/key-rotation-revocation-checkpoint.js`, `src/key-rotation-revocation-checkpoint-lineage.js`, capability authorization, trusted-root policy, schemas, Go verifier paths, or either donor boundary.

The authored protocol/security matrix remains **130 bounded cases**. Comparison assertions extend the already-counted `key_rotation_revocation_checkpoint_lineage_authority_binding_boundaries` fixture; the new assertions are not represented as additional independent top-level protocol cases.

## Truth

PASS for the bounded claim if the final published branch and remote CI agree.

- Each supplied history is replay-validated from sequence-zero genesis through its supplied head before relationship classification.
- Missing intermediate history, sequence gaps, wrong predecessors, foreign predecessors, binding contradictions, link-before-checkpoint contradictions, and `completeThrough` regression fail closed through the existing lineage rules.
- Descendant states require an exact shared prefix of signed link-envelope ids.
- Fork evidence returns the exact common ancestor and both first divergent signed links.
- Different valid genesis links become `ROTATION_REVOCATION_LINEAGE_GENESIS_CONFLICT`; no common ancestor is fabricated.
- The truth boundary explicitly refuses unseen-history, globally-newest/current, synchronization, consensus, signer-intent, or winner claims.

## Agency / non-domination

PASS for the bounded claim if the final published branch and remote CI agree.

- Comparison requires the caller's explicit `expectedPredecessor`.
- A foreign signer cannot enter a valid supplied lineage for that predecessor.
- Identity, descendant, fork, and genesis-conflict labels are evidence relationships only; none grants root, capability, revocation, checkpoint, successor, maintainer, or branch-selection authority.
- The comparator does not introduce a registry, network service, reputation layer, account layer, automatic winner, or permission escalation.

## Continuity

PASS for the bounded claim if the final published branch and remote CI agree.

- Existing checkpoint/link packets are not rewritten, relabeled, migrated, or replaced.
- Common ancestry and divergence are expressed only through exact existing signed envelope ids.
- The existing retained-head evaluator remains unchanged; comparison is a separate supplied-history evidence path.
- Existing donor boundaries remain unchanged: City Multiplayer's working invite path and Collaboration Platform's workflow-specific review/merge policy are not absorbed into Trust Fabric.
- Repository merge does not silently promote this experiment to AXM-wide CANON.

## Wisdom before speed

PASS for the bounded claim if the final published branch and remote CI agree.

- The experiment compares explicit evidence before adding discovery, synchronization, retained-state recovery, fork-resolution policy, consensus, or global ordering.
- It reuses the existing checkpoint-lineage validator instead of inventing a second continuity rule set.
- Invalid or incomplete histories hold before comparison.
- Conflicts remain visible rather than being normalized into a convenient winner.
- Evidence accounting remains at 130 rather than treating multiple assertions inside one existing fixture as independent new security cases.

## Verification requirement

The final branch and exact PR head must pass both repository verification paths:

```bash
npm test
cd crosslang/go && go test ./...
```

The PR must be re-scanned for overlapping open work immediately before publication. Merge is permitted only when the exact final PR head, remote CI, diff, evidence accounting, and this four-root report agree.

## Unknowns preserved

- discovery of checkpoint histories or revocations not supplied to comparison;
- synchronization and globally current rotation-revocation freshness;
- anti-rollback after retained local state is absent, lost, replaced, or corrupted outside this model;
- fork resolution or consensus across disconnected valid histories;
- delegated or threshold checkpoint signers;
- trustworthy external time;
- arbitrary rotation lineage beyond the existing bounded two-hop experiment;
- lost-key recovery and copied/stolen-key attribution;
- third-party interoperability and hostile-environment cryptographic review.

## Gate conclusion

The four roots permit repository merge **only if** the final exact PR head passes remote CI and the published diff remains bounded to the evidence relationship described here.

That permission grants no global-newest claim, fork winner, synchronization service, release, deployment, donor migration, security certification, or AXM-wide CANON status.
