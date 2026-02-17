# Legacy Code Mapping (Reference)

These HTML files are preserved for reference. They represent an earlier, mostly-monolithic UI that spans multiple stages of the current 4-app architecture.

## Files

- `index.html`
  - Label in UI: "Harvester v25: Command Console"
  - Primary role: Gatekeeper (orchestrates ingest + batch processing)
  - Also contains: Analyst-ish extraction + links to "Gardener" organization and export.

- `harvesterv2.html`
  - Label in UI: "Harvester v2: The Strict Classifier"
  - Primary role: Analyst (strict classification of sentences/lines into a fixed taxonomy; writes structured rows)

- `harvester.html`
  - Label in UI: "Harvester v24: Force Fit"
  - Primary role: Reporter/Synthesizer hybrid (force-fits tags into a target deck taxonomy; exports JSON/Markdown)

## Notes

- These reference an older bucket taxonomy and the `happydo.xyz` DBHelper/askAI plumbing.
- Keep both harvesters: `harvesterv2.html` is newer but has known deletions; `harvester.html` is preserved as an alternate baseline.
