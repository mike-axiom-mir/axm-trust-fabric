# Public Evidence Consistency V2

Status: **FALSIFIER DEFINED BEFORE REPAIR**

## Question

Can Trust Fabric make its public README evidence summary fail CI when the machine-readable adversarial matrix and primary root-gate report have advanced but the public summary has not?

This is an evidence/governance question only. It does not change trust decisions, cryptographic semantics, donor behavior, or the protocol-case count.

## Falsifier

The experiment fails if any of the following can be true while CI remains green:

1. `evidence/adversarial_matrix.json` names one current authored protocol-case count while `README.md` publicly names another;
2. `ROOT_GATE_REPORT.md` and the README disagree on that current authored count;
3. the consistency contract names a protocol-case count different from the public summary;
4. repairing the public summary requires inflating the protocol/security evidence count with the consistency meta-test itself;
5. the repair changes trust-runtime behavior or donor boundaries.

## Bounded pass condition

PASS only if:

- the README carries the same exact current-count sentence as the primary root-gate report;
- `tests/evidence-consistency.test.js` fails when that README count sentence drifts;
- `evidence/consistency_guard_v1.json` explicitly records the public-summary check;
- the existing 84 protocol/security cases remain exactly 84 because the added check is evidence plumbing, not a new trust property;
- repository CI passes without changing trust/runtime or donor files.

## Truth boundary

A passing consistency check proves only that selected repository evidence declarations agree at one commit. It does not prove fixture completeness, semantic correctness beyond exercised cases, hostile-environment security, third-party independence, or AXM-wide CANON status.
