# Key Rotation Revocation Checkpoint Lineage v1

Status: falsifier-first bounded research contract.

## Question

Can one explicitly expected predecessor extend one exact locally retained key-rotation-revocation checkpoint head to one direct successor checkpoint, while preventing local rollback of sequence or `completeThrough` and exposing a conflicting same-sequence history, without claiming discovery, synchronization, consensus, or globally newest revocation state?

## Falsifier first

The experiment fails if any of the following is possible:

1. a non-genesis candidate is accepted when the verifier retained no predecessor head;
2. an older signed sequence can silently replace a newer retained head;
3. two different valid links at the same sequence are normalized into one history instead of exposed as a fork;
4. a direct successor can point at a different predecessor link and still advance;
5. a direct successor can move `completeThrough` backward;
6. a sequence gap is treated as continuous history;
7. a foreign signer can advance another predecessor's retained lineage;
8. a lineage link can name a checkpoint that it does not cryptographically bind exactly;
9. a lineage link can be issued before the checkpoint it names;
10. success is interpreted as proof of synchronization, absence of unseen/newer revocations, global freshness, fork resolution, identity continuity, authority transfer, or AXM-wide CANON.

## Bounded construction

- The checkpoint remains the existing `key-rotation-revocation-checkpoint` envelope unchanged.
- A separate predecessor-signed lineage-link envelope binds the exact checkpoint envelope id, an exact previous lineage-link id or `null`, and a bounded sequence number.
- Sequence zero is a verifier-local genesis observation only.
- A non-genesis candidate requires an exact locally retained `{ checkpoint, link }` head.
- Only an exact direct successor may advance that retained head.
- `completeThrough` may stay equal or move forward, never backward.
- Competing same-sequence or wrong-predecessor evidence remains visible as a fork state.

## Explicit truth boundary

A successful result proves only a relationship between the exact supplied signed checkpoint/link pair and the exact retained signed predecessor pair held by this verifier. It does not discover missing history, prove a globally newest checkpoint, prove current global rotation-revocation state, survive loss of retained local state, synchronize peers, choose a fork winner, validate referenced rotations beyond the checkpoint's existing bounded contract, transfer identity or authority, or promote repository state to AXM-wide CANON.

## Root gate intent

- **Truth:** name only locally supplied signed continuity and rollback/fork evidence.
- **Agency / non-domination:** require the explicit expected predecessor; no foreign or ambient signer can advance the lineage.
- **Continuity:** link immutable checkpoint envelope ids instead of rewriting checkpoint or revocation history.
- **Wisdom before speed:** test one retained-head/direct-successor anti-rollback seam before discovery, synchronization, fork policy, arbitrary history comparison, recovery, or consensus.
