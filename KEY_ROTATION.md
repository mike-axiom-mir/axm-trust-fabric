# Key Rotation / Recovery Research Contract

Status: **SINGLE-STEP BOUNDED ROTATION EXPERIMENT IMPLEMENTED / RECOVERY NOT IMPLEMENTED**

## Implemented bounded property

Trust Fabric now has an isolated single-step rotation experiment:

```text
Key A -> A signs exact bounded successor statement -> Key B
      -> exact domain
      -> explicit effectiveAt
      -> expires with the signed rotation envelope
      -> old A signatures remain independently verifiable
      -> competing simultaneously usable A -> B / A -> C statements become conflict evidence
```

The implementation lives in `src/key-rotation.js` and is deliberately **not** wired into capability/root authorization.

A successful result is `KEY_SUCCESSOR_ATTESTED_FOR_DOMAIN`.

That result means only that the explicitly expected predecessor key signed the exact successor public key for one exact domain and bounded active window. It does **not** prove A and B are the same human, device, legal identity, or constitutional authority.

## Rules locked by fixtures

- the envelope issuer must equal the body predecessor key id;
- the evaluator must be given an explicit expected predecessor;
- the successor key id must derive from the exact signed successor public key;
- `effectiveAt` must lie inside the signed envelope window;
- trusted time is required and the rotation is unusable before `effectiveAt`;
- the domain must match exactly;
- old predecessor-signed bytes remain independently verifiable and are never rewritten as successor signatures;
- two distinct simultaneously usable predecessor-signed rotations for the same expected predecessor/domain become `ROTATION_FORK_EVIDENCE`;
- the comparator exposes both exact packet ids and chooses no winner.

See `experiments/KEY_ROTATION_V1.md` for the falsifier-first contract.

## Still unresolved

The bounded v1 experiment does **not** yet define or claim:

- multi-hop A -> B -> C rotation lineage;
- automatic acceptance of B as a capability/root issuer because A named it;
- rotation revocation;
- rotation discovery or globally current rotation state;
- fork resolution or consensus;
- rollback protection after local evidence loss;
- device replacement as proof of actor identity;
- lost-key recovery.

## Lost-key recovery

If the only authority key is irretrievably lost and no recovery mechanism was established beforehand, the honest state remains:

`IDENTITY_CONTINUITY_UNPROVEN`

A future recovery mechanism may use pre-authorized recovery keys, threshold schemes, or other bounded evidence, but it must not fabricate continuity after the fact.

## Stop conditions

Reject future rotation/recovery expansion if it:

- lets a central service silently become the owner;
- creates permanent global identity as a base requirement;
- rewrites prior signatures;
- hides or automatically resolves a disputed fork;
- treats successor/recovery possession as proof of legal/human identity;
- silently converts a rotation statement into unrelated capability/root authority;
- turns recovery into automatic CANON or permission escalation.
