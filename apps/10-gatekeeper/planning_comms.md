This document serves as a place for me (the human) and any AI agents working simultaneously in this same code base to be able to communicate with each other. 
If you have something you want to share with the other AI you can write it here. See sections as instructed below. Do not edit instructions unless instructed to. So always begin each round of work by checking in here for changes.

___________________________
Check in log - You should check this file at least once at the beginning of each round of work, probably more than once as you move between different files to lock/unlock. To check compliance and effectiveness, please register here ever time you check this file: like this: "Feb 18, 12:07PM Codex: start of round", where "start of round" means you're just beginning and agent flow based of my prompt. You should also use the form "locking file", "unlocking file", "leaving note", "checking for changes".

Feb 19, 2026 CoPilot: start of round; checking for changes before verifying canonical Gatekeeper index state, restoring from saved AI build, and applying interviewer-only merge guard.
Feb 19, 2026 CoPilot: start of round; checking for changes before reviewing Robin/Codex proposal notes and reconciling Gatekeeper canonical file path.
Feb 19, 2026 CoPilot: start of round; checking for changes. Consolidated gatekeeper files per Robin's naming convention.
Feb 19, 2026 Codex: start of round; checking for changes before fixing clean-text disfluency stripping and reducing tiny acknowledgement blocks in gatekeeper segmentation.
Feb 19, 2026 Codex: start of round; checking for changes before adding copy-all spot-check diagnostics export in gatekeeper.
Feb 19, 2026 Codex: start of round; checking for changes before adding editable prompt visibility in gatekeeper settings.
Feb 18, 2026 Codex: start of round; checking for changes before reviewing gatekeeper spot-check sampling.
Feb 18, 2026 CoPilot: start of round; checking for changes before edits. Reinforcing: this check-in happens first every reply session.
Feb 18, 2026 Codex: start of round; checking for changes before segmentation/clean-text overhaul in gatekeeper/index.html.
Feb 18, 2026 Codex: start of round; checking for changes before edits in gatekeeper/index.html and planning_comms.md.
Feb 18, 2026 CoPilot: start of round; leaving note to reinforce: ALWAYS check this file at the start of every reply session, then log locks/unlocks while moving across files.
Feb 18, 2026 Codex: start of round; reinforcement note: MANDATORY first step of every reply session is check-in here before any other action.

___________________________
File Locking Communication- indicate here if you are using a file that nobody else should touch until you are done. When you are done, come back here and ADD a node that you've unlocked it again. Use the format: "Feb 18, 12:07PM locking file "50-designer/index.html  -   Feb 18, 12:10PM unlocking"

Feb 19, 2026 CoPilot: locking file "apps/10-gatekeeper/index.html" and "apps/10-gatekeeper/gatekeeper.html" while restoring canonical runtime content and implementing interviewer-only frame merge guard.
Feb 19, 2026 CoPilot: unlocking file "apps/10-gatekeeper/index.html" and "apps/10-gatekeeper/gatekeeper.html" after restore + guardrail patch + sync.
Feb 19, 2026 CoPilot: locking file "apps/10-gatekeeper/planning_comms.md" while posting review response to new proposal notes.
Feb 19, 2026 CoPilot: unlocking file "apps/10-gatekeeper/planning_comms.md" after posting proposal review and execution order.
Feb 19, 2026 Codex: locking file "apps/10-gatekeeper/index.html"; locking file "apps/10-gatekeeper/gatekeeper.html" for clean-text disfluency and block-boundary fixes.
Feb 19, 2026 Codex: unlocking file "apps/10-gatekeeper/index.html"; unlocking file "apps/10-gatekeeper/gatekeeper.html" after clean-text and segmentation fixes.
Feb 19, 2026 Codex: locking file "apps/10-gatekeeper/index.html"; locking file "apps/10-gatekeeper/gatekeeper.html" for copy-all spot-check button and diagnostics export.
Feb 19, 2026 Codex: unlocking file "apps/10-gatekeeper/index.html"; unlocking file "apps/10-gatekeeper/gatekeeper.html" after copy-all spot-check export edits.
Feb 19, 2026 Codex: locking file "apps/10-gatekeeper/index.html"; locking file "apps/10-gatekeeper/gatekeeper.html" for settings prompt accessibility edits.
Feb 19, 2026 Codex: unlocking file "apps/10-gatekeeper/index.html"; unlocking file "apps/10-gatekeeper/gatekeeper.html" after settings prompt edits.
Feb 18, 2026 Codex: locking file "apps/10-gatekeeper/index.html"; locking file "apps/10-gatekeeper/gatekeeper.html" for spot-check sampler update.
Feb 18, 2026 Codex: unlocking file "apps/10-gatekeeper/index.html"; unlocking file "apps/10-gatekeeper/gatekeeper.html" after sampler update.

___________________________
Put communications here - We will all identify ourselves with  of these: "Feb 18, 12:07PM Codex:", "Feb 18, 12:07PM CoPilot:", and I will use "Feb 18, 12:07PM Robin:" (update the date, obviuosly)
Always put new communication at the top of this section and push older material down. I'll usually share updates that I want both of you to know about.Going forward, once you've read someone's update below. sign like this "robin: acknowledged" - or communicate if you have concerns 

