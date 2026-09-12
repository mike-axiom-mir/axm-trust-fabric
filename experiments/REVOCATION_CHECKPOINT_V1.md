# Experiment — signed revocation checkpoint v0.1

## Question

Can an offline verifier distinguish **issuer-attested revocation knowledge through a specific timestamp** from unknown or stale revocation evidence, without pretending that an offline peer knows the globally newest revocation state?

## Falsifier first

This experiment fails if any of the following is true:

1. a checkpoint signed by the wrong issuer is accepted for another issuer's revocation state;
2. the supplied revocation packet set can be changed, omitted, duplicated, or supplemented without invalidating the checkpoint binding;
3. a checkpoint can claim completeness later than the time at which it was signed;
4. an expired checkpoint is still reported as usable freshness evidence;
5. an unknown clock is converted into a freshness claim;
6. the implementation reports that no newer revocation exists after `completeThrough`;
7. capability authorization starts depending on this research primitive without a separate bounded gate.

## Narrow contract

A checkpoint is an ordinary signed Trust Fabric envelope whose body binds:

- `kind = revocation-checkpoint`;
- `completeThrough` — the latest timestamp for which the issuer attests the supplied revocation manifest is complete;
- `revocationCount` — exact number of packets in that manifest;
- `revocationIdsDigest` — SHA-256 of the canonical sorted list of exact revocation envelope ids.

The signer may attest only its own revocation packets. `completeThrough` must be no later than the checkpoint envelope's `issuedAt`. The evaluator must be given an explicit `expectedIssuer`; signer familiarity alone is not authority.

A passing result means only:

> this expected issuer signed a manifest that exactly matches the supplied valid revocation packets and attested that manifest complete through the stated historical timestamp, while the checkpoint itself is still within its signed validity window.

It does **not** mean the verifier knows the current global revocation state. A revocation issued after `completeThrough`, or evidence that never reached this peer, remains unknown.

## Planned evidence

Adversarial fixtures will require:

- exact manifest -> `REVOCATION_SET_ATTESTED_THROUGH`;
- omitted or substituted packet -> `REVOCATION_SET_DIGEST_MISMATCH`;
- foreign checkpoint issuer -> `CHECKPOINT_ISSUER_MISMATCH`;
- future `completeThrough` relative to signing -> `INVALID_CHECKPOINT_WINDOW`;
- expired checkpoint -> `STALE_REVOCATION_CHECKPOINT`;
- missing trusted clock -> `HOLD_CLOCK_UNKNOWN`.

This experiment does not alter donor repositories, capability authorization semantics, revocation distribution, synchronization, or AXM-wide CANON status.
