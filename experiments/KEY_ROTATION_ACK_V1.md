# Key Rotation Acknowledgement v1 — bounded successor possession evidence

Status: **BOUNDED RESEARCH EXPERIMENT**

## Question

Can the successor key named by one already-valid predecessor-signed rotation prove control of its private key by signing an acknowledgement bound to that exact rotation, without turning possession into identity continuity, authority transfer, or fork resolution?

## Falsifier first

This experiment fails if any of the following is true:

1. a signer other than the exact successor named by the rotation can produce accepted possession evidence;
2. an acknowledgement for one signed rotation can be replayed against a different rotation packet, even when predecessor/successor/domain text is otherwise identical;
3. the acknowledgement can substitute another predecessor, successor, or domain context;
4. an acknowledgement can outlive the signed rotation window or begin before the rotation packet's own signed window;
5. an expired acknowledgement remains live possession evidence;
6. a successful acknowledgement is described as proof that predecessor and successor are the same human, device, account, legal identity, or constitutional authority;
7. successor possession automatically transfers root, capability, revocation, checkpoint, donor, merge, or CANON authority;
8. possession proof for one branch silently resolves a competing predecessor-signed rotation fork;
9. historical predecessor signatures are rewritten or relabeled.

## Bounded design

A v1 acknowledgement is a normal signed Trust Fabric envelope issued by the successor key. Its body binds exactly:

- `rotationId` — SHA-256 envelope digest of the exact predecessor-signed rotation packet;
- `predecessorKeyId` — must equal the predecessor named by that rotation;
- `successorKeyId` — must equal both the successor named by the rotation and the acknowledgement envelope issuer;
- `domain` — must equal the exact rotation domain.

Evaluation first runs the existing bounded `evaluateKeyRotation` context, including explicit `expectedPredecessor`, exact domain, trusted time, effective boundary, and rotation expiry.

The acknowledgement must then have a valid successor signature, exact body context, and a signed envelope window contained inside the rotation envelope window.

The success state is:

`SUCCESSOR_POSSESSION_CONFIRMED_FOR_ROTATION`

That means only: **the successor private key corresponding to the exact public key named by this exact accepted rotation signed this exact acknowledgement, within the bounded evidence window**.

It does not prove same-person/device identity continuity and it does not promote the successor into a trusted root or other authority.

## Fork rule

Possession proof is branch-local evidence.

If predecessor A has two simultaneously usable signed rotations A -> B and A -> C, a valid acknowledgement from B proves possession for the A -> B branch only. The pre-existing `ROTATION_FORK_EVIDENCE` remains unresolved and no winner is selected.

## Continuity rule

The acknowledgement adds evidence. It does not mutate:

- the predecessor-signed rotation;
- older predecessor signatures;
- the successor public key;
- capability grants;
- revocation/checkpoint state;
- donor systems.

## Explicit non-goals

This experiment does not implement:

- automatic successor root/capability authority;
- multi-hop A -> B -> C rotation lineage;
- rotation discovery, freshness, revocation, or consensus;
- winner selection for competing rotations;
- legal/human/device identity proof;
- hardware-backed key custody;
- lost-key recovery;
- automatic donor migration or AXM-wide CANON.
