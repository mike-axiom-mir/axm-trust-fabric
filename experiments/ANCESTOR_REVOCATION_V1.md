# Ancestor Revocation v0.1 — falsifier-first experiment

## Question

When a delegated capability is evaluated through its required full parent chain, does revoking an ancestor capability invalidate the descendant grant without giving unrelated signers revocation power or allowing a short-lived revocation to create a later silent resurrection?

## Why this is the next bounded question

Trust Fabric already requires a complete delegation chain. The reference implementation evaluates every capability in that chain, which appears to make ancestor revocation effective in practice, while `TRUST_MODEL.md` still lists revocation inheritance as an unresolved research question.

That ambiguity is a truth-boundary problem: an important authority property must be either explicitly supported and regression-tested or explicitly refused. It must not remain an accidental side effect.

## Falsifiers

This experiment fails if any of the following are observed:

1. a valid descendant remains grant-valid after its actual ancestor is validly revoked by that ancestor's issuer;
2. a foreign signer can revoke an ancestor and thereby invalidate the descendant chain;
3. an ancestor revocation that expires before the ancestor capability is treated as a clean revocation and permits a later silent resurrection rather than producing the existing fail-closed hold;
4. proving the property requires changing donor systems, introducing global revocation state, or claiming freshness that an offline verifier cannot know.

## Bounded expected result

For a supplied complete chain and supplied local revocation evidence:

- a valid issuer-signed revocation of any chain member invalidates authorization through that chain;
- the result identifies the affected chain index through existing evidence output;
- foreign revocations remain non-authoritative;
- an invalid revocation window remains `HOLD_INVALID_REVOCATION_WINDOW`;
- absence of a locally known ancestor revocation does **not** prove that no newer revocation exists elsewhere.

This is local chain-evaluation semantics only. It is not a global revocation broadcast, freshness, synchronization, or recovery protocol.
