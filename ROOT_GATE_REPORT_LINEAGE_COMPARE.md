# Root Gate Report — checkpoint-lineage comparison v1

Status: candidate evidence for repository merge; not automatic CANON.

This report supplements `ROOT_GATE_REPORT.md` for the isolated complete-lineage comparison experiment. It does not replace the earlier trust-core, revocation-checkpoint, or retained-head lineage evidence.

## Question tested

Can Trust Fabric compare two **complete supplied signed checkpoint histories** and prove only one of these bounded relationships: exact identity, exact-prefix descent, fork after an exact common ancestor, or different valid genesis — without selecting a winner or claiming either supplied head is globally newest?

## Truth

PASS for the bounded claim if the final branch and CI agree.

- Each supplied lineage is replay-validated from signed sequence-zero genesis through its head using the existing checkpoint-lineage rules before comparison.
- Missing history, gaps, wrong predecessors, foreign issuers, and `completeThrough` regression fail closed as invalid comparison evidence.
- Descendant states require an exact shared prefix of signed link-envelope ids.
- Fork evidence returns the exact common ancestor and both first divergent signed links.
- Different valid sequence-zero links become `LINEAGE_GENESIS_CONFLICT`; no common ancestor is invented.
- The truth boundary explicitly refuses global-newest, unseen-history, consensus, intent, or winner claims.

## Agency / non-domination

PASS for the bounded claim if the final branch and CI agree.

- Comparison requires the caller's explicit `expectedIssuer`.
- A foreign issuer cannot enter a valid comparison history for that expected issuer.
- `LINEAGE_FORK_EVIDENCE` and `LINEAGE_GENESIS_CONFLICT` are evidence states only; neither grants authority to either branch.
- No automatic winner, permission escalation, root migration, account system, reputation layer, or network authority is introduced.

## Continuity

PASS for the bounded claim if the final branch and CI agree.

- Existing checkpoint and checkpoint-lineage packets are not rewritten.
- Comparison uses their exact signed ids and preserved predecessor structure.
- The exact common ancestor is reported rather than collapsing divergent history.
- `src/trust-core.js`, `src/revocation-checkpoint.js`, `src/checkpoint-lineage.js`, and both donor boundary files remain unchanged.
- Repository merge does not silently promote this experiment to AXM-wide CANON.

## Wisdom before speed

PASS for the bounded claim if the final branch and CI agree.

- The experiment compares supplied evidence before adding fork resolution, consensus, synchronization, global ordering, or discovery.
- It reuses the existing signed-envelope and lineage validators rather than inventing a second continuity rule set.
- Invalid histories hold before relationship classification.
- Conflict remains visible rather than being normalized into a convenient winner.

## Evidence

Merged baseline: 56 bounded authored cases.

This branch adds 10 checkpoint-lineage comparison fixtures:

1. identical complete histories -> `LINEAGES_IDENTICAL`;
2. exact left prefix -> `RIGHT_DESCENDS_FROM_LEFT`;
3. exact right prefix -> `LEFT_DESCENDS_FROM_RIGHT`;
4. valid divergence after shared history -> `LINEAGE_FORK_EVIDENCE` with exact common ancestor;
5. different valid genesis -> `LINEAGE_GENESIS_CONFLICT` with no invented ancestor;
6. omitted intermediate link -> `HOLD_INVALID_LINEAGE_EVIDENCE` / `HOLD_LINEAGE_GAP`;
7. wrong predecessor -> `HOLD_INVALID_LINEAGE_EVIDENCE` / `CHECKPOINT_FORK_DETECTED`;
8. foreign issuer -> `HOLD_INVALID_LINEAGE_EVIDENCE` / `CHECKPOINT_LINEAGE_ISSUER_MISMATCH`;
9. `completeThrough` regression -> `HOLD_INVALID_LINEAGE_EVIDENCE` / `CHECKPOINT_COMPLETENESS_ROLLBACK`;
10. missing expected issuer -> `HOLD_EXPECTED_ISSUER_REQUIRED`.

Total authored matrix if merged: **66 bounded cases**.

Repository CI must run both:

```bash
npm test
cd crosslang/go && go test ./...
```

The final published PR head must pass remote CI before merge.

## Unknowns preserved

- no discovery of histories not supplied to the comparison;
- no proof of globally newest checkpoint head;
- no automatic fork resolution or consensus;
- no synchronization/distribution protocol;
- no anti-rollback after retained local state is lost;
- no globally current revocation knowledge;
- no trusted-time solution;
- no key-theft attribution or key recovery;
- no third-party conformance or hostile-deployment security claim.

## Gate conclusion

The four roots permit merging this bounded comparison experiment **only if** the final published branch, PR diff, and remote CI remain consistent with this report.

That permission grants no automatic fork winner, synchronization service, release, deployment, donor migration, security certification, or AXM-wide CANON status.
