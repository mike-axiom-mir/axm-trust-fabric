# Key Rotation Lineage v1 — falsifier-first experiment

Status: research-only candidate. Not automatic authorization, recovery, identity continuity, fork resolution, or AXM-wide CANON.

## Smallest question

Can Trust Fabric verify one explicitly supplied two-hop key-succession chain `A -> B -> C` when every hop is already valid bounded rotation evidence and every named successor proves possession, while refusing domain/window widening and refusing to claim that the supplied branch is unique or authoritative beyond the exact evidence?

This experiment deliberately stops at exactly two hops. It does not generalize to arbitrary-length chains, discover missing rotations, make successors trusted roots, or resolve competing branches.

## Falsifier

The experiment fails if any of the following can occur while the evaluator reports success:

1. the second rotation is not signed by the exact successor named by the first rotation;
2. either successor-possession acknowledgement is missing, invalid, or bound to a different rotation;
3. the second hop changes the exact rotation domain;
4. the second hop begins before the first rotation's `effectiveAt` boundary;
5. the second hop outlives the first rotation's signed expiry;
6. trusted time is absent yet the lineage becomes live evidence;
7. evaluation rewrites or invalidates either historical rotation/acknowledgement packet;
8. a successful supplied branch is described as globally newest, unique, same-person/device identity, automatic authority transfer, or a winner over a competing valid branch.

Any one of those outcomes is sufficient to hold or reject the implementation.

## Candidate bounded success state

`TWO_HOP_ROTATION_LINEAGE_CONFIRMED`

Meaning only:

- the explicitly expected origin key signed a usable `A -> B` rotation for one exact domain;
- B signed a valid possession acknowledgement bound to that exact first rotation;
- B signed a usable `B -> C` rotation for the same exact domain inside the first rotation's effective/expiry bounds;
- C signed a valid possession acknowledgement bound to that exact second rotation;
- all four supplied packets passed their existing signature/time/binding checks at the supplied trusted time.

It must not mean that A, B, and C are the same human/device/legal identity, that B or C automatically inherit root/capability/revocation/checkpoint authority, that no unseen or competing rotation exists, or that a fork has been resolved.

## Non-goals

- arbitrary-length rotation chains;
- successor authority integration;
- lost-key recovery;
- rotation revocation/discovery/freshness;
- global ordering, consensus, or fork selection;
- identity ownership or same-person claims;
- donor migration.

## Root gate before merge

- **Truth:** success language must name only the exact supplied two-hop evidence and preserve unknown competing/unseen branches.
- **Agency / non-domination:** no successor becomes an ambient authority merely by appearing in the chain.
- **Continuity:** existing rotation and acknowledgement packets remain unchanged; the evaluator composes them without rewriting history.
- **Wisdom before speed:** exactly two hops first; no arbitrary chain engine or recovery/consensus machinery until the bounded case survives adversarial tests.
