# Donor boundary — axm-collaboration-platform

The collaboration platform already contains scoped authority-lease concepts and a separate Ed25519 signed-review path.

Trust Fabric should extract only a reusable primitive boundary:

- cryptographic issuer proof;
- exact target/action scope;
- expiry;
- revocation;
- delegation ceilings;
- offline-verifiable evidence.

It must not copy workflow-specific Review Inbox policy, UI, operation locks, or merge semantics into the base fabric.
