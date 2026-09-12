# Key Rotation / Recovery Research Contract

Status: **DESIGNED BOUNDARY / NOT IMPLEMENTED IN v0.1**

## Desired property

A future rotation mechanism should allow:

```text
Key A -> explicitly authorized rotation -> Key B
      -> old A signatures remain verifiable
      -> new grants may use B after the rotation boundary
```

without silently rewriting old evidence or treating possession of a backup as automatic identity ownership.

## Required future rules

A rotation experiment must define and test:

- exact old-key authorization of the new key when the old key is available;
- a deterministic effective boundary;
- preservation of old signature verification;
- replay and fork behavior when two rotations compete;
- revocation interaction;
- rollback visibility;
- device replacement without equating device identity to actor identity.

## Lost-key recovery

If the only authority key is irretrievably lost and no recovery mechanism was established beforehand, v0.1's honest state is:

`IDENTITY_CONTINUITY_UNPROVEN`

A future recovery mechanism may use pre-authorized recovery keys, threshold schemes, or other bounded evidence, but it must not fabricate continuity after the fact.

## Stop conditions

Reject a recovery design if it:

- lets a central service silently become the owner;
- creates permanent global identity as a base requirement;
- rewrites prior signatures;
- hides a disputed fork;
- treats recovery possession as proof of legal/human identity;
- turns recovery into automatic CANON or capability escalation.
