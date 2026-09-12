# Root Gate Report — trust-core v0.1

Status: candidate evidence for repository merge; not automatic CANON.

## Truth

PASS for this bounded claim.

- The implementation claims only local fixture-tested behavior.
- Signature validity is separated from truth, safety, legal identity, and constitutional authority.
- Missing trusted time becomes `HOLD_CLOCK_UNKNOWN`.
- Offline revocation freshness, disconnected replay, key theft attribution, key rotation/recovery, interoperability, and hostile-environment review remain explicitly unresolved.

## Agency / non-domination

PASS for this bounded claim.

- No accounts, global registry, reputation score, central trust server, or ambient authority are introduced.
- Capability authority is explicit, scoped, expiring, and fail-closed.
- Delegation may narrow but cannot widen target, actions, time, reuse, or delegation depth.
- A familiar signer gains no automatic permission outside an explicit capability chain.

## Continuity

PASS for this bounded claim.

- Existing City Multiplayer and Collaboration Platform mechanisms are donor references only.
- No donor repository is rewritten or migrated.
- Existing bearer invite and authority-lease paths remain independently usable.
- Signed parent digests preserve capability lineage.
- Repository merge does not silently promote Trust Fabric to CANON across AXM.

## Wisdom before speed

PASS for this bounded claim.

- v0.1 uses Node built-in Ed25519 instead of inventing cryptography.
- Key rotation/recovery is documented but intentionally not implemented.
- Unknown clock and incomplete delegation chain states hold rather than guessing.
- The first implementation is a dependency-free local reference primitive, not infrastructure.

## Evidence

Local command:

```bash
npm test
```

Observed result before publication: `15 trust-core tests passed.`

The CI workflow repeats the same command on Node 22.

## Gate conclusion

The four roots permit merging this bounded v0.1 reference implementation if the published branch/CI evidence remains consistent with this report.

This conclusion grants no automatic installation, donor migration, release, deployment, security certification, or AXM-wide CANON status.
