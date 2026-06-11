# Semantic Block Segmentation & Testing Protocol

This document defines the canonical rules for creating and validating semantic blocks during transcript analysis.

The purpose is to maximize insight quality, signal density, and clustering accuracy while preventing interviewer contamination and over-fragmentation.

---

# 1. Core Principle

Tag **semantic blocks**, not sentences.

A semantic block is a coherent unit of meaning that represents a complete thought about:

* A role
* A process
* A workflow
* A system
* A document
* A structure
* A friction point
* A decision pattern
* A governance or accountability structure

If the unit does not represent a complete idea, it is not yet a block.

---

# 2. What a Valid Semantic Block Must Do

Each block must:

1. Contain a coherent idea that can stand on its own.
2. Be intelligible if read independently of surrounding transcript.
3. Contain enough context to justify its tags.
4. Avoid mixing unrelated topics.

If a block fails any of these tests, segmentation is incorrect.

---

# 3. What Is NOT a Semantic Block

The following types of content have no analytical value:

* Greetings and sign-offs
* Mic checks and audio issues
* Standalone timestamps
* Interviewer backchannels ("yeah," "okay," "mhm") when not attached to substantive content
* Recording disclaimers
* Small talk entirely unrelated to AHA or Heart Walk (weather, personal pleasantries)

## Nothing is ever deleted.

Every piece of transcript content becomes a durable DB row. Zero-loss traceability to the original source is a hard system requirement.

Instead of deletion, two tagging tiers handle non-substantive content:

**`catch_offtopic`** — Content that has no connection to AHA, Heart Walk, or the interview subject matter at all. Examples: "Can you hear me okay?", "Great, good to meet you!", closing pleasantries. These blocks are stored and counted toward full coverage, but are **excluded from all downstream analysis** (Analyst, Synthesizer, Reporter).

**`catch_irrelevant`** — Content that exists within the AHA/HW context but carries no analytical signal (e.g., a filler acknowledgment between substantive answers, a repeated restating of a question). These are stored and may be reviewed, but do not generate insights.

The distinction that matters:
- `catch_offtopic`: domain-external — outside the subject entirely
- `catch_irrelevant`: domain-internal — related but analytically empty

In both cases: stored, traceable, excluded from synthesis.

---

# 4. Q + A Handling Rules

Interviewer statements must never be treated as insights.

However:

* The question must remain attached to the answer for context.
* Tags are derived primarily from the interviewee’s response.
* A tag may be inferred from the question only if the answer clearly depends on that context.
* A question alone is never sufficient for assigning a tag.

A question may appear inside a semantic block.
It may never generate an insight on its own.
It may never be used as a pull quote.

---

# 5. How to Identify Block Boundaries

Start a new block when one of the following occurs:

## A. Topic Shift

The speaker moves to a different major subject area.

Examples:

* Chair recruitment → ELT formation
* ELT → internal systems
* External leadership → internal accountability

## B. Process Boundary

The speaker introduces a new step or phase.

Examples:

* "It starts with chair recruitment…"
* "Another channel is…"
* "From there, we…"

## C. Role Boundary

Focus shifts between distinct roles.

Examples:

* Chair
* ELT
* Executive Champion
* Company Leader
* AHA Staff
* VP / Executive Director
* GAP meetings

## D. System Boundary

Discussion moves between systems or infrastructure.

Examples:

* Salesforce
* SharePoint
* Tableau
* Financial policy
* Timeline structure
* Training / onboarding

## E. Friction or Constraint Boundary

A new constraint, blocker, workaround, or structural issue is introduced.

If none of these boundaries occur, continue appending to the current block.

---

# 6. Granularity Target

Correct segmentation should produce blocks that:

* Represent complete ideas.
* Do not require the previous block to make sense.
* Do not contain multiple unrelated themes.

As a general heuristic:

A long interview of ~400 raw transcript lines should reduce to approximately 60–90 semantic blocks.

If there are significantly more blocks, segmentation is too fine.
If there are significantly fewer blocks, segmentation is too coarse.

---

# 7. Tagging Discipline

Tag richly when clearly supported by the interviewee’s words.

Do NOT:

* Invent terminology
* Introduce analytical abstractions
* Auto-apply problem/solution/workaround without clear description

Tags must be justified by content inside the semantic block.

---

# 8. Explanation Requirement

Every tagged block must include an explanation field.

The explanation must:

* Be no more than 30 words.
* Justify the most important or non-obvious tagging decisions.
* Explain sentiment if assigned.
* Appear in progress feeds for debugging.

Even obvious tagging decisions require at least minimal explanation.

---

# 9. Testing & Validation Protocol

Before accepting segmentation as valid, apply the following tests:

## Test 1: Independence Test

Read the block alone.
If it cannot stand on its own, segmentation is too fine.

## Test 2: Topic Purity Test

Check whether the block contains multiple unrelated themes.
If yes, segmentation is too coarse.

## Test 3: Tag Sufficiency Test

Ask: Could the tags be applied without ambiguity?
If not, the block lacks sufficient context.

## Test 4: Noise Ratio Test

Calculate the proportion of meaningful blocks to filler.
If more than ~20% of blocks are filler-like, preprocessing is insufficient.

## Test 5: Boundary Justification Test

For any borderline split, confirm at least one of the boundary triggers (Topic, Process, Role, System, Friction) is present.

---

# 10. Success Criteria

Segmentation is considered successful when:

* Blocks cluster cleanly by theme.
* Canonical tags attach consistently.
* Interviewer contamination is eliminated.
* Insight density increases.
* The dataset supports reliable synthesis and reporting.

The objective is signal clarity, structural integrity, and analytical reliability — not transcript granularity.

---

# 11. Clean Text Requirement (Open Issue)

> **Note recorded 2026-02-19:** The `clean_text` field is currently not working correctly — the clean version often matches or nearly matches `raw_text` with no meaningful noise reduction.

## Intent

Every semantic block carries two text representations:

- **`raw_text`** — the verbatim source content, never modified after ingest. The source of truth for traceability.
- **`clean_text`** — a human-readable version with surface noise removed, intended for display in downstream apps (Analyst, Synthesizer) and for LLM prompts.

## What clean_text should do

- Strip disfluencies: `um`, `uh`, `like you know`, `I mean`, repetitive stutters
- Remove interviewer backchannels that were included for context grouping (`Mhm`, `Yeah`, `Right` interjections mid-block)
- Strip speaker labels and timestamp prefixes (those are stored as structured fields, not inline text)
- Normalize whitespace and punctuation artifacts from transcript formatting
- **Not** rewrite, summarize, or change meaning in any way

## What clean_text must NOT do

- Remove substantive content
- Alter the meaning or emphasis of the speaker's words
- Be used as the traceability source (that is always `raw_text`)

## Current failure mode

The `buildCleanBlockText()` and `cleanTurnText()` functions exist in Gatekeeper but produce output that is too close to raw — speaker labels, backchannels from the interviewer, and filler words are surviving into `clean_text`. This needs to be fixed before Analyst and Synthesizer can rely on `clean_text` for LLM prompt construction.
