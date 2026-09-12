# Key Rotation / Recovery Research Contract

Status: **SINGLE-STEP BOUNDED ROTATION + SUCCESSOR POSSESSION ACK IMPLEMENTED / RECOVERY NOT IMPLEMENTED**

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

## Successor possession acknowledgement

`src/key-rotation-ack.js` adds one isolated acknowledgement layer after a rotation already passes the bounded rotation evaluation.

Key B signs an acknowledgement that binds:

- the exact signed rotation digest;
- the exact predecessor key id;
- the exact successor key id;
- the exact domain.

The acknowledgement issuer must be the named successor key itself. Its signed validity window must be contained inside the predecessor rotation envelope window.

A successful result is `SUCCESSOR_POSSESSION_CONFIRMED_FOR_ROTATION`.

That proves only that the successor private key corresponding to the public key named in that exact rotation signed the acknowledgement. It does **not** prove same-person/device identity continuity, transfer root/capability authority, or make that rotation win over a competing predecessor-signed fork.

## Rules locked by fixtures

- the rotation envelope issuer must equal the body predecessor key id;
- the rotation evaluator must be given an explicit expected predecessor;
- the successor key id must derive from the exact signed successor public key;
- `effectiveAt` must lie inside the signed rotation envelope window;
- trusted time is required and the rotation is unusable before `effectiveAt`;
- the domain must match exactly;
- old predecessor-signed bytes remain independently verifiable and are never rewritten as successor signatures;
- two distinct simultaneously usable predecessor-signed rotations for the same expected predecessor/domain become `ROTATION_FORK_EVIDENCE`;
- the rotation comparator exposes both exact packet ids and chooses no winner;
- successor possession acknowledgement must be signed by the exact named successor;
- acknowledgement must bind the exact rotation digest, predecessor, successor, and domain;
- acknowledgement validity cannot outlive the rotation envelope;
- expired acknowledgement is not live possession evidence;
- possession proof for one branch does not resolve a competing rotation fork.

See `experiments/KEY_ROTATION_V1.md` and `experiments/KEY_ROTATION_ACK_V1.md` for the falsifier-first contracts.

## Still unresolved

The bounded experiments do **not** yet define or claim:

- multi-hop A -> B -> C rotation lineage;
- automatic acceptance of B as a capability/root issuer because A named it or B acknowledged it;
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
- silently converts a rotation statement or acknowledgement into unrelated capability/root authority;
- turns recovery into automatic CANON or permission escalation.
