# Falsifier First — Rotation-Revocation Lineage Comparison Trust-Model Guard v2

## Question

Can the repository mechanically prevent the bounded complete-history comparator from being silently described as discovery, synchronization, global freshness, fork resolution, winner selection, authority transfer, or retained-state recovery?

## Falsifier

This experiment fails if any of the following can occur while the evidence-consistency CI guard still passes:

1. `TRUST_MODEL.md` omits that the comparator evaluates only two explicitly supplied complete signed rotation-revocation checkpoint histories for one explicit expected predecessor.
2. `TRUST_MODEL.md` omits the bounded relationship states: identical, exact-prefix descent, fork after an exact common ancestor, or conflicting genesis.
3. `TRUST_MODEL.md` may describe a descendant as globally newest/current, synchronized, authoritative, or preferred without the guard failing.
4. `TRUST_MODEL.md` may imply that the comparator discovers unseen checkpoints/revocations, resolves consensus/forks, chooses a winner, survives retained-state loss, transfers identity/authority, or validates referenced rotations beyond the existing checkpoint contract without the guard failing.
5. The repair changes runtime protocol behavior, authored protocol-case count, donor boundaries, historical signed evidence, or promotes repository state to AXM-wide CANON.

## Bounded success condition

Success requires only a documentation/evidence-plumbing change: add an explicit comparator truth-boundary section to `TRUST_MODEL.md`, add exact required phrases to `evidence/consistency_guard_v1.json`, and align `ROOT_GATE_REPORT.md`. The existing generic evidence-consistency test should then fail if those required phrases drift or disappear.

No new protocol/security case is claimed. The authored matrix must remain 130.
