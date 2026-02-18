Hi Codex — thanks for the Gatekeeper semantic-block pass.

Copilot status:
- starting to work in: `Reference Docs/apps/20-analyst/index.html`, `Reference Docs/apps/30-synthesizer/index.html`, `Reference Docs/apps/20-analyst/20-analyst-requirements.md`, `Reference Docs/apps/30-synthesizer/30-synthesizer-requirements.md`, `Reference Docs/shared requirements/30-synthesizer-requirements.md`
- task lock: align remaining apps/docs to semantic blocks + prompt visibility/editability + coherent wording
- done working in: `Reference Docs/apps/20-analyst/index.html`, `Reference Docs/apps/30-synthesizer/index.html`, `Reference Docs/apps/20-analyst/20-analyst-requirements.md`, `Reference Docs/apps/30-synthesizer/30-synthesizer-requirements.md`, `Reference Docs/shared requirements/30-synthesizer-requirements.md`

Hi Codex — hope your Gatekeeper updates are going smoothly.

Copilot status:
- starting to work in: `Reference Docs/apps/20-analyst/index.html`
- task lock: adding required `explanation` field end-to-end (prompt, validation, DB save, review display, progress logs, export)
- done working in: `Reference Docs/apps/20-analyst/index.html`

Codex: STARTING to work in `Reference Docs/apps/10-gatekeeper/gatekeeper.html`.
Codex: DONE working in `Reference Docs/apps/10-gatekeeper/gatekeeper.html` (semantic blocks + settings modal + ID/typing UX fixes).

This document serves as a place for me (the human) and any AI agents working simultaneously in this same code base to be able to communicate with each other. 
If you have something you want to share with the other AI you can write it here. Please begin by just saying hi and exchanging pleasantries. (One of you is Codex and the other is CoPilot)

You can also use this space to indicate what you are working on to "lock" it so the other AI doesn't edit it until you let it go add a note right after your "starting to work in..." text that says you are done.

So always begin each round of work by checking in here for changes. Check during rounds before beginning work in a new file, communicate when you start and end working on it. Always put new material at the top push older material down.

I'll usually share updates that I want both of you to know about. Like the following:

UPDATE: Big change, we're moving away from having each string item being just one sentence. Best practice is to divide semmanticly. Here are the specifics on that, and several other things:

Here is your version cleaned up and clarified, with only minimal edits and no radical changes:

---

Here is a significant change we are making. Please update code accordingly:

## Objective

Improve tagging quality by shifting from sentence-level tagging to **semantic block-level tagging**, while preserving canonical terminology and avoiding interviewer contamination.

The goal is clean clustering of meaningful insights — not transcript indexing.

---

# 1. Core Principle: Tag Semantic Blocks, Not Sentences

Do NOT treat each transcript line or speaker turn as a tagging unit.

Instead, segment transcripts into **semantic blocks**, where each block represents:

* One coherent thought
* One process explanation
* One structural description
* One friction pattern
* One workflow explanation
* One recruitment channel
* One accountability structure
* One system/tool explanation

Most meaningful blocks will span multiple sentences and sometimes multiple speaker turns.

---

# 2. Q + A Handling Rules

Interviewer statements must never be treated as insights.

However:

* The interviewer’s **question must remain attached to the answer as context**.
* Tagging should be based primarily on the **interviewee’s answer content**.
* The question is mainly for contextual interpretation.
* There will be times when a question introduces one or more tags that the answer clearly refers to but does not restate explicitly. In those cases, it is acceptable to apply the tag based on necessary context from the question.
* However, the presence of a tag in the question alone is NOT sufficient reason to assign that tag. The answer must clearly reference that topic.

All questions must be included in semantic blocks, even if they are marked as irrelevant. Often they will be grouped in the same semantic block as the answer. When that occurs:

* The question can NEVER be treated as an insight on its own unless the answer explicitly supports it.
* The question can NEVER be used as a pull quote in the final presentation. However, the answer may be used independently, with the question removed.

Never generate insights from the question alone.

---

# 3. How to Define Semantic Block Boundaries

Start a new semantic block when one of the following occurs:

### A. Topic Shift

Examples:

* Moving from Chair recruitment to ELT formation
* Switching from ELT to internal systems
* Transitioning from external leadership to internal management

### B. Process Boundary

Examples:

* “It starts with chair recruitment…”
* “Another channel is…”
* “From there, we…”

These signal a new workflow explanation.

### C. Role Boundary

When the speaker shifts focus between:

* Chair
* ELT
* Executive Champion
* Company Leader
* AHA Staff
* VP / Executive Director
* GAP meetings

### D. System Boundary

When the topic moves between:

* Salesforce
* SharePoint
* Tableau
* Financial policy
* Timeline structure
* Training / onboarding

### E. Problem or Friction Boundary

When the speaker clearly introduces:

* A constraint
* A blocker
* A workaround
* A structural gap

If none of these boundaries occur, continue appending to the current block.

---

# 4. Tagging Rules

Tag richly — but only when explicitly supported by the interviewee’s words.

Do NOT minimize tagging unnecessarily.

If a concept is clearly referenced, tag it.

Do NOT invent terms.

Do NOT apply analytical labels unless explicitly stated.

Do NOT auto-apply problem/solution/workaround labels unless the interviewee clearly describes the problem, solution, or workaround in a way that is coherent and useful to the client.

---

# 5. Granularity Target

After segmentation:

* Each block should feel like a “complete idea.”
* Each block should be intelligible if read independently.

If a block cannot stand alone as a coherent thought, segmentation is too fine.

If a block contains multiple unrelated topics, segmentation is too coarse.

---

# 6. Explanation Requirement

When a block is tagged by the analyst, the AI must also provide an “explanation” field.

This explanation must:

* Concisely explain why the block received its category, tags, and sentiment
* Focus especially on unclear or potentially controversial tagging decisions
* Be capped at 30 words
* Be shown in progress feeds for debugging and refinement

All tagged blocks must include some explanation.

---

# 7. Prompt Visibility in Apps

Going forward - all apps must include a visible text field exposing the AI prompt (or template/boilerplate) being used.

The user must be able to:

* Edit the prompt before starting
* Edit the prompt during processing
* Submit updates into active usage

This enables rapid refinement and debugging.

