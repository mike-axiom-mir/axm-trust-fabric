# Root Gate Report — Rotation-Revocation Lineage Comparison Trust-Model Guard

Status: bounded repository evidence only; not automatic AXM-wide CANON.

## Question tested

Can the already-exercised complete rotation-revocation checkpoint-lineage comparator be bound into the primary Trust Model and evidence-consistency CI so documentation cannot silently widen it into discovery, synchronization, global freshness, fork resolution, winner selection, authority transfer, or retained-state recovery?

## Falsifier evidence

The falsifier was recorded first in `experiments/KEY_ROTATION_REVOCATION_CHECKPOINT_LINEAGE_COMPARE_TRUST_MODEL_GUARD_V2.md`.

The guard was then extended before the Trust Model was repaired. Commit `ff9991b0cf25e127f21bb36c82cd73c2538e63c4` failed the repository workflow as intended because the newly required comparator truth-boundary phrases were absent. That failure is evidence that documentary drift is mechanically detectable rather than merely discouraged.

## Exact delta

- Add a dedicated comparator section to `TRUST_MODEL.md` describing only two explicitly supplied complete signed histories for one explicit expected predecessor.
- Lock the five bounded relationship states: identical, exact-prefix descent in either direction, fork after an exact common ancestor, and conflicting genesis.
- Lock the explicit no-claim boundaries: no unseen-state discovery, global-newest/current claim, peer synchronization, consensus/fork resolution, winner selection, retained-state-loss recovery, identity/authority transfer, or referenced-rotation validation beyond the existing checkpoint contract.
- Extend `evidence/consistency_guard_v1.json` so the existing generic evidence-consistency test fails if those phrases drift or disappear.
- Keep authored protocol/security evidence at **130 bounded cases**. This is evidence/governance plumbing, not a new protocol property.
- Leave runtime protocol code, schemas, donor boundaries, historical signed packets, capability authorization, checkpoint/revocation semantics, and cross-language verifiers unchanged.

## Four-root gate

### Truth — PASS if final CI is green

The comparator can only classify relationships among the two supplied replay-valid histories. Exact-prefix descent is not global freshness. Fork evidence is not winner election. The guard makes those documentary limits machine-checkable.

### Agency / non-domination — PASS if final CI is green

No signer, verifier, maintainer, predecessor, branch, or comparator gains new capability, revocation, checkpoint, identity, synchronization, or branch-selection authority.

### Continuity — PASS if final CI is green

No runtime semantics or signed historical evidence changes. The comparator remains evidence-only, donor systems remain untouched, and the 130-case accounting is preserved.

### Wisdom before speed — PASS if final CI is green

The already-tested comparator contract is locked into the primary model before adding branch-selection policy, discovery, synchronization, consensus, or recovery machinery.

## Canon boundary

Repository merge, if permitted by final evidence and CI, does not promote this mechanism to AXM-wide CANON.
