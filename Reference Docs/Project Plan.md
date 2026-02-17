# HWIE Project Plan 2026

**Goal:** Zero-Loss, Fully Traceable Evidence Engine (MySQL + Multi-Label Tags)
**Status:** Planning Phase
**Stack:** `DBHelper` (SQL Proxy), `askAI` (AI Proxy), HTML/JS Frontend (Single Page App `index.html`)

---

## Phase 1: Foundation & Protection (The "Safety Net")

We secure the environment and build the runtime integrity checks first.

- [ ] **1.1 Canonical App Shell**
    - [ ] Create `index_v3.html` (clean slate).
    - [ ] Import `DBHelper` and `askAI`.
    - [ ] Add "Debug Mode" toggle in UI.

- [ ] **1.2 Runtime Smoke Tests (The "Anti-Rogue" System)**
    - [ ] **Variable Hash Check:** A function `validateRuntime()` that asserts critical global objects (`DBHelper`, `APP_NAME`, `TAG_LIBRARY`) exist and are not null.
    - [ ] **Code Integrity Check:** A crude but effective `checkFileLength()` status line in the UI that warns if the source file drops by >10% unexpectedly (manual implementation note: this might just be a visual warning comparing current char count to a hardcoded 'last good' watermark).
    - [ ] **DB Connectivity Test:** On load, run `SELECT 1` via `DBHelper` and report green/red status.

- [ ] **1.3 Database Migration (Schema V3)**
    - [ ] Write a `migrateSchema()` function in `index_v3.html` that ensures the new tables exist:
        - `sentences` (with timestamp, raw_text, status)
        - `tags` (canonical library storage)
        - `sentence_tags` (join table)
        - `insights` (with flags)
        - `insight_sentences` (join table)
    - [ ] Seed the `tags` table with the canonical list from `Reference Docs/Heart Walk Canonical Tag Library.md`.

---

## Phase 2: Input & Data "Gatekeeper"

We need to get text INTO the database correctly before we try to tag it.

- [ ] **2.1 File Ingest Parsers**
    - [ ] Build `ingestFile(fileObj)`:
        - [ ] Splits text by newlines.
        - [ ] Extracts timestamps `[00:12]` (regex).
        - [ ] Implements the "Timestamp Carry-Forward" logic (if a line has no timestamp, inherit from the previous line).
    - [ ] **Smoke Test:** Ingest a small test file and verify row count matches line count, and no timestamp is null.

- [ ] **2.2 The "Raw" Viewer**
    - [ ] Create a UI tab to view the `sentences` table formatted as a script.
    - [ ] Add a "Reset/Wipe" button for development speed.

---

## Phase 3: The Analyst Agent (Grading & Tagging)

The core value engine.

- [ ] **3.1 Batch Processor Framework**
    - [ ] Build a reliable `processBatch(limit=10)` function.
    - [ ] Selects `status='unprocessed'` sentences.
    - [ ] Locks them (or tracks them) so we don't double-process.

- [ ] **3.2 Prompt Engineering (Multi-Label)**
    - [ ] Construct the System Prompt injecting:
        - [ ] HW Systems Overview.
        - [ ] Canonical Tag Library (JSON format).
    - [ ] Test the prompt manually in `tester.html` first to ensure JSON output compliance.

- [ ] **3.3 Response Handler & Saver**
    - [ ] Parse AI JSON response.
    - [ ] **Validator:** Check that returned tags actually exist in our DB `tags` table. Reject/Flag invalid tags.
    - [ ] Write valid tags to `sentence_tags`.
    - [ ] Update `sentences.status` to `finalized`.

- [ ] **3.4 Review UI (The "Gardener" Component)**
    - [ ] UI to inspect a sentence, see its assigned tags/flags.
    - [ ] Mechanism to manually add/remove tags if AI failed.

---

## Phase 4: Synthesis & Reporting (The Payoff)

Making the data useful.

- [ ] **4.1 Insight Clustering**
    - [ ] AI Job to look at sentences grouped by Tag (e.g., "All `tool_sharepoint` sentences").
    - [ ] Generate `insights` from these clusters.

- [ ] **4.2 Report Generator**
    - [ ] Build a "Download Markdown" function.
    - [ ] Iterating through each Insight.
    - [ ] Fetching linked Quotes (from `insight_sentences`).
    - [ ] Formatting strictly with Traceability (Insight -> Quote -> Timestamp).

---

## Phase 5: Hardening & Cleanup

- [ ] **5.1 Final "Zero Loss" Audit**
    - [ ] SQL Query to find any sentence with 0 tags.
    - [ ] SQL Query to find any sentence stuck in `processing`.
- [ ] **5.2 Documentation**
    - [ ] Update `README` or `index.html` help text with usage instructions.
