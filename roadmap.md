# Reliability and performance
- [x] Fix verified session/cache and page-flow defects without visual changes.
- [x] Fix verified lore ingestion/save defects while preserving manual edits.
- [x] Add regression tests and verify main flows on desktop and mobile.

# Automated PDF lore ingestion
- [x] Connect admin PDF uploads to shared parsing, AI extraction, and automatic saving.
- [x] Preserve grounded lore and manual edits; refresh archive views after writes, including partial failures.
- [x] Run regression tests and verify a signed-in PDF upload through the archive UI.

# Gemini integration
- [ ] Connect private-key Gemini extraction and the existing chat through a dedicated LoreChat component.
- [ ] Preserve protected archive saves, grounding and manual fields; test and verify PDF and chat flows.