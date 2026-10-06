# Deterministic vector generator

Owner: generator. Gate A0. Status: not implemented.

## Approach

On the artwork branch add a server-only generator package. Produce a square SVG viewBox 0 0 1000 1000 with exactly 101 polygon cells. Begin with deterministic jittered sites and clipped Voronoi geometry; use fixed-count Lloyd relaxation and bounded deterministic rejection so each cell area is 0.5–1.5 times totalArea/101. Use robust pinned geometry primitives. Reject non-finite/self-intersecting/degenerate cells; a bounded fixed fallback geometry is versioned rather than retrying forever.

Use stable cell IDs, fixed decimal coordinate serialization and a pinned palette/config. Seasonal configuration requires >=2 colours. A versioned motif vocabulary evolves by reporting index; milestone targets add distinct marker geometry without embedding milestone text. Reveal one previously unoccupied cell per report. Render empty cells consistently. Initial generator acceptance is geometric/deterministic, then review visual quality in the lab.

Generate SVG with an allowlisted element/attribute serializer, no foreignObject, scripts, external URLs, CSS imports or embedded source data. Use pinned resvg for PNG export in a pinned environment; record font and binary versions. Do not promise identical PNG bytes across unpinned platforms. Default exports: 1000px SVG and 2000px PNG; enforce maximum dimensions and input sizes.

## Tasks

- [ ] Pure input→SVG renderer with versioned geometry, palette, motifs and markers.
- [ ] Domain-separated deterministic streams; fixed tile/colour selection separate from mutable detail.
- [ ] Isolated bounded export process and SVG sanitization; no remote resource loading.
- [ ] Golden artifacts and digests for a fixed fictional seed corpus.

## Acceptance

Exactly 101 cells cover the canvas within a documented numerical tolerance, no overlaps beyond shared edges, bounded area variation, and no unbounded generation loops. Reports reveal exactly N cells. Same frozen inputs/config reproduce identical SVG bytes. Text corrections alter detail while selection stays fixed. Rerolls change allowed selection without duplicating occupied tiles. Missing dates reveal no cells. PNG outputs are deterministic within the pinned container. Inspect small and full-size artwork for legible milestone markers and palette contrast.

Record generator/config changes and golden updates with visual review; never overwrite an existing completed edition just because a new generator is deployed.
