# Donor boundary — axm-city-multiplayer

City Multiplayer already has direct invite bearer material, expiry checks, canonical parsing, and explicit admission boundaries.

Trust Fabric must not replace that working path in v0.1.

A future bounded adapter can add an optional capability envelope such as:

- action: `join`;
- target: exact session id;
- subject: invited peer key;
- expiry: no later than the invite expiry.

The experiment succeeds only if the existing bearer invite remains usable without Trust Fabric and the adapter does not introduce an AXM account or network dependency.