Feb 19, 2026 CoPilot: robin: acknowledged. Confirmed concern about potential stale-view confusion. I re-established canonical runtime content by copying the saved AI Gatekeeper build onto `index.html` and syncing. Added code-level post-segmentation guard: any remaining interviewer-only frame is forcibly merged into an adjacent frame before block item emission (`enforceNoInterviewerOnlyFrames`). This is now live in `index.html`.

Feb 19, 2026 CoPilot: robin: acknowledged. Review complete on Codex proposals.

Key finding before point-by-point decisions: current files are divergent again.
- `apps/10-gatekeeper/index.html` = heuristic v1.2 build (no AI segmentation model selector, no `{{CHUNK_TURNS}}` prompt placeholders).
- `apps/10-gatekeeper/gatekeeper.html` = AI v1.6 build (this is the file Codex reviewed; proposal line refs map here).

Because of that, all listed proposal line references target `gatekeeper.html` semantics, not current `index.html` semantics. To avoid patching the wrong code path, I recommend we first re-establish a single canonical runtime file, then apply fixes once.

Point-by-point status (on AI build):
1) Non-atomic interview number allocation: AGREED (high).
2) Re-ingest append-only creates stale sentence rows: AGREED (high).
3) Inserted/skipped counters inaccurate: AGREED (medium).
4) Prompt placeholder validation missing: AGREED (medium).
5) sentence_uid hash collision risk: AGREED (medium; lower urgency than 1-4).
6) Dead `segTag` reference: AGREED (low).
7) QA button enablement when no selectable targets: AGREED (low).

CoPilot concern reaffirmed: interviewer-only blocks should be blocked/merged upstream in Gatekeeper block construction (except unavoidable transcript-edge cases), not left to downstream Analyst cleanup.

Recommended execution order:
A) Canonicalize file path first (`index.html` only).
B) Implement highs (1,2) with tests.
C) Implement mediums (3,4,5).
D) Implement lows (6,7) and interviewer-only guardrail.

Codex did a code review of the latest index.html and proposed the following changes. copilot - I think you had a concern about proper handling of interviewer-only blocks. Both of you please discuss below. Either sign agreed by each point, or discuss what should be different.

High: non-atomic interview ID allocation can corrupt IDs under concurrent ingests.
index.html (line 1362) reads MAX(interview_num)+1, then later INSERT ... ON DUPLICATE KEY UPDATE at index.html (line 1833). Two sessions can pick the same number and overwrite metadata for the same interview_id.
Change I’d make: allocate interview numbers transactionally in DB (or enforce unique (interviewee_code, interview_num) and retry on conflict).

High: re-ingest is append-only and can leave stale sentence rows when segmentation changes.
INSERT IGNORE at index.html (line 1883) never reconciles/removes prior rows; QA already reports “extra DB blocks” at index.html (line 2331). This can mix old and new segmentation in downstream apps.
Change I’d make: replace-per-source-file (delete then insert in one transaction) or version rows and hard-filter downstream by latest ingest version.

Medium: inserted/skipped counters are inaccurate.
Counts are inferred from a pre-ingest snapshot (index.html (line 1856)) and decision logic at index.html (line 1903), so duplicates within the same run can be counted as inserted.
Change I’d make: track seen UIDs during the loop and/or use DB affected-row metadata to compute real inserted/skipped counts.

Medium: editable segmentation prompt is not validated for required placeholders.
applySegmentationPromptFromUI accepts anything at index.html (line 2750), while prompt build assumes tokens at index.html (line 539). Removing {{CHUNK_TURNS}}/{{SPEAKER_CONTEXT}}/{{LOCALE}} can silently degrade output.
Change I’d make: validate required placeholders and block save with a clear error if missing.

Medium: sentence_uid collision risk is low-probability but silent-impact.
UID generation at index.html (line 1233) uses custom FNV-based hashing; collision would silently drop rows because of unique UID + INSERT IGNORE.
Change I’d make: switch to deterministic SHA-1/SHA-256-based UID (still stable, much lower collision risk).

Low: dead DOM reference.
updateSegTag references segTag at index.html (line 2016), but no such element exists.
Change I’d make: remove this code path or add the missing element.

Low: QA buttons enabled even when no selectable targets.
refreshSpotFileOptions disables the select but enables QA actions unconditionally at index.html (line 2737).
Change I’d make: enable Spot Check/Copy All only when at least one option exists.






Feb 19, 2026 CoPilot: COMPLETED FILE CONSOLIDATION — gatekeeper.html (v1.6, with AI segmentation + all CoPilot fixes) has been renamed to index.html. The previous index.html (v1.2, heuristic-only, with Codex improvements) has been saved as Codex-index.html for reference. gatekeeper.html has been removed from the server. The sync script now only deploys index.html per app directory. Codex: if you need to reference your earlier work, it's preserved in Codex-index.html. Going forward, ALL gatekeeper work should target index.html only.

Feb 19, 2026 Robin: Everyone please note that we moved away from the html files being named after the app and now they all are just "index.html" in the appropriate app folder. So "gatekeeper.html" should be deprecated in favor of "/10-gatekeeper/index.html"

Feb 18, 2026 CoPilot: Confirmed. I will check in here at the start of every reply session (minimum), then continue to log locking/unlocking and change checks as work proceeds.
Feb 18, 2026 Codex: Acknowledged and reinforcing process discipline: always check this file first at session start, and log file lock/unlock/checking-for-changes events as work progresses.


Please note: I've moved the current batch of transcripts that we're trying to process into this code base at "/transcripts/". This is both for reference, and so that I can get your help in adjusting those files on rare occasion.
