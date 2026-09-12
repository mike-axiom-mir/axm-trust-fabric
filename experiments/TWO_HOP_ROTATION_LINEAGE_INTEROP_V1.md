# Two-Hop Rotation Lineage Interoperability v1

Status: falsifier-first bounded experiment. Repository evidence only; not AXM-wide CANON.

## Question

Can one fixed `A -> B -> C` rotation-lineage evidence set be evaluated to the same bounded result by the existing JavaScript reference path and a separate Go standard-library implementation that does not import or execute the JavaScript lineage evaluator?

## Falsifier defined before implementation

This experiment fails if any of the following occurs:

1. the Go path accepts a packet whose Ed25519 signature does not verify over the exact canonical unsigned envelope bytes;
2. the Go path derives a different key id or envelope digest from the fixed bytes than the JavaScript reference path;
3. the Go path accepts a lineage when the expected origin or exact domain does not match;
4. the Go path accepts the lineage without both successor acknowledgements bound to their exact rotation digests;
5. the Go path accepts a second rotation whose predecessor is not the exact successor named by the first rotation;
6. the Go path accepts a second hop that begins before the first effective boundary or outlives the first signed expiry;
7. either implementation reports a success state broader than `TWO_HOP_ROTATION_LINEAGE_CONFIRMED` for the supplied two-hop evidence;
8. the evidence is described as proving same-person/device/legal identity, authority transfer, a globally newest/unique branch, fork resolution, third-party conformance, or hostile-environment security;
9. the implementation requires changing `src/key-rotation-lineage.js`, capability authorization, checkpoint/revocation behavior, or either donor boundary.

## Bounded implementation target

Publish one deterministic non-secret test vector containing exactly two predecessor-signed rotations and two successor-signed acknowledgements. Keep the existing JavaScript evaluator as the reference path. Add a separate Go evaluator that uses the Go standard library for canonical JSON, SHA-256, Ed25519 verification, timing, exact predecessor/domain checks, acknowledgement binding, and the two-hop no-widening rule.

The Go evaluator may reuse the repository's existing Go-only canonicalization/key parsing helpers because those helpers do not import or execute JavaScript. It must not import, execute, or translate results from `src/key-rotation-lineage.js`.

## Truth boundary

Agreement means only that two same-repository implementations agree on the exact fixed evidence and selected refusal states. It does not establish third-party interoperability, general protocol conformance, identity continuity, authority transfer, global branch freshness, fork resolution, arbitrary-length lineage, or production security.
