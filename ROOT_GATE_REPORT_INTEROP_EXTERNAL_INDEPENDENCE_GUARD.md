# Root Gate Report — External Interoperability Claim Guard

Status: **candidate evidence-governance improvement; not automatic CANON**

## Question tested

Can Trust Fabric mechanically prevent current same-repository JavaScript + Go portability evidence from drifting into a claim of external, third-party, or separately authored protocol conformance before such evidence actually exists?

## Falsifier first

The falsifier is recorded in `experiments/INTEROP_EXTERNAL_INDEPENDENCE_GUARD_V1.md` before the bounded guard work. The experiment fails if the human-facing interoperability boundaries can disappear while CI remains green, if the guard grants new authority or changes runtime/protocol semantics, if it inflates the authored protocol-case count, or if repository merge is treated as external validation or AXM-wide CANON.

## Exact bounded delta

- extend `evidence/consistency_guard_v1.json` with required interoperability truth-boundary phrases from `INTEROPERABILITY.md` and `README.md`;
- extend `tests/evidence-consistency.test.js` so CI checks those human-facing documents directly;
- add `evidence/interop_external_independence_guard_v1.json` as machine-readable evidence for this governance boundary;
- add the falsifier-first experiment record and this supplementary four-root report.

No runtime source, signed packet format, schema, cryptographic primitive, capability/revocation/key-rotation authority rule, donor boundary, or protocol/security fixture count changes. The authored matrix remains **130 bounded cases**; this is a meta-guard, not a new protocol property.

## Truth — PASS if exact branch and PR CI agree

The guarded documents must continue to state that current cross-language agreement is same-repository evidence, is not evidence of third-party independence, and must not be widened into broad conformance, production security, global freshness, synchronization, consensus, or external validation.

Passing the guard does not create external interoperability evidence. It proves only that selected repository claims still preserve that hold at one commit.

## Agency / non-domination — PASS

The guard grants no signer, verifier, maintainer, implementation, repository, successor, root, revoker, checkpoint signer, or fork-selection authority. No external party is made authoritative merely by reproducing evidence, and no repository actor becomes a constitutional merge gate.

## Continuity — PASS

Existing runtime behavior, signed packets, protocol fixtures, evidence vectors, donor boundaries, historical commits, and the 130-case matrix are preserved. The change makes claim drift visible rather than rewriting earlier evidence or pretending same-repository work came from an independent implementation.

## Wisdom before speed — PASS

The repository already states that the next meaningful interoperability boundary is genuinely external or separately authored reproduction. This change protects that honest stopping point instead of manufacturing a fourth same-repository vector and calling it stronger external evidence.

## Merge condition

Merge only if:

1. the exact branch head passes the full Node and Go workflow;
2. a final overlap scan finds no competing open work or incompatible movement on `main`;
3. the exact PR head passes pull-request CI;
4. the four roots still agree with the final diff and evidence.

Repository merge is not AXM-wide CANON.

## Unknowns preserved

Actual external/separately authored implementation evidence remains absent. Broad protocol conformance, third-party independence, production/hostile-environment security, globally trustworthy time, synchronization/freshness, fork resolution, arbitrary-length rotation lineage, and lost-key recovery remain unresolved.

## Strongest next step

Have a genuinely separate implementation reproduce published fixed bytes and bounded classifications without importing, executing, mechanically wrapping, or sharing Trust Fabric implementation code. Until then, preserve the external-interoperability hold.
