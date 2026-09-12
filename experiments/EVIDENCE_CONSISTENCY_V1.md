# Evidence Consistency Guard v1

Status: bounded repository-integrity experiment; not protocol semantics and not AXM-wide CANON.

## Question

Can Trust Fabric make drift between its executable authored evidence, machine-readable adversarial matrix, and primary root-gate report fail CI instead of remaining silently green?

## Observed gap before implementation

On `main`, the machine-readable adversarial matrix records **66 bounded cases**, including the checkpoint-lineage comparison suite, while `ROOT_GATE_REPORT.md` still describes the earlier 56-case retained-head lineage state. The supplementary comparison root report is accurate, but the primary gate report has drifted behind the executable evidence.

That is a Truth/Continuity problem: a reader following the primary gate report can receive an older evidence summary even though CI is green.

## Falsifier recorded before implementation

This experiment fails if any of the following can remain green:

1. `evidence/adversarial_matrix.json` declares a `test_count` different from its `tests.length`;
2. two matrix cases silently reuse the same case id;
3. any matrix case records `observed` different from `expected`;
4. the number of authored executable behavior fixtures in JavaScript + Go differs from the matrix `test_count`;
5. `ROOT_GATE_REPORT.md` does not state the same current authored matrix count;
6. the guard counts itself as protocol evidence and recursively inflates the matrix;
7. the repair rewrites protocol/runtime semantics or donor boundaries merely to make documentation agree.

## Bounded implementation

Add a meta-test that reads repository files locally and checks:

- matrix internal count integrity;
- unique case ids;
- expected/observed equality;
- JavaScript authored behavior fixture count, excluding the meta-test itself;
- Go authored behavior fixture count;
- exact current count stated in the primary root-gate report.

The guard is evidence plumbing only. It does not add a new cryptographic guarantee and therefore does not increase the 66-case adversarial matrix.

## Truth boundary

A passing consistency guard proves only that the repository's declared authored-case count, executable fixture count, expected/observed matrix entries, and primary root-gate count agree at that commit.

It does **not** prove that the fixtures are complete, independently authored, hostile-environment secure, externally interoperable, or semantically correct beyond what each test actually exercises.
