# Three-Hop Key Rotation Lineage v1 — Falsifier First

Status: RESEARCH EXPERIMENT / NOT CANON / NOT AUTHORITY TRANSFER

## Question

Can Trust Fabric verify one explicitly supplied `A -> B -> C -> D` key-rotation branch while requiring successor-possession acknowledgement at every hop, preserving one exact domain and nested validity windows, without turning that evidence into identity ownership, ambient authority, branch uniqueness, discovery, recovery, or fork resolution?

## Falsifier

This experiment fails if any of the following can occur:

- fewer or more than exactly three rotations are normalized into success;
- fewer or more than exactly three successor acknowledgements are normalized into success;
- hop 2 or hop 3 is signed by anything other than the exact successor named by the previous hop;
- any hop changes the exact requested rotation domain;
- a later hop is issued before the immediately preceding rotation becomes effective;
- a later hop expires after the immediately preceding rotation expires;
- an acknowledgement can be substituted for a different rotation;
- trusted time can be omitted while still producing live lineage confirmation;
- successful lineage evidence rewrites any historical rotation or acknowledgement bytes;
- a confirmed supplied branch silently resolves a competing rotation fork or chooses a winner;
- success is described as proof that A/B/C/D are the same human, device, account, legal identity, or constitutional authority;
- success transfers root, capability, revocation, checkpoint, merge, or CANON authority;
- success claims the supplied branch is globally newest, unique, discovered, synchronized, or complete;
- implementing the experiment requires changing existing two-hop semantics, donor systems, global accounts, consensus, or recovery infrastructure.

## Bounded success claim

`THREE_HOP_ROTATION_LINEAGE_CONFIRMED` may mean only:

- exactly three supplied predecessor-signed rotations are currently usable;
- the predecessor/successor chain is exactly `A -> B -> C -> D`;
- B, C, and D each prove possession of the exact successor private key for their exact hop;
- one exact domain is preserved;
- hop 2 stays inside hop 1's temporal boundary and hop 3 stays inside hop 2's temporal boundary;
- the exact supplied signed packets remain independently verifiable historical evidence.

It does not imply identity sameness, authority transfer, branch uniqueness, global freshness, unseen-branch absence, fork resolution, arbitrary-length lineage, discovery, synchronization, recovery, or AXM-wide CANON.

## Continuity boundary

The experiment must be a separate evaluator. Existing single-hop, two-hop, revocation, checkpoint, donor, and interoperability behavior remains unchanged.
