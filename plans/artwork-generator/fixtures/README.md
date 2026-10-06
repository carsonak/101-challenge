# Fictional artwork input vectors

[base-seed-v1.json](base-seed-v1.json) contains public, deliberately fictional seed material, canonical initial JSON and expected SHA-256/HMAC results. It is a design contract vector, not an implemented renderer. Never replace it with real participant data.

`pnpm docs:check` verifies the canonical bytes and expected hashes. Add restarted, Unicode/decimal and daily-source vectors when implementing the versioned source schemas. A0 allows local experimentation with this stable base-seed recipe; A1 remains blocked on actual tracker source contracts and tests.
