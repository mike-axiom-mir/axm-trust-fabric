# Key Rotation Revocation v0.1 — falsifier-first experiment

## Question

Can the predecessor key that signed one exact key-rotation packet revoke that exact packet, without revoking unrelated rotations, rewriting historical evidence, granting foreign signers revocation power, or pretending that absence of locally supplied revocation evidence proves global freshness?

The bounded integration question is also explicit: when an otherwise-valid supplied `A -> B -> C` lineage contains a hop for which a valid exact revocation is supplied, does the composed lineage fail at that hop without changing either historical rotation or acknowledgement packet?

## Why this is the next bounded question

Trust Fabric now has bounded single-hop rotation evidence, successor-possession acknowledgements, an exact two-hop lineage, and one fixed cross-language lineage vector. `TRUST_MODEL.md` still correctly lists rotation revocation as unresolved.

Adding more lineage depth before a known bad hop can be invalidated would grow continuity claims faster than the evidence needed to withdraw one exact predecessor statement. The smaller question is therefore exact revocation of one already-signed rotation.

## Falsifiers

This experiment fails if any of the following are observed:

1. a foreign signer can revoke a rotation signed by another predecessor;
2. a revocation can be replayed against a different rotation packet, including another rotation with the same predecessor/domain;
3. a revocation of `A -> C` invalidates an unrelated `A -> B` rotation;
4. a matching revocation whose signed expiry ends before the rotation expiry is treated as a clean revocation and thereby permits later silent resurrection instead of producing an explicit hold;
5. a not-yet-valid matching revocation is treated as already active;
6. absence of a supplied matching revocation becomes a claim that no revocation exists elsewhere or that the rotation is globally current;
7. an otherwise-valid two-hop lineage still succeeds when a valid supplied exact revocation invalidates either hop;
8. applying revocation rewrites, relabels, or invalidates the historical signature bytes of the rotation or acknowledgement packets;
9. the change requires modifying `src/trust-core.js`, automatic root/capability/revocation/checkpoint authority transfer, donor behavior, network discovery, consensus, or a global registry.

## Bounded expected result

A rotation-revocation packet is a normal signed Trust Fabric envelope whose body binds:

- the exact rotation envelope digest;
- the predecessor key id;
- the successor key id;
- the exact rotation domain;
- a bounded machine-readable reason code.

Only the exact predecessor that signed the referenced rotation can make that revocation authoritative for the supplied rotation. A matching authoritative revocation must remain valid through at least the referenced rotation's signed expiry; a shorter revocation produces `HOLD_INVALID_ROTATION_REVOCATION_WINDOW` rather than allowing a later silent resurrection.

A valid active matching revocation produces `ROTATION_REVOKED`. An unrelated, foreign, malformed, or not-yet-valid revocation does not revoke the supplied rotation.

If no authoritative active matching revocation is present in the supplied local evidence, the result may say only that the rotation remains usable **with the supplied revocation evidence**. It must not say globally unrevoked, globally newest, or fresh.

For an otherwise-valid exact two-hop lineage, a supplied valid revocation of either hop prevents `TWO_HOP_ROTATION_LINEAGE_CONFIRMED` and reports the affected hop. This wrapper must compose existing rotation/acknowledgement/lineage evidence without rewriting those packets or changing the existing lineage evaluator.

This is local evidence semantics only. It is not rotation-revocation discovery, synchronization, freshness, delegated/threshold revocation, recovery, fork resolution, or consensus.
