# Trust Model v0.1

## Purpose

Trust Fabric proves bounded cryptographic statements about exact bytes and exact authorization scope. It must not convert cryptographic validity into moral, factual, social, legal, or constitutional authority.

## Five independent dimensions

| Dimension | v0.1 can establish | v0.1 must not claim |
|---|---|---|
| Integrity | signed canonical bytes still match | bytes are safe, correct, or desirable |
| Authorship | holder of a private key signed the bytes | a legal/named human authored them |
| Authority | a valid capability authorizes an exact action/target within limits | signer has authority outside that capability |
| Identity continuity | nothing from one signature alone | key = permanent person/device identity |
| Truth | not evaluated | signed statement is true |

## Capability rule

Authority is explicit and closed. A v0.1 capability declares:

- subject key id;
- exact target;
- sorted action set;
- issue and expiry timestamps;
- remaining delegation depth;
- exact parent capability id or null;
- whether the capability is one-use.

A child capability may only narrow its parent. It cannot:

- add actions;
- change target;
- begin before the parent;
- outlive the parent;
- increase delegation depth;
- turn a one-use parent into a reusable child;
- be issued by a key other than the parent's subject.

## Revocation rule

v0.1 accepts an exact capability revocation only when:

1. the revocation envelope has a valid signature;
2. its own time window is current under the caller-supplied clock;
3. it references the exact capability digest; and
4. its issuer is the capability issuer.

This is intentionally narrow. Delegated revokers, threshold revocation, recovery keys, and revocation inheritance remain research questions.

## Offline truth boundary

An offline verifier cannot know facts it has never synchronized.

Therefore:

- absence of a local revocation packet does not prove no newer revocation exists elsewhere;
- `CLOCK_UNKNOWN` cannot become authorization;
- one-use replay can be detected locally after local consumption, but not globally across disconnected peers;
- copied private keys cannot be distinguished cryptographically from the original holder.

## Root merge gate

### Truth

- every success state names only what was measured;
- signed does not mean true;
- missing time becomes `HOLD_CLOCK_UNKNOWN`;
- unresolved distributed replay and freshness remain explicit.

### Agency / non-domination

- no ambient authority from identity familiarity;
- every capability is scoped and expiring;
- delegation only narrows;
- no automatic permission escalation.

### Continuity

- donor systems are adapted, not destructively replaced;
- exact parent digests preserve delegation lineage;
- old signed evidence remains independently verifiable if its key material is retained.

### Wisdom before speed

- v0.1 has no account system, global registry, blockchain, trust score, or automatic recovery;
- key rotation is documented before implementation;
- unknown states fail closed rather than being filled by convenience.

Passing the roots permits a repository merge. It does not automatically declare the mechanism CANON for every AXM system.
