    import { DBHelper } from "https://happydo.xyz/api_auto_db/db_helper.js";
    import { askAI } from "https://happydo.xyz/api/ailnl.js";

    const APP_VERSION = "v1.4.1";
    const APP_LAST_UPDATED_UTC = "2026-02-20T01:25:00Z";
    const EXCLUDED_SYNTH_TAGS = ["catch_irrelevant", "catch_miscellaneous"];
    const EXCLUDED_SYNTH_TAGS_SQL = EXCLUDED_SYNTH_TAGS.map(t => `'${t.replace(/'/g, "''")}'`).join(",");

    function formatLocalLastUpdated(utcIso) {
        const dt = new Date(utcIso);
        return dt.toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short"
        });
    }

    function renderAppMeta() {
        const el = document.getElementById("appMeta");
        if (!el) return;
        el.textContent = `Version ${APP_VERSION} · Last updated ${formatLocalLastUpdated(APP_LAST_UPDATED_UTC)}`;
    }

    renderAppMeta();

    const APP_NAME = "HWIE_v2"; // Fresh DB; legacy stays on HWIE_v1

    // Systems overview must be included in every prompt.
    const HW_SYSTEMS_OVERVIEW = `
Heart Walk is a market-based fundraising and engagement campaign by the American Heart Association (AHA).
Goals: generate corporate sponsorship revenue, engage companies/community leaders, activate employee participation, build long-term leadership pipelines.

Organizational Structure:
- National Level: sets strategy, develops resources, provides reporting systems, offers regional oversight
- Market Level: executes Heart Walk locally, recruits/manages volunteer leadership, manages corporate relationships, coordinates meetings/events

Internal AHA Leadership (paid staff): Executive Director (ED), Development Director (DD), Senior Development Director, Senior Vice President (SVP), Director
External Volunteer Leadership: ELT Chair, ELT Members, Market Board Members, Corporate Executives, Team Captains

Meetings & Cadence: ELT meetings, GAP meetings, strategy meetings, internal coordination, executive networking breakfasts
Tools/Systems: Salesforce, SharePoint, reporting dashboards, pipeline trackers, impact plans, annotated agendas, slide decks, email/call/text templates
`.trim();

        const DEFAULT_SYNTH_PROMPT_TEMPLATE = `You are the "Synthesizer" agent for the Heart Walk evidence database.

== HEART WALK SYSTEMS OVERVIEW (CONTEXT) ==
{{SYSTEMS_OVERVIEW}}

== GOAL ==
Cluster the provided coded semantic blocks into discrete, concise insights.

== HARD RULES ==
1. Every insight MUST include at least 1 supporting block.
2. Use ONLY the provided sentence_ids for evidence links.
3. Blocks may support multiple insights (many-to-many).
4. Provide quote_rank 0..3 for each evidence block.
5. Each insight must include at least ONE evidence block with quote_rank >= 2.
6. support_role must be one of: direct_quote, evidence, context, counterpoint.
7. Do not invent topic labels. Topic semantics come from the supporting block tags.
8. Evidence sentence_ids within one insight MUST be unique (no duplicates).
9. Avoid duplicate or near-duplicate insights; merge overlapping ideas into one stronger insight.
10. Prefer 2-6 evidence blocks per insight when available.
11. If an insight cannot satisfy all hard rules, omit it (do not emit invalid items).

== INPUT (CODED BLOCKS) ==
{{INPUT_BLOCKS}}

== REQUIRED OUTPUT (JSON ONLY) ==
Return ONLY a JSON object (no markdown fences, no commentary outside the JSON).
The object MUST have exactly two keys: "insights" (array) and "_meta" (diagnostics object).

{
  "insights": [
    {
      "summary_plain": "One-sentence insight statement.",
      "summary_long": "(optional) 1-3 sentence elaboration.",
      "evidence": [
        {
          "sentence_id": "LV.001",
          "quote_rank": 3,
          "support_role": "direct_quote",
          "notes": "optional"
        }
      ]
    }
  ],
  "_meta": {
    "input_block_count": 18,
    "input_ids_received": ["LV.001", "CB.004"],
    "insights_produced": 3,
    "blocks_used_count": 12,
    "blocks_unused": [
      { "sentence_id": "KB.007", "reason": "too vague / no clear insight" }
    ],
    "rule_violations_caught": [
      "Merged 2 near-duplicate insights about sponsorship outreach"
    ],
    "warnings": [
      "Block LV.042 has no substantive content; skipped"
    ],
    "model_notes": "Batch contained mostly meeting-related blocks; 3 insights clustered around ELT agenda themes."
  }
}

== SELF-CHECK BEFORE OUTPUT ==
- Every evidence.sentence_id must be one of the input sentence_ids.
- quote_rank must be integer 0..3.
- support_role must be one of the allowed enum values.
- Every insight must have evidence.length >= 1 and at least one quote_rank >= 2.
- No duplicate sentence_id inside a single insight.evidence.
- No two insights should express substantially the same summary_plain.
- _meta.input_block_count must equal the number of input blocks you received.
- _meta.blocks_used_count + len(blocks_unused) should account for all input blocks.
- If you cannot produce ANY valid insights, return {"insights":[], "_meta":{...}} with an explanation in model_notes.`;

    let isRunning = false;
    let shouldStop = false;
    let logCount = 0;
    const DEBUG_LIMITS = {
        maxApiTrafficRows: 120,
        maxInsightsExport: 250,
        maxRunsExport: 200,
        maxCharsIo: 4000,
        maxLogRows: 800
    };
    const debugState = {
        apiTraffic: [],
        logHistory: []
    };

    async function runButtonAction(button, pendingLabel, action) {
        if (!button) return action();
        const original = button.dataset.originalText || button.textContent;
        button.dataset.originalText = original;
        button.disabled = true;
        button.textContent = pendingLabel;
        try {
            const result = await action();
            button.textContent = "✅ Done";
            setTimeout(() => {
                button.textContent = original;
                button.disabled = false;
            }, 1400);
            return result;
        } catch (e) {
            if (e?.cancelled) {
                button.textContent = "↩ Cancelled";
                setTimeout(() => {
                    button.textContent = original;
                    button.disabled = false;
                }, 900);
                return;
            }
            button.textContent = "❌ Failed";
            setTimeout(() => {
                button.textContent = original;
                button.disabled = false;
            }, 1800);
            throw e;
        }
    }

    async function init() {
        log("info", "BOOT", "Initializing Synthesizer v1…");
        try {
            await DBHelper.init(APP_NAME);
            setDot("dot-db", "green", "DB — connected ✓");
            log("ok", "DB", "Connected to " + APP_NAME);
        } catch (e) {
            setDot("dot-db", "red", "DB — FAILED");
            log("err", "DB", "Connection failed: " + e.message);
            return;
        }

        await ensureSchema();
        const promptEl = document.getElementById("promptTemplate");
        if (promptEl) promptEl.value = DEFAULT_SYNTH_PROMPT_TEMPLATE;
        await refreshStats();
        log("ok", "BOOT", "Synthesizer ready.");

        // ── Auto-run from URL parameters ──
        const params = new URLSearchParams(window.location.search);
        if (params.get("autorun") === "1") {
            log("info", "AUTORUN", "Auto-run triggered via URL parameter.");
            // Apply overrides
            const bsParam = parseInt(params.get("batchSize"));
            if (bsParam && bsParam >= 5 && bsParam <= 60) {
                document.getElementById("batchSize").value = bsParam;
                log("info", "AUTORUN", `Batch size override: ${bsParam}`);
            }
            const modelParam = params.get("model");
            if (modelParam) {
                const sel = document.getElementById("modelSelect");
                const opt = Array.from(sel.options).find(o => o.value === modelParam);
                if (opt) { sel.value = modelParam; log("info", "AUTORUN", `Model override: ${modelParam}`); }
            }
            // Optional reset first
            if (params.get("reset") === "1") {
                log("warn", "AUTORUN", "Resetting synthesis outputs before auto-run...");
                await window.resetSynthesisOutputs();
                await sleep(500);
            }
            // Start synthesis — when it finishes, auto-deposit
            log("ok", "AUTORUN", "Starting synthesis...");
            await window.startSynthesis();
            log("ok", "AUTORUN", "Synthesis loop finished. Depositing results...");
            await autoDepositResults();
        }
    }

    // ── Auto-deposit results to app_output table ──
    async function autoDepositResults() {
        try {
            // Ensure output table exists
            await DBHelper.query(APP_NAME, `
                CREATE TABLE IF NOT EXISTS app_output (
                    output_id   INT PRIMARY KEY AUTO_INCREMENT,
                    app_stage   VARCHAR(50) NOT NULL,
                    status      VARCHAR(20) DEFAULT 'ok',
                    payload     LONGTEXT,
                    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Gather summary data
            const insightCount = (await DBHelper.query(APP_NAME, "SELECT COUNT(*) AS c FROM insights"))?.rows?.[0]?.c || 0;
            const linkCount = (await DBHelper.query(APP_NAME, "SELECT COUNT(*) AS c FROM insight_sentences"))?.rows?.[0]?.c || 0;
            const queueStatus = (await DBHelper.query(APP_NAME, "SELECT status, COUNT(*) AS c FROM sentence_synthesis_queue GROUP BY status"))?.rows || [];
            const runCount = (await DBHelper.query(APP_NAME, "SELECT COUNT(*) AS c FROM ai_runs WHERE purpose='extract_insights'"))?.rows?.[0]?.c || 0;

            const payload = {
                completed_at_utc: new Date().toISOString(),
                insights_total: parseInt(insightCount),
                evidence_links_total: parseInt(linkCount),
                ai_runs_total: parseInt(runCount),
                queue_status: queueStatus,
                log_tail: debugState.logHistory.slice(-30),
                api_traffic_tail: debugState.apiTraffic.slice(-10)
            };

            const escaped = JSON.stringify(payload).replace(/'/g, "\\'");
            await DBHelper.query(APP_NAME, `INSERT INTO app_output (app_stage, status, payload) VALUES ('synthesizer', 'completed', '${escaped}')`);
            log("ok", "AUTORUN", `Results deposited to app_output. Insights=${insightCount}, Links=${linkCount}`);
        } catch (e) {
            log("err", "AUTORUN", "Auto-deposit failed: " + (e?.message || e));
        }
    }

    async function ensureSchema() {
        log("info", "SCHEMA", "Ensuring insight schema…");
        try {
            await DBHelper.query(APP_NAME, `
                CREATE TABLE IF NOT EXISTS insights (
                    insight_id               INT PRIMARY KEY AUTO_INCREMENT,
                    summary_plain            TEXT NOT NULL,
                    summary_long             TEXT,
                    dominant_sentiment_score TINYINT DEFAULT 0,
                    is_problem               TINYINT(1) DEFAULT 0,
                    is_solution              TINYINT(1) DEFAULT 0,
                    is_explanation           TINYINT(1) DEFAULT 0,
                    is_workaround            TINYINT(1) DEFAULT 0,
                    created_by_run_id        INT,
                    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await DBHelper.query(APP_NAME, `
                CREATE TABLE IF NOT EXISTS insight_sentences (
                    insight_id    INT NOT NULL,
                    sentence_id   VARCHAR(50) NOT NULL,
                    quote_rank    TINYINT DEFAULT 0,
                    support_role  VARCHAR(30) DEFAULT 'evidence',
                    notes         TEXT,
                    PRIMARY KEY (insight_id, sentence_id)
                )
            `);

            await DBHelper.query(APP_NAME, `
                CREATE TABLE IF NOT EXISTS sentence_synthesis_queue (
                    sentence_id VARCHAR(50) PRIMARY KEY,
                    status      VARCHAR(20) DEFAULT 'unprocessed',
                    last_run_id INT,
                    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);

            // Best-effort backfill queue table
            await DBHelper.query(APP_NAME, `
                INSERT IGNORE INTO sentence_synthesis_queue (sentence_id, status)
                SELECT sentence_id, 'unprocessed'
                FROM sentences
                WHERE review_status = 'finalized'
            `);

            setDot("dot-schema", "green", "Schema — OK ✓");
            log("ok", "SCHEMA", "Insight tables ready.");

        } catch (e) {
            setDot("dot-schema", "red", "Schema — FAILED");
            log("err", "SCHEMA", e.message);
        }
    }

    async function fetchThematicBatch(batchSize) {
        const seedRes = await DBHelper.query(APP_NAME, `
            SELECT s.sentence_id
            FROM sentences s
            JOIN sentence_synthesis_queue q ON q.sentence_id = s.sentence_id
            JOIN sentence_tags st ON st.sentence_id = s.sentence_id
            JOIN tags t ON t.tag_id = st.tag_id
            WHERE s.review_status = 'finalized'
              AND q.status = 'unprocessed'
              AND t.tag_key NOT IN (${EXCLUDED_SYNTH_TAGS_SQL})
            GROUP BY s.sentence_id
            ORDER BY s.sentence_id ASC
            LIMIT 1
        `);
        const seedId = seedRes?.rows?.[0]?.sentence_id;
        if (!seedId) return [];

        const safeSeed = String(seedId).replace(/'/g, "''");
        const tagRes = await DBHelper.query(APP_NAME, `
            SELECT DISTINCT t.tag_key
            FROM sentence_tags st
            JOIN tags t ON t.tag_id = st.tag_id
            WHERE st.sentence_id='${safeSeed}'
              AND t.tag_key NOT IN (${EXCLUDED_SYNTH_TAGS_SQL})
        `);
        const seedTags = (tagRes?.rows || []).map(r => String(r.tag_key || "").trim()).filter(Boolean);
        if (seedTags.length === 0) return [];

        const tagListSql = seedTags.map(t => `'${t.replace(/'/g, "''")}'`).join(",");
        const batchRes = await DBHelper.query(APP_NAME, `
            SELECT DISTINCT s.sentence_id, s.raw_text, s.clean_text, s.sentiment_score,
                   s.is_problem, s.is_solution, s.is_explanation, s.is_workaround,
                   s.timestamp_block, s.speaker
            FROM sentences s
            JOIN sentence_synthesis_queue q ON q.sentence_id = s.sentence_id
            JOIN sentence_tags st ON st.sentence_id = s.sentence_id
            JOIN tags t ON t.tag_id = st.tag_id
            WHERE s.review_status = 'finalized'
              AND q.status = 'unprocessed'
              AND t.tag_key IN (${tagListSql})
              AND t.tag_key NOT IN (${EXCLUDED_SYNTH_TAGS_SQL})
            ORDER BY s.sentence_id ASC
            LIMIT ${batchSize}
        `);

        const batch = batchRes?.rows || [];
        if (batch.length === 0) return [];

        const idsSql = batch.map(r => `'${String(r.sentence_id).replace(/'/g, "''")}'`).join(",");
        const tagsRes = await DBHelper.query(APP_NAME, `
            SELECT st.sentence_id, t.tag_key
            FROM sentence_tags st
            JOIN tags t ON t.tag_id = st.tag_id
            WHERE st.sentence_id IN (${idsSql})
              AND t.tag_key NOT IN (${EXCLUDED_SYNTH_TAGS_SQL})
        `);

        const tagMap = {};
        for (const row of (tagsRes?.rows || [])) {
            if (!tagMap[row.sentence_id]) tagMap[row.sentence_id] = [];
            tagMap[row.sentence_id].push(row.tag_key);
        }

        const enriched = batch
            .map(s => ({
                ...s,
                text: s.clean_text || s.raw_text,
                tags: tagMap[s.sentence_id] || []
            }))
            .filter(s => s.tags.length > 0);

        // If thematic batch is too small (< 3), broaden to any unprocessed non-excluded items
        if (enriched.length < 3) {
            log("info", "BATCH", `Thematic batch only ${enriched.length} item(s). Broadening to any unprocessed non-excluded blocks.`);
            const existingIds = new Set(enriched.map(e => e.sentence_id));
            const broadRes = await DBHelper.query(APP_NAME, `
                SELECT DISTINCT s.sentence_id, s.raw_text, s.clean_text, s.sentiment_score,
                       s.is_problem, s.is_solution, s.is_explanation, s.is_workaround,
                       s.timestamp_block, s.speaker
                FROM sentences s
                JOIN sentence_synthesis_queue q ON q.sentence_id = s.sentence_id
                JOIN sentence_tags st ON st.sentence_id = s.sentence_id
                JOIN tags t ON t.tag_id = st.tag_id
                WHERE s.review_status = 'finalized'
                  AND q.status = 'unprocessed'
                  AND t.tag_key NOT IN (${EXCLUDED_SYNTH_TAGS_SQL})
                ORDER BY s.sentence_id ASC
                LIMIT ${batchSize}
            `);
            for (const r of (broadRes?.rows || [])) {
                if (!existingIds.has(r.sentence_id)) {
                    existingIds.add(r.sentence_id);
                    enriched.push({ ...r, text: r.clean_text || r.raw_text, tags: [] });
                }
                if (enriched.length >= batchSize) break;
            }
            // Fetch tags for newly added items
            if (enriched.some(e => e.tags.length === 0)) {
                const allIdsSql = enriched.map(r => `'${String(r.sentence_id).replace(/'/g, "''")}'`).join(",");
                const allTagsRes = await DBHelper.query(APP_NAME, `
                    SELECT st.sentence_id, t.tag_key FROM sentence_tags st
                    JOIN tags t ON t.tag_id = st.tag_id
                    WHERE st.sentence_id IN (${allIdsSql})
                      AND t.tag_key NOT IN (${EXCLUDED_SYNTH_TAGS_SQL})
                `);
                const allTagMap = {};
                for (const row of (allTagsRes?.rows || [])) {
                    if (!allTagMap[row.sentence_id]) allTagMap[row.sentence_id] = [];
                    allTagMap[row.sentence_id].push(row.tag_key);
                }
                for (const e of enriched) {
                    if (e.tags.length === 0 && allTagMap[e.sentence_id]) e.tags = allTagMap[e.sentence_id];
                }
            }
            // Remove items with still no tags
            const final = enriched.filter(s => s.tags.length > 0);
            if (final.length !== enriched.length) {
                log("info", "BATCH", `Removed ${enriched.length - final.length} item(s) with no non-excluded tags.`);
            }
            enriched.length = 0;
            enriched.push(...final);
        }

        if (enriched.length > 0) {
            const topTags = seedTags.slice(0, 4).join(", ");
            log("info", "BATCH", `Theme seed tags: ${topTags}${seedTags.length > 4 ? ", ..." : ""} | Batch size: ${enriched.length}`);
        }

        return enriched;
    }

    window.refreshStats = async function() {
        try {
            const s = await DBHelper.query(APP_NAME, "SELECT COUNT(*) AS cnt FROM sentences WHERE review_status='finalized'");
            const i = await DBHelper.query(APP_NAME, "SELECT COUNT(*) AS cnt FROM insights");
            const finalized = parseInt(s?.rows?.[0]?.cnt || 0);
            const insights  = parseInt(i?.rows?.[0]?.cnt || 0);
            setText("statFinalized", finalized);
            setText("statInsights", insights);

            await refreshRunStatus();

            document.getElementById("btnStart").disabled = finalized === 0 || isRunning;
        } catch (e) {
            log("warn", "STATS", "Could not load stats: " + e.message);
        }
    };

    async function refreshRunStatus() {
        const dot = document.getElementById("dot-run");
        const stateEl = document.getElementById("runStateLabel");
        const countsEl = document.getElementById("runCountsLabel");
        if (!dot || !stateEl || !countsEl) return;

        let counts;
        try {
            const res = await DBHelper.query(APP_NAME, `
                SELECT
                    (SELECT COUNT(*) FROM sentence_synthesis_queue WHERE status='unprocessed') AS unprocessed,
                    (SELECT COUNT(*) FROM sentence_synthesis_queue WHERE status='queued') AS queued,
                    (SELECT COUNT(*) FROM sentence_synthesis_queue WHERE status='processed') AS processed,
                    (SELECT COUNT(*) FROM sentence_synthesis_queue WHERE status='error') AS error
            `);
            counts = res?.rows?.[0] || {};
        } catch (e) {
            stateEl.textContent = isRunning ? "Synth — running" : "Synth — idle";
            dot.className = `status-dot ${isRunning ? "dot-yellow" : "dot-grey"}`;
            countsEl.textContent = `Queue: (failed to load) ${e?.message || e}`;
            return;
        }

        const unprocessed = parseInt(counts.unprocessed || 0);
        const queued = parseInt(counts.queued || 0);
        const processed = parseInt(counts.processed || 0);
        const error = parseInt(counts.error || 0);

        let stateText = "Synth — idle";
        let dotClass = "dot-grey";
        if (isRunning) {
            stateText = shouldStop ? "Synth — stopping…" : "Synth — running";
            dotClass = shouldStop ? "dot-yellow" : "dot-green";
        } else {
            if (unprocessed === 0 && queued === 0) {
                stateText = "Synth — done";
                dotClass = "dot-green";
            }
        }

        stateEl.textContent = stateText;
        dot.className = `status-dot ${dotClass}`;
        countsEl.textContent = `Queue: unprocessed ${unprocessed} · queued ${queued} · processed ${processed} · error ${error}`;
    }

    window.startSynthesis = async function() {
        if (isRunning) return;
        isRunning = true;
        shouldStop = false;
        document.getElementById("btnStart").disabled = true;
        document.getElementById("btnStop").disabled = false;
        switchTab("log");

        const batchSize = clampInt(parseInt(document.getElementById("batchSize").value) || 20, 5, 60);
        const model = document.getElementById("modelSelect").value;

        log("ok", "START", `Synthesis started. Batch=${batchSize}, Model=${model}`);
        await refreshRunStatus();

        const MAX_CONSECUTIVE_FAILURES = 5;
        let consecutiveFailures = 0;

        while (!shouldStop) {
            // Pull a thematic batch: only non-catch tags, grouped by shared tags
            let enriched;
            try {
                enriched = await fetchThematicBatch(batchSize);
            } catch (e) {
                log("err", "LOAD", "DB query failed: " + e.message);
                break;
            }

            if (!enriched || enriched.length === 0) {
                log("ok", "DONE", "No eligible thematic blocks remaining (only irrelevant/misc or untagged blocks left)." );
                break;
            }

            // Lock the batch
            const ids = enriched.map(r => `'${r.sentence_id.replace(/'/g, "''")}'`).join(",");
            try {
                await DBHelper.query(APP_NAME, `
                    UPDATE sentence_synthesis_queue
                    SET status='queued'
                    WHERE sentence_id IN (${ids})
                `);
            } catch(_) {}

            log("info", "BATCH", `Synthesizing from ${enriched.length} coded blocks…`);
            const runId = await insertRun("extract_insights", model, enriched.map(s => s.sentence_id));

            // If we can't track this run, abort batch — prevents orphan artifacts
            if (!runId) {
                log("err", "RUN", "Aborting batch: could not create tracked ai_run (runId is null). Reverting queue to unprocessed.");
                try {
                    await DBHelper.query(APP_NAME, `
                        UPDATE sentence_synthesis_queue
                        SET status='unprocessed'
                        WHERE sentence_id IN (${ids})
                    `);
                } catch(_) {}
                consecutiveFailures++;
                if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                    log("err", "HALT", `Auto-stopped: ${MAX_CONSECUTIVE_FAILURES} consecutive failures (runId null). Check DB connectivity.`);
                    break;
                }
                await sleep(1500);
                continue;
            }

            const batchOk = await synthesizeBatch(enriched, model, runId);

            if (batchOk) {
                consecutiveFailures = 0;
            } else {
                consecutiveFailures++;
                if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                    log("err", "HALT", `Auto-stopped: ${MAX_CONSECUTIVE_FAILURES} consecutive batch failures. Check API Traffic tab for raw AI responses.`);
                    break;
                }
            }

            await refreshStats();
            await refreshRunStatus();

            await sleep(700);
        }

        isRunning = false;
        shouldStop = false;
        document.getElementById("btnStop").disabled = true;
        document.getElementById("btnStart").disabled = false;
        log("ok", "FINISH", "Synthesis loop ended.");
        await refreshRunStatus();
    };

    window.stopSynthesis = function() {
        shouldStop = true;
        document.getElementById("btnStop").disabled = true;
        log("warn", "STOP", "Stop requested — finishing current batch…");
        refreshRunStatus();
    };

    globalThis.resetSynthesisOutputs = window.resetSynthesisOutputs = async function(triggerBtn = null) {
        const btn = triggerBtn || document.getElementById("btnResetSynth");
        return runButtonAction(btn, "⏳ Resetting...", async () => {
            if (!confirm("Reset ALL Synthesizer outputs?\n\nThis will:\n• Delete all insight_sentences links\n• Delete all insights\n• Reset sentence_synthesis_queue statuses to 'unprocessed'\n• Delete ai_runs rows where purpose='extract_insights'\n\nThis CANNOT be undone.")) {
                throw { cancelled: true };
            }
            if (!confirm("Are you absolutely sure? This will erase all synthesized insights and evidence links.")) {
                throw { cancelled: true };
            }

            await DBHelper.query(APP_NAME, "DELETE FROM insight_sentences");
            await DBHelper.query(APP_NAME, "DELETE FROM insights");
            await DBHelper.query(APP_NAME, "UPDATE sentence_synthesis_queue SET status='unprocessed', last_run_id=NULL");
            try {
                await DBHelper.query(APP_NAME, "DELETE FROM ai_runs WHERE purpose='extract_insights'");
            } catch (_) {}

            const verifyRes = await DBHelper.query(APP_NAME, `
                SELECT
                    (SELECT COUNT(*) FROM insights) AS insight_cnt,
                    (SELECT COUNT(*) FROM insight_sentences) AS link_cnt,
                    (SELECT COUNT(*) FROM sentence_synthesis_queue WHERE status <> 'unprocessed') AS queued_or_processed,
                    (SELECT COUNT(*) FROM sentence_synthesis_queue) AS queue_total
            `);
            const row = verifyRes?.rows?.[0] || {};
            const insightCnt = parseInt(row.insight_cnt || 0);
            const linkCnt = parseInt(row.link_cnt || 0);
            const queueNotUnprocessed = parseInt(row.queued_or_processed || 0);
            const queueTotal = parseInt(row.queue_total || 0);

            if (insightCnt === 0 && linkCnt === 0 && queueNotUnprocessed === 0) {
                log("ok", "RESET", `Checked DB: insights=0, insight_sentences=0, queue non-unprocessed=0 (queue total ${queueTotal}).`);
            } else {
                log("warn", "RESET", `Checked DB after reset: insights=${insightCnt}, links=${linkCnt}, queue non-unprocessed=${queueNotUnprocessed}, queue total=${queueTotal}.`);
            }

            await refreshStats();
            if (document.querySelector(".tab[data-tab='insights']")?.classList.contains("active")) {
                await loadInsights();
            }
        }).catch((e) => {
            if (e?.cancelled) {
                log("info", "RESET", "Reset cancelled by user.");
                return;
            }
            log("err", "RESET", e.message);
        });
    };

    function generateMarker() {
        return 'mk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    }

    async function insertRun(purpose, model, inputIds) {
        // Uses the ai_runs table created by Analyst (or creates it if missing)
        try {
            await DBHelper.query(APP_NAME, `
                CREATE TABLE IF NOT EXISTS ai_runs (
                    run_id        INT          PRIMARY KEY AUTO_INCREMENT,
                    purpose       VARCHAR(60),
                    model_name    VARCHAR(60),
                    batch_size    INT,
                    input_ids     TEXT,
                    output_json   MEDIUMTEXT,
                    status        VARCHAR(30)  DEFAULT 'completed',
                    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
                )
            `);
        } catch(_) {}

        try {
            const safeInput = JSON.stringify(inputIds).replace(/'/g, "''");
            // Use a unique marker to locate the row reliably
            // (LAST_INSERT_ID() is unreliable across stateless proxy connections)
            const marker = generateMarker();
            const safeMarker = marker.replace(/'/g, "''");
            await DBHelper.query(APP_NAME, `
                INSERT INTO ai_runs (purpose, model_name, batch_size, input_ids, output_json, status)
                VALUES ('${purpose}', '${model}', ${inputIds.length}, '${safeInput}', '${safeMarker}', 'running')
            `);

            // Retrieve by marker with retry (proxy connection may lag)
            let runId = null;
            for (let attempt = 0; attempt < 3; attempt++) {
                if (attempt > 0) await sleep(300 * attempt);
                const idRes = await DBHelper.query(APP_NAME,
                    `SELECT run_id FROM ai_runs WHERE output_json='${safeMarker}' AND status='running' ORDER BY run_id DESC LIMIT 1`
                );
                runId = parseInt(idRes?.rows?.[0]?.run_id || 0) || null;
                if (runId) break;
            }

            // Fallback: get the most recent running extract_insights row
            if (!runId) {
                log("warn", "RUN", `Marker lookup failed after 3 attempts (marker: ${marker}). Trying fallback...`);
                const fallback = await DBHelper.query(APP_NAME,
                    `SELECT run_id FROM ai_runs WHERE purpose='${purpose}' AND model_name='${model}' AND status='running' ORDER BY run_id DESC LIMIT 1`
                );
                runId = parseInt(fallback?.rows?.[0]?.run_id || 0) || null;
            }

            if (runId) {
                // Clear the marker from output_json
                await DBHelper.query(APP_NAME, `UPDATE ai_runs SET output_json=NULL WHERE run_id=${runId}`);
                log("info", "RUN", `Created ai_run ${runId} (marker: ${marker})`);
            } else {
                log("err", "RUN", `Inserted ai_run but could not retrieve ID after retry+fallback (marker: ${marker})`);
            }
            return runId;
        } catch(e) {
            log("err", "DB", "insertRun failed: " + (e?.message || e));
            return null;
        }
    }

    function buildPrompt(enrichedSentences) {
        const inputLines = enrichedSentences.map(s => {
            return JSON.stringify({
                sentence_id: s.sentence_id,
                text: s.text,
                sentiment_score: parseInt(s.sentiment_score) || 0,
                flags: {
                    is_problem: !!parseInt(s.is_problem),
                    is_solution: !!parseInt(s.is_solution),
                    is_explanation: !!parseInt(s.is_explanation),
                    is_workaround: !!parseInt(s.is_workaround)
                },
                tags: s.tags,
                timestamp: s.timestamp_block || "",
                speaker: s.speaker || ""
            });
        }).join("\n");

                const promptTemplate = normalizePromptTemplate(
                        document.getElementById("promptTemplate")?.value,
                        DEFAULT_SYNTH_PROMPT_TEMPLATE
                );

                return promptTemplate
                        .replaceAll("{{SYSTEMS_OVERVIEW}}", HW_SYSTEMS_OVERVIEW)
                        .replaceAll("{{INPUT_BLOCKS}}", inputLines);
    }

    function buildInputBlocksPreview(enrichedSentences, maxItems = 8, maxTextChars = 180) {
        return (enrichedSentences || []).slice(0, maxItems).map(s => ({
            sentence_id: s.sentence_id,
            text_preview: String(s.text || "").replace(/\s+/g, " ").trim().slice(0, maxTextChars),
            tags: Array.isArray(s.tags) ? s.tags.slice(0, 6) : []
        }));
    }

    function splitHeadTail(text, maxChars = 1200) {
        const value = String(text || "");
        return {
            head: value.slice(0, maxChars),
            tail: value.slice(Math.max(0, value.length - maxChars))
        };
    }

    function stripMarkdownCodeFences(text) {
        const value = String(text || "");
        const m = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
        return (m ? m[1] : value).trim();
    }

    function extractFirstJsonSubstring(text, openChar, closeChar) {
        const s = String(text || "");
        if (!s) return null;

        for (let i = 0; i < s.length; i++) {
            if (s[i] !== openChar) continue;

            let depth = 0;
            let inString = false;
            let escaped = false;

            for (let j = i; j < s.length; j++) {
                const ch = s[j];

                if (inString) {
                    if (escaped) {
                        escaped = false;
                        continue;
                    }
                    if (ch === "\\") {
                        escaped = true;
                        continue;
                    }
                    if (ch === '"') {
                        inString = false;
                    }
                    continue;
                }

                if (ch === '"') {
                    inString = true;
                    continue;
                }
                if (ch === openChar) depth++;
                if (ch === closeChar) {
                    depth--;
                    if (depth === 0) return s.slice(i, j + 1);
                }
            }
        }

        return null;
    }

    function extractInsightsFromAiOutput(rawText) {
        const cleaned = stripMarkdownCodeFences(rawText);

        // Prefer the wrapper object format: { insights: [...], _meta: {...} }
        const objText = extractFirstJsonSubstring(cleaned, "{", "}");
        if (objText) {
            const parsed = JSON.parse(objText);
            if (Array.isArray(parsed?.insights)) {
                return {
                    insights: parsed.insights,
                    _meta: parsed._meta || null,
                    cleaned,
                    jsonText: objText,
                    kind: "object.insights"
                };
            }
            // Maybe the object wraps a single insight — unlikely but handle it
            if (typeof parsed?.summary_plain === "string") {
                return { insights: [parsed], _meta: null, cleaned, jsonText: objText, kind: "single_object" };
            }
        }

        // Fallback: bare JSON array (old format)
        const arrayText = extractFirstJsonSubstring(cleaned, "[", "]");
        if (arrayText) {
            const parsed = JSON.parse(arrayText);
            if (!Array.isArray(parsed)) throw new Error("Output JSON is not an array");
            return { insights: parsed, _meta: null, cleaned, jsonText: arrayText, kind: "array" };
        }

        throw new Error("No JSON array/object found in response");
    }

    function getAiOutputDebugSlices(rawText) {
        const cleaned = stripMarkdownCodeFences(rawText);
        const rawSlices = splitHeadTail(cleaned, Math.min(DEBUG_LIMITS.maxCharsIo, 1500));
        const arrayCandidate = extractFirstJsonSubstring(cleaned, "[", "]");
        const objCandidate = extractFirstJsonSubstring(cleaned, "{", "}");
        const arraySlices = splitHeadTail(arrayCandidate || "", 1200);
        const objSlices = splitHeadTail(objCandidate || "", 1200);
        return {
            cleaned,
            raw_output_len: cleaned.length,
            raw_output_head: rawSlices.head,
            raw_output_tail: rawSlices.tail,
            json_array_head: arraySlices.head,
            json_array_tail: arraySlices.tail,
            json_object_head: objSlices.head,
            json_object_tail: objSlices.tail
        };
    }

    async function synthesizeBatch(enriched, model, runId) {
        const prompt = buildPrompt(enriched);
        const promptSlices = splitHeadTail(prompt, Math.min(DEBUG_LIMITS.maxCharsIo, 1500));
        log("info", "PROMPT", `Prompt length: ${prompt.length} chars, model: ${model}`);
        trackApiTraffic({
            stage: "request",
            run_id: runId,
            model,
            batch_size: enriched.length,
            input_ids: enriched.map(s => s.sentence_id),
            input_blocks_preview: buildInputBlocksPreview(enriched),
            prompt_preview_head: promptSlices.head,
            prompt_preview_tail: promptSlices.tail
        });
        let raw = null;
        try {
            raw = await askAI(prompt, model, { temperature: 0.2 });

            // askAI never throws — errors come back as plain strings
            const rawStr = String(raw || "").trim();
            if (!rawStr || rawStr === "(no response)") {
                throw new Error("AI returned empty / '(no response)' — proxy may be down or rate-limited");
            }
            if (rawStr.startsWith("Error:")) {
                throw new Error("AI proxy returned: " + rawStr.slice(0, 500));
            }

            const dbg = getAiOutputDebugSlices(raw);
            trackApiTraffic({
                stage: "response",
                run_id: runId,
                model,
                batch_size: enriched.length,
                raw_output_preview: String(raw || "").slice(0, DEBUG_LIMITS.maxCharsIo),
                raw_output_len: dbg.raw_output_len,
                raw_output_head: dbg.raw_output_head,
                raw_output_tail: dbg.raw_output_tail,
                json_array_head: dbg.json_array_head,
                json_array_tail: dbg.json_array_tail,
                json_object_head: dbg.json_object_head,
                json_object_tail: dbg.json_object_tail
            });
        } catch (e) {
            log("err", "AI", "AI call failed: " + e.message);
            trackApiTraffic({
                stage: "error",
                run_id: runId,
                model,
                batch_size: enriched.length,
                error: String(e?.message || e || "unknown AI error")
            });
            await markQueue(enriched, "error", runId);
            await finishRun(runId, null, "error");
            return false;
        }

        let insights = null;
        try {
            const extracted = extractInsightsFromAiOutput(raw);
            insights = extracted.insights;
            if (!Array.isArray(insights)) throw new Error("Output is not an array");
            log("ok", "PARSE", `Parsed ${insights.length} insight(s) from AI output (${extracted.kind}, ${String(raw || "").length} chars)`);

            // Surface AI diagnostics from _meta
            const meta = extracted._meta;
            if (meta) {
                log("info", "AI_META", `AI self-report: ${meta.input_block_count || "?"} blocks received, ${meta.insights_produced || insights.length} insights produced, ${meta.blocks_used_count || "?"} blocks used`);
                if (Array.isArray(meta.blocks_unused) && meta.blocks_unused.length > 0) {
                    const unusedSummary = meta.blocks_unused.slice(0, 8).map(b => `${b.sentence_id}: ${b.reason || "no reason"}`).join(" | ");
                    log("warn", "AI_META", `Unused blocks (${meta.blocks_unused.length}): ${unusedSummary}${meta.blocks_unused.length > 8 ? " ..." : ""}`);
                }
                if (Array.isArray(meta.rule_violations_caught) && meta.rule_violations_caught.length > 0) {
                    log("warn", "AI_META", `Rule adjustments: ${meta.rule_violations_caught.join("; ")}`);
                }
                if (Array.isArray(meta.warnings) && meta.warnings.length > 0) {
                    log("warn", "AI_META", `Warnings: ${meta.warnings.join("; ")}`);
                }
                if (meta.model_notes) {
                    log("info", "AI_META", `Notes: ${String(meta.model_notes).slice(0, 500)}`);
                }
                // Stash _meta into api traffic
                trackApiTraffic({
                    stage: "ai_meta",
                    run_id: runId,
                    model,
                    batch_size: enriched.length,
                    ai_meta: meta
                });
            } else {
                log("warn", "AI_META", "AI did not return a _meta diagnostics block (old format or stripped).");
            }
        } catch (e) {
            const rawSnippet = String(raw || "").replace(/\s+/g, " ").trim().slice(0, 300);
            log("err", "PARSE", `Failed to parse JSON: ${e.message} — raw[0..300]: ${rawSnippet || "(empty)"}`);
            const dbg = getAiOutputDebugSlices(raw);
            trackApiTraffic({
                stage: "parse_error",
                run_id: runId,
                model,
                batch_size: enriched.length,
                raw_output_preview: String(raw || "").slice(0, DEBUG_LIMITS.maxCharsIo),
                raw_output_len: dbg.raw_output_len,
                raw_output_head: dbg.raw_output_head,
                raw_output_tail: dbg.raw_output_tail,
                json_array_head: dbg.json_array_head,
                json_array_tail: dbg.json_array_tail,
                json_object_head: dbg.json_object_head,
                json_object_tail: dbg.json_object_tail,
                error: String(e?.message || e || "parse error")
            });
            await markQueue(enriched, "error", runId);
            await finishRun(runId, raw, "error");
            return false;
        }

        const inputById = new Map(enriched.map(s => [s.sentence_id, s]));
        const successfulSentenceIds = new Set(); // only track IDs from fully persisted insights

        let createdCount = 0;
        let rejectedCount = 0;
        let dbFailCount = 0;

        for (const ins of insights) {
            const issues = validateInsight(ins, inputById);
            if (issues.length > 0) {
                rejectedCount++;
                log("warn", "VAL", `Rejected insight: ${issues.join("; ")}`);
                continue;
            }

            const evidence = ins.evidence;

            // Compute derived fields from evidence sentences (hard rule: mathematical derivation)
            const derived = computeDerivedFromEvidence(evidence, inputById);

            const insightId = await insertInsight({
                summary_plain: String(ins.summary_plain || "").trim(),
                summary_long: String(ins.summary_long || "").trim() || null,
                dominant_sentiment_score: derived.dominant_sentiment_score,
                is_problem: derived.flags.is_problem,
                is_solution: derived.flags.is_solution,
                is_explanation: derived.flags.is_explanation,
                is_workaround: derived.flags.is_workaround,
                created_by_run_id: runId
            });

            if (!insightId) {
                dbFailCount++;
                log("err", "DB", "Failed to insert insight (could not retrieve ID)");
                continue;
            }

            const okLinks = await insertInsightSentences(insightId, evidence);
            if (!okLinks) {
                dbFailCount++;
                log("err", "DB", `Failed to link evidence for insight ${insightId} — deleting orphan insight`);
                // Clean up the orphan insight
                try { await DBHelper.query(APP_NAME, `DELETE FROM insights WHERE insight_id=${parseInt(insightId)}`); } catch(_) {}
                continue;
            }

            // Only mark evidence IDs as used after BOTH insert + link succeeded
            for (const ev of evidence) successfulSentenceIds.add(ev.sentence_id);

            createdCount++;
            log("ok", "INSIGHT", `Created insight ${insightId} with ${evidence.length} sentences (senti=${derived.dominant_sentiment_score})`);
        }

        // Mark only successfully-used sentences as processed; rest revert to unprocessed
        const used = Array.from(successfulSentenceIds);
        await markQueueUsed(enriched.map(s => s.sentence_id), used, runId);

        await finishRun(runId, raw, "completed");

        log("info", "BATCH", `Batch result: ${createdCount} insights created, ${rejectedCount} rejected, ${dbFailCount} DB failures`);
        if (createdCount > 0) {
            document.getElementById("insightBadge").textContent = "new";
        }

        // Treat batch as failure if zero insights were actually persisted
        // (triggers circuit breaker after consecutive failures)
        if (createdCount === 0) {
            log("warn", "BATCH", "Batch produced 0 persisted insights — marking items as processed to avoid retry loop.");
            // Mark ALL items in this batch as processed so we don't retry the same sentences
            await markQueue(enriched, "processed", runId);
            return false;
        }
        return true;
    }

    function validateInsight(ins, inputById) {
        const issues = [];
        const summary = String(ins?.summary_plain || "").trim();
        if (!summary || summary.length < 10) issues.push("summary_plain missing/too short");

        if (!Array.isArray(ins?.evidence) || ins.evidence.length === 0) {
            issues.push("insight has no evidence");
            return issues;
        }

        let hasGoodQuote = false;
        const seenEvidenceIds = new Set();
        for (const ev of ins.evidence) {
            if (!ev || !ev.sentence_id) { issues.push("evidence item missing sentence_id"); continue; }
            if (seenEvidenceIds.has(ev.sentence_id)) issues.push(`duplicate evidence sentence_id in one insight: ${ev.sentence_id}`);
            seenEvidenceIds.add(ev.sentence_id);
            if (!inputById.has(ev.sentence_id)) issues.push(`evidence sentence_id not in input: ${ev.sentence_id}`);

            const qr = parseInt(ev.quote_rank);
            if (isNaN(qr) || qr < 0 || qr > 3) issues.push(`invalid quote_rank for ${ev.sentence_id}`);
            if (qr >= 2) hasGoodQuote = true;

            const role = String(ev.support_role || "");
            if (!["direct_quote","evidence","context","counterpoint"].includes(role)) {
                issues.push(`invalid support_role for ${ev.sentence_id}`);
            }
        }
        if (!hasGoodQuote) issues.push("no evidence sentence has quote_rank >= 2");

        return issues;
    }

    function computeDerivedFromEvidence(evidence, inputById) {
        const scores = [];
        const flags = { is_problem:false, is_solution:false, is_explanation:false, is_workaround:false };

        for (const ev of evidence) {
            const s = inputById.get(ev.sentence_id);
            if (!s) continue;
            scores.push(clampInt(parseInt(s.sentiment_score) || 0, -2, 2));
            flags.is_problem     = flags.is_problem     || !!parseInt(s.is_problem);
            flags.is_solution    = flags.is_solution    || !!parseInt(s.is_solution);
            flags.is_explanation = flags.is_explanation || !!parseInt(s.is_explanation);
            flags.is_workaround  = flags.is_workaround  || !!parseInt(s.is_workaround);
        }

        const mean = scores.length ? scores.reduce((a,b)=>a+b,0) / scores.length : 0;
        const dominant = clampInt(Math.round(mean), -2, 2);
        return { dominant_sentiment_score: dominant, flags };
    }

    async function insertInsight(i) {
        try {
            const sp = (i.summary_plain || "").replace(/'/g, "''");
            const sl = i.summary_long ? i.summary_long.replace(/'/g, "''") : null;
            const runIdInt = i.created_by_run_id ? parseInt(i.created_by_run_id) : null;
            const runIdSql = runIdInt ? String(runIdInt) : "NULL";
            await DBHelper.query(APP_NAME, `
                INSERT INTO insights (
                    summary_plain, summary_long, dominant_sentiment_score,
                    is_problem, is_solution, is_explanation, is_workaround,
                    created_by_run_id
                ) VALUES (
                    '${sp}',
                    ${sl ? `'${sl}'` : 'NULL'},
                    ${clampInt(parseInt(i.dominant_sentiment_score)||0,-2,2)},
                    ${i.is_problem ? 1 : 0},
                    ${i.is_solution ? 1 : 0},
                    ${i.is_explanation ? 1 : 0},
                    ${i.is_workaround ? 1 : 0},
                    ${runIdSql}
                )
            `);
            // Retrieve by matching summary_plain + run_id (NULL-safe comparison)
            const runIdWhereClause = runIdInt
                ? `created_by_run_id=${runIdInt}`
                : `created_by_run_id IS NULL`;
            let insightId = null;
            for (let attempt = 0; attempt < 3; attempt++) {
                if (attempt > 0) await sleep(250 * attempt);
                const idRes = await DBHelper.query(APP_NAME,
                    `SELECT insight_id FROM insights WHERE summary_plain='${sp}' AND ${runIdWhereClause} ORDER BY insight_id DESC LIMIT 1`
                );
                insightId = parseInt(idRes?.rows?.[0]?.insight_id || 0) || null;
                if (insightId) break;
            }
            if (!insightId) {
                log("warn", "DB", `Inserted insight but could not retrieve ID after 3 attempts (runId=${runIdSql})`);
            }
            return insightId;
        } catch (e) {
            log("err", "DB", "Insert insight failed: " + e.message);
            return null;
        }
    }

    async function insertInsightSentences(insightId, evidence) {
        try {
            const seen = new Set();
            for (const ev of evidence) {
                const sid = String(ev.sentence_id).replace(/'/g, "''");
                if (seen.has(sid)) continue;
                seen.add(sid);
                const qr = clampInt(parseInt(ev.quote_rank) || 0, 0, 3);
                const role = ["direct_quote","evidence","context","counterpoint"].includes(ev.support_role)
                    ? ev.support_role
                    : "evidence";
                const notes = ev.notes ? String(ev.notes).substring(0, 500).replace(/'/g, "''") : null;

                await DBHelper.query(APP_NAME, `
                    INSERT INTO insight_sentences (insight_id, sentence_id, quote_rank, support_role, notes)
                    VALUES (${parseInt(insightId)}, '${sid}', ${qr}, '${role}', ${notes ? `'${notes}'` : 'NULL'})
                `);
            }
            return true;
        } catch (e) {
            log("err", "DB", "Insert insight_sentences failed: " + e.message);
            return false;
        }
    }

    async function markQueue(sentences, status, runId) {
        for (const s of sentences) {
            const sid = (s.sentence_id || s).replace(/'/g, "''");
            try {
                await DBHelper.query(APP_NAME, `
                    UPDATE sentence_synthesis_queue
                    SET status='${status}', last_run_id=${runId ? parseInt(runId) : 'NULL'}
                    WHERE sentence_id='${sid}'
                `);
            } catch(_) {}
        }
    }

    async function markQueueUsed(allIds, usedIds, runId) {
        const usedSet = new Set(usedIds);
        for (const sid0 of allIds) {
            const sid = sid0.replace(/'/g, "''");
            const newStatus = usedSet.has(sid0) ? "processed" : "unprocessed";
            try {
                await DBHelper.query(APP_NAME, `
                    UPDATE sentence_synthesis_queue
                    SET status='${newStatus}', last_run_id=${runId ? parseInt(runId) : 'NULL'}
                    WHERE sentence_id='${sid}'
                `);
            } catch(_) {}
        }
    }

    async function finishRun(runId, outputJson, status) {
        if (!runId) {
            log("warn", "RUN", `Cannot finishRun: runId is null (status would be '${status}')`);
            return;
        }
        try {
            const payload = typeof outputJson === "string" ? outputJson : JSON.stringify(outputJson || "");
            const safe = String(payload || "").substring(0, 8000).replace(/'/g, "''");
            await DBHelper.query(APP_NAME, `
                UPDATE ai_runs
                SET status='${status}', output_json='${safe}'
                WHERE run_id=${parseInt(runId)}
            `);
        } catch(_) {}
    }

    function trackApiTraffic(entry) {
        const item = {
            at_utc: new Date().toISOString(),
            ...entry
        };
        debugState.apiTraffic.unshift(item);
        if (debugState.apiTraffic.length > DEBUG_LIMITS.maxApiTrafficRows) {
            debugState.apiTraffic.length = DEBUG_LIMITS.maxApiTrafficRows;
        }
        setText("apiBadge", debugState.apiTraffic.length);
    }

    function compactIsoForFilename(iso) {
        return String(iso || "")
            .replaceAll(":", "")
            .replaceAll("-", "")
            .replaceAll(".", "")
            .replace("T", "_")
            .replace("Z", "Z");
    }

    function clipText(value, maxChars = DEBUG_LIMITS.maxCharsIo) {
        const text = String(value || "");
        if (text.length <= maxChars) return text;
        return `${text.slice(0, maxChars)}\n\n...[truncated ${text.length - maxChars} chars]`;
    }

    function parseInputIds(inputIds) {
        if (Array.isArray(inputIds)) {
            return inputIds
                .map(x => String(x || "").trim())
                .filter(Boolean);
        }

        const text = String(inputIds || "").trim();
        if (!text) return [];

        // Stored format is usually a JSON array string: ["CB01.0004","KB01.0002",...]
        if (text.startsWith("[")) {
            try {
                const arr = JSON.parse(text);
                if (Array.isArray(arr)) {
                    return arr
                        .map(x => String(x || "").trim())
                        .filter(Boolean);
                }
            } catch (_) {
                // Fall through to CSV-ish parsing
            }
        }

        // Fallback: comma-separated list (strip brackets/quotes per token)
        return text
            .split(",")
            .map(x => x
                .trim()
                .replace(/^[\[\]\"']+/, "")
                .replace(/[\[\]\"']+$/, "")
                .trim()
            )
            .filter(Boolean);
    }

    function toPrettyJsonOrRaw(value) {
        const text = String(value || "").trim();
        if (!text) return "";
        try {
            return JSON.stringify(JSON.parse(text), null, 2);
        } catch (_) {
            return text;
        }
    }

    function renderApiSection(title, content) {
        return `
            <section class="api-section">
                <div class="api-section-title">${escHtml(title)}</div>
                <pre class="api-block">${escHtml(content || "(empty)")}</pre>
            </section>
        `;
    }

    function buildResolvedSentencePreview(inputIds, sentenceMap, maxItems = 8, maxChars = 260) {
        if (!inputIds.length) return "(none)";
        const lines = [];
        for (const sentenceId of inputIds.slice(0, maxItems)) {
            const row = sentenceMap.get(String(sentenceId));
            if (!row) {
                lines.push(`${sentenceId}: [not found in sentences table]`);
                continue;
            }
            const speaker = row.speaker ? `${row.speaker} • ` : "";
            const timestamp = row.timestamp_block ? `${row.timestamp_block} • ` : "";
            const text = String(row.clean_text || row.raw_text || "")
                .replace(/\s+/g, " ")
                .trim();
            const clipped = text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
            lines.push(`${sentenceId}: ${timestamp}${speaker}${clipped}`);
        }
        if (inputIds.length > maxItems) lines.push(`...and ${inputIds.length - maxItems} more input IDs`);
        return lines.join("\n");
    }

    async function loadSentencePreviewMapForRuns(runs, maxIds = 700) {
        const uniqueIds = [];
        const seen = new Set();
        for (const run of runs) {
            const ids = parseInputIds(run.input_ids);
            for (const id of ids) {
                if (seen.has(id)) continue;
                seen.add(id);
                uniqueIds.push(id);
                if (uniqueIds.length >= maxIds) break;
            }
            if (uniqueIds.length >= maxIds) break;
        }
        if (uniqueIds.length === 0) return new Map();

        const quoted = uniqueIds.map(id => `'${String(id).replace(/'/g, "''")}'`).join(",");
        const res = await DBHelper.query(APP_NAME, `
            SELECT sentence_id, clean_text, raw_text, speaker, timestamp_block
            FROM sentences
            WHERE sentence_id IN (${quoted})
        `);
        const rows = res?.rows || [];
        return new Map(rows.map(r => [String(r.sentence_id), r]));
    }

    function downloadTextFile(fileName, text) {
        const blob = new Blob([text], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    async function getSmokeSummaryRows() {
        const [
            orphan,
            rank,
            role,
            bounds,
            trace
        ] = await Promise.all([
            DBHelper.query(APP_NAME, `
                SELECT COUNT(*) AS cnt
                FROM insights i
                WHERE NOT EXISTS (SELECT 1 FROM insight_sentences isx WHERE isx.insight_id = i.insight_id)
            `),
            DBHelper.query(APP_NAME, `
                SELECT COUNT(*) AS cnt
                FROM insights i
                WHERE NOT EXISTS (
                    SELECT 1 FROM insight_sentences isx
                    WHERE isx.insight_id = i.insight_id AND isx.quote_rank >= 2
                )
            `),
            DBHelper.query(APP_NAME, `
                SELECT COUNT(*) AS cnt
                FROM insight_sentences
                WHERE support_role NOT IN ('direct_quote','evidence','context','counterpoint')
            `),
            DBHelper.query(APP_NAME, `
                SELECT COUNT(*) AS cnt
                FROM insight_sentences
                WHERE quote_rank < 0 OR quote_rank > 3
            `),
            DBHelper.query(APP_NAME, `
                SELECT COUNT(*) AS cnt
                FROM insight_sentences isx
                WHERE NOT EXISTS (SELECT 1 FROM sentences s WHERE s.sentence_id = isx.sentence_id)
            `)
        ]);

        return {
            orphan_insights: parseInt(orphan?.rows?.[0]?.cnt || 0),
            missing_good_quote: parseInt(rank?.rows?.[0]?.cnt || 0),
            invalid_support_role: parseInt(role?.rows?.[0]?.cnt || 0),
            invalid_quote_rank: parseInt(bounds?.rows?.[0]?.cnt || 0),
            dangling_links: parseInt(trace?.rows?.[0]?.cnt || 0)
        };
    }

    window.downloadDebugBundle = async function() {
        try {
            const generatedAt = new Date().toISOString();
            const insightsRes = await DBHelper.query(APP_NAME, `
                SELECT insight_id, summary_plain, summary_long, dominant_sentiment_score,
                       is_problem, is_solution, is_explanation, is_workaround,
                       created_by_run_id, created_at
                FROM insights
                ORDER BY insight_id DESC
                LIMIT ${DEBUG_LIMITS.maxInsightsExport}
            `);
            const insights = insightsRes?.rows || [];

            let links = [];
            if (insights.length > 0) {
                const ids = insights.map(i => parseInt(i.insight_id)).filter(Number.isFinite).join(",");
                if (ids) {
                    const linksRes = await DBHelper.query(APP_NAME, `
                        SELECT isx.insight_id, isx.sentence_id, isx.quote_rank, isx.support_role, isx.notes,
                               s.timestamp_block, s.speaker, s.clean_text, s.raw_text
                        FROM insight_sentences isx
                        LEFT JOIN sentences s ON s.sentence_id = isx.sentence_id
                        WHERE isx.insight_id IN (${ids})
                        ORDER BY isx.insight_id DESC, isx.quote_rank DESC
                    `);
                    links = linksRes?.rows || [];
                }
            }

            const runsRes = await DBHelper.query(APP_NAME, `
                SELECT run_id, purpose, model_name, batch_size, input_ids, output_json, status, created_at
                FROM ai_runs
                WHERE purpose='extract_insights'
                ORDER BY run_id DESC
                LIMIT ${DEBUG_LIMITS.maxRunsExport}
            `);
            const runs = (runsRes?.rows || []).map(r => ({
                ...r,
                input_ids_preview: String(r.input_ids || "").slice(0, DEBUG_LIMITS.maxCharsIo),
                output_json_preview: String(r.output_json || "").slice(0, DEBUG_LIMITS.maxCharsIo)
            }));

            const smoke = await getSmokeSummaryRows();
            const payload = {
                generated_at_utc: generatedAt,
                app_name: APP_NAME,
                version: APP_VERSION,
                limits: DEBUG_LIMITS,
                smoke_summary: smoke,
                insight_count_exported: insights.length,
                link_count_exported: links.length,
                ai_runs_exported: runs.length,
                insights,
                insight_links: links,
                ai_runs_recent: runs,
                api_traffic_recent: debugState.apiTraffic,
                log_feed_recent: debugState.logHistory
            };

            const fileName = `synthesizer-debug-${compactIsoForFilename(generatedAt)}-latest.json`;
            downloadTextFile(fileName, JSON.stringify(payload, null, 2));
            log("ok", "EXPORT", `Downloaded debug bundle: ${fileName}`);
        } catch (e) {
            log("err", "EXPORT", "Debug bundle failed: " + (e?.message || e));
        }
    };

    window.openApiTrafficView = async function() {
        switchTab("api");
        await loadApiTraffic();
    };

    window.loadApiTraffic = async function() {
        try {
            const runsRes = await DBHelper.query(APP_NAME, `
                SELECT run_id, model_name, batch_size, status, input_ids, output_json, created_at
                FROM ai_runs
                WHERE purpose='extract_insights'
                ORDER BY run_id DESC
                LIMIT ${DEBUG_LIMITS.maxApiTrafficRows}
            `);
            const runs = runsRes?.rows || [];

            let sentenceMap = new Map();
            try {
                sentenceMap = await loadSentencePreviewMapForRuns(runs);
            } catch (e) {
                log("warn", "API", "Could not resolve sentence text previews for API runs: " + (e?.message || e));
            }

            const cards = runs.map(r => {
                const inputIds = parseInputIds(r.input_ids);
                const inputIdsPreview = inputIds.length ? inputIds.join(", ") : "(none)";
                const resolvedPreview = buildResolvedSentencePreview(inputIds, sentenceMap);
                const inbound = [
                    `run_id: ${r.run_id}`,
                    `model: ${r.model_name || ""}`,
                    `batch_size: ${r.batch_size || 0}`,
                    `status: ${r.status || ""}`,
                    `input_ids_count: ${inputIds.length}`,
                    "",
                    "input_ids:",
                    clipText(inputIdsPreview, 2000),
                    "",
                    "resolved_sentence_previews:",
                    resolvedPreview
                ].join("\n");
                const status = String(r.status || "").toLowerCase();
                const outboundRaw = toPrettyJsonOrRaw(r.output_json);
                const outbound = clipText(
                    outboundRaw || (status === "running" ? "(run is still running; output_json not written yet)" : ""),
                    DEBUG_LIMITS.maxCharsIo
                );
                return `
                    <div class="insight-card">
                        <div class="insight-meta">
                            <span class="insight-id">RUN ${r.run_id}</span>
                            <span class="pill">${escHtml(r.model_name || "")}, batch ${r.batch_size || 0}, ${escHtml(r.status || "")}</span>
                        </div>
                        <div style="font-size:11px; color:var(--muted); margin-bottom:8px;">${escHtml(String(r.created_at || ""))}</div>
                        <div class="api-sections">
                            ${renderApiSection("Inbound Request (from ai_runs + resolved sentence previews)", inbound)}
                            ${renderApiSection("Outbound Response (output_json)", outbound)}
                        </div>
                    </div>`;
            }).join("");

            const memTraffic = debugState.apiTraffic.map((t, idx) => {
                // Special rendering for AI diagnostics _meta entries
                if (t.stage === "ai_meta" && t.ai_meta) {
                    const m = t.ai_meta;
                    const metaLines = [
                        `input_block_count: ${m.input_block_count ?? "?"}`,
                        `insights_produced: ${m.insights_produced ?? "?"}`,
                        `blocks_used_count: ${m.blocks_used_count ?? "?"}`,
                        "",
                        "=== blocks_unused ===",
                        ...(Array.isArray(m.blocks_unused) && m.blocks_unused.length > 0
                            ? m.blocks_unused.map(b => `  ${b.sentence_id}: ${b.reason || "no reason given"}`)
                            : ["  (none)"]),
                        "",
                        "=== rule_violations_caught ===",
                        ...(Array.isArray(m.rule_violations_caught) && m.rule_violations_caught.length > 0
                            ? m.rule_violations_caught.map(v => `  • ${v}`)
                            : ["  (none)"]),
                        "",
                        "=== warnings ===",
                        ...(Array.isArray(m.warnings) && m.warnings.length > 0
                            ? m.warnings.map(w => `  ⚠ ${w}`)
                            : ["  (none)"]),
                        "",
                        "=== model_notes ===",
                        m.model_notes || "(none)"
                    ];
                    if (Array.isArray(m.input_ids_received) && m.input_ids_received.length > 0) {
                        metaLines.push("", "=== input_ids_received ===", m.input_ids_received.join(", "));
                    }
                    return `
                    <div class="insight-card" style="border-left:3px solid var(--accent);">
                        <div class="insight-meta">
                            <span class="insight-id">LIVE ${idx + 1}</span>
                            <span class="pill" style="background:rgba(35,134,54,0.18); color:var(--accent)">ai_meta${t.run_id ? ` • run ${t.run_id}` : ""}</span>
                        </div>
                        <div style="font-size:11px; color:var(--muted); margin-bottom:8px;">${escHtml(String(t.at_utc || ""))}</div>
                        <div class="api-sections">
                            ${renderApiSection("AI Self-Reported Diagnostics (_meta)", metaLines.join("\n"))}
                        </div>
                    </div>`;
                }

                // Standard LIVE card
                return `
                <div class="insight-card">
                    <div class="insight-meta">
                        <span class="insight-id">LIVE ${idx + 1}</span>
                        <span class="pill">${escHtml(t.stage || "")}${t.run_id ? ` • run ${t.run_id}` : ""}</span>
                    </div>
                    <div style="font-size:11px; color:var(--muted); margin-bottom:8px;">${escHtml(String(t.at_utc || ""))}</div>
                    <div class="api-sections">
                        ${renderApiSection("Inbound Request", [
                            `stage: ${t.stage || ""}`,
                            `run_id: ${t.run_id || ""}`,
                            `model: ${t.model || ""}`,
                            `batch_size: ${t.batch_size || 0}`,
                            t.input_ids ? `input_ids: ${clipText((Array.isArray(t.input_ids) ? t.input_ids : []).join(", "), 1800)}` : "input_ids: (not captured)",
                            "",
                            "input_blocks_preview:",
                            t.input_blocks_preview ? JSON.stringify(t.input_blocks_preview, null, 2) : "(not captured)",
                            "",
                            "prompt_preview_head:",
                            t.prompt_preview_head || "(not captured)",
                            "",
                            "prompt_preview_tail:",
                            t.prompt_preview_tail || "(not captured)"
                        ].join("\n"))}
                        ${renderApiSection("Outbound Response", [
                            `stage: ${t.stage || ""}`,
                            t.raw_output_len ? `raw_output_len: ${t.raw_output_len}` : "raw_output_len: (not captured)",
                            "",
                            "raw_output_head:",
                            clipText(String(t.raw_output_head || t.raw_output_preview || ""), DEBUG_LIMITS.maxCharsIo),
                            "",
                            "raw_output_tail:",
                            clipText(String(t.raw_output_tail || ""), 1800),
                            "",
                            "json_array_head:",
                            clipText(String(t.json_array_head || ""), 1800),
                            "",
                            "json_array_tail:",
                            clipText(String(t.json_array_tail || ""), 1800),
                            "",
                            "json_object_head:",
                            clipText(String(t.json_object_head || ""), 1800),
                            "",
                            "json_object_tail:",
                            clipText(String(t.json_object_tail || ""), 1800),
                            "",
                            "error:",
                            t.error || "(none)"
                        ].join("\n"))}
                    </div>
                </div>`;
            }).join("");

            const html = (cards || memTraffic)
                ? `${cards}${memTraffic}`
                : `<div class="empty-state"><div class="empty-icon">🛰</div><div>No API runs found yet.</div></div>`;

            document.getElementById("apiFeed").innerHTML = html;
            setText("apiBadge", runs.length + debugState.apiTraffic.length);
        } catch (e) {
            document.getElementById("apiFeed").innerHTML =
                `<div class="empty-state"><div>Error loading API traffic: ${escHtml(e.message || String(e))}</div></div>`;
            log("err", "API", "Failed to load API traffic: " + (e?.message || e));
        }
    };

    window.loadInsights = async function() {
        try {
            const res = await DBHelper.query(APP_NAME, `
                SELECT insight_id, summary_plain, dominant_sentiment_score,
                       is_problem, is_solution, is_explanation, is_workaround,
                       created_at
                FROM insights
                ORDER BY insight_id DESC
                LIMIT 50
            `);
            const insights = res?.rows || [];
            document.getElementById("insightBadge").textContent = insights.length;
            if (insights.length === 0) {
                document.getElementById("insightFeed").innerHTML =
                    `<div class="empty-state"><div class="empty-icon">🧠</div><div>No insights yet.</div></div>`;
                return;
            }

            const ids = insights.map(i => i.insight_id).join(",");
            const linkRes = await DBHelper.query(APP_NAME, `
                SELECT isx.insight_id, isx.sentence_id, isx.quote_rank, isx.support_role,
                       s.raw_text, s.clean_text, s.timestamp_block, s.speaker
                FROM insight_sentences isx
                JOIN sentences s ON s.sentence_id = isx.sentence_id
                WHERE isx.insight_id IN (${ids})
                ORDER BY isx.insight_id DESC, isx.quote_rank DESC
            `);
            const links = linkRes?.rows || [];
            const byInsight = {};
            for (const l of links) {
                if (!byInsight[l.insight_id]) byInsight[l.insight_id] = [];
                byInsight[l.insight_id].push(l);
            }

            let html = "";
            for (const i of insights) {
                const ev = byInsight[i.insight_id] || [];
                html += renderInsightCard(i, ev);
            }

            document.getElementById("insightFeed").innerHTML = html;
        } catch (e) {
            document.getElementById("insightFeed").innerHTML =
                `<div class="empty-state"><div>Error loading insights: ${escHtml(e.message)}</div></div>`;
        }
    };

    function renderInsightCard(i, evidenceLinks) {
        const id = i.insight_id;
        const flags = [
            ["problem", !!parseInt(i.is_problem)],
            ["solution", !!parseInt(i.is_solution)],
            ["explain", !!parseInt(i.is_explanation)],
            ["workaround", !!parseInt(i.is_workaround)]
        ].filter(x => x[1]).map(x => x[0]).join(", ") || "(no flags)";

        const senti = parseInt(i.dominant_sentiment_score) || 0;
        const sentiColor = senti < 0 ? "var(--danger)" : senti > 0 ? "var(--accent)" : "var(--muted)";

        const evHtml = evidenceLinks.map(ev => {
            const quote = ev.clean_text || ev.raw_text || "";
            return `
            <div class="evidence-item">
                <div class="ev-head">
                    <span class="ev-id">${ev.sentence_id}</span>
                    <span>${ev.timestamp_block || ""} ${ev.speaker ? `• ${escHtml(ev.speaker)}` : ""} • rank ${ev.quote_rank} • ${ev.support_role}</span>
                </div>
                <div class="ev-quote">"${escHtml(quote.substring(0, 260))}${quote.length > 260 ? '…' : ''}"</div>
            </div>`;
        }).join("") || `<div style="color:var(--muted); font-size:11px;">No evidence links found</div>`;

        return `
        <div class="insight-card">
            <div class="insight-meta">
                <span class="insight-id">INSIGHT ${id}</span>
                <span class="pill" style="background:${senti < 0 ? 'rgba(218,54,51,0.15)' : senti > 0 ? 'rgba(35,134,54,0.15)' : 'rgba(139,148,158,0.15)'}; color:${sentiColor}">
                    senti ${senti > 0 ? '+' : ''}${senti}
                </span>
            </div>
            <div class="insight-summary">${escHtml(i.summary_plain || "")}</div>
            <div style="font-size:11px; color:var(--muted); margin-bottom:8px;">flags: ${escHtml(flags)}</div>
            <div class="evidence-list">${evHtml}</div>
        </div>`;
    }

    window.runSmokeTests = async function() {
        switchTab("validation");
        const results = [];
        let passed = 0;
        let failed = 0;

        async function test(name, fn) {
            try {
                const { ok, detail } = await fn();
                results.push({ name, ok, detail });
                ok ? passed++ : failed++;
            } catch(e) {
                results.push({ name, ok: false, detail: e.message });
                failed++;
            }
        }

        // Orphan check: no insight without any evidence links
        await test("Orphan Check (no insight with 0 sentences)", async () => {
            const res = await DBHelper.query(APP_NAME, `
                SELECT COUNT(*) AS cnt
                FROM insights i
                WHERE NOT EXISTS (
                    SELECT 1 FROM insight_sentences isx
                    WHERE isx.insight_id = i.insight_id
                )
            `);
            const cnt = parseInt(res?.rows?.[0]?.cnt || 0);
            return { ok: cnt === 0, detail: cnt === 0 ? "No orphan insights" : `${cnt} orphan insights found` };
        });

        // Rank check: each insight has at least one quote_rank >= 2
        await test("Rank Check (>=1 good quote per insight)", async () => {
            const res = await DBHelper.query(APP_NAME, `
                SELECT COUNT(*) AS cnt
                FROM insights i
                WHERE NOT EXISTS (
                    SELECT 1 FROM insight_sentences isx
                    WHERE isx.insight_id = i.insight_id
                      AND isx.quote_rank >= 2
                )
            `);
            const cnt = parseInt(res?.rows?.[0]?.cnt || 0);
            return { ok: cnt === 0, detail: cnt === 0 ? "All insights have a good quote" : `${cnt} insights missing quote_rank>=2` };
        });

        // Support role enum check
        await test("Support Role Enum", async () => {
            const res = await DBHelper.query(APP_NAME, `
                SELECT COUNT(*) AS cnt
                FROM insight_sentences
                WHERE support_role NOT IN ('direct_quote','evidence','context','counterpoint')
            `);
            const cnt = parseInt(res?.rows?.[0]?.cnt || 0);
            return { ok: cnt === 0, detail: cnt === 0 ? "All support_role values valid" : `${cnt} invalid support_role rows` };
        });

        // Quote rank bounds check
        await test("Quote Rank Bounds (0..3)", async () => {
            const res = await DBHelper.query(APP_NAME, `
                SELECT COUNT(*) AS cnt
                FROM insight_sentences
                WHERE quote_rank < 0 OR quote_rank > 3
            `);
            const cnt = parseInt(res?.rows?.[0]?.cnt || 0);
            return { ok: cnt === 0, detail: cnt === 0 ? "All quote_rank values valid" : `${cnt} out-of-bounds quote_rank rows` };
        });

        // Traceability: every linked sentence exists
        await test("Traceability (linked blocks exist)", async () => {
            const res = await DBHelper.query(APP_NAME, `
                SELECT COUNT(*) AS cnt
                FROM insight_sentences isx
                WHERE NOT EXISTS (
                    SELECT 1 FROM sentences s WHERE s.sentence_id = isx.sentence_id
                )
            `);
            const cnt = parseInt(res?.rows?.[0]?.cnt || 0);
            return { ok: cnt === 0, detail: cnt === 0 ? "All links point to real blocks" : `${cnt} dangling insight_sentences` };
        });

        // Render
        let html = `<div style="margin-bottom:16px; font-size:13px; color:var(--muted);">
            Results: <span style="color:var(--accent)">${passed} passed</span>
            ${failed > 0 ? ` / <span style="color:var(--danger)">${failed} failed</span>` : ''}
        </div>`;

        for (const r of results) {
            const icon = r.ok ? "✅" : "❌";
            const bg   = r.ok ? "var(--accent-dim)" : "rgba(218,54,51,0.1)";
            const bc   = r.ok ? "var(--accent)" : "var(--danger)";
            html += `<div style="background:${bg}; border:1px solid ${bc}; border-radius:6px; padding:12px; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <span>${icon}</span>
                    <strong style="font-size:12px;">${escHtml(r.name)}</strong>
                </div>
                <div style="font-size:11px; color:var(--muted); font-family:var(--mono);">${escHtml(r.detail)}</div>
            </div>`;
        }

        document.getElementById("valResults").innerHTML = html;
        document.getElementById("valBadge").textContent = failed > 0 ? `${failed} ❌` : "✓";
        log(failed > 0 ? "warn" : "ok", "SMOKE", `Tests: ${passed} passed, ${failed} failed`);
    };

    /* UI helpers */
    window.switchTab = function(tabId) {
        document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tabId));
        document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "tab-" + tabId));
        if (tabId === "insights") loadInsights();
        if (tabId === "api") loadApiTraffic();
    };

    window.applyPromptTemplateUpdate = function() {
        const current = normalizePromptTemplate(document.getElementById("promptTemplate")?.value, DEFAULT_SYNTH_PROMPT_TEMPLATE);
        const promptEl = document.getElementById("promptTemplate");
        if (promptEl) promptEl.value = current;
        log("ok", "PROMPT", "Updated prompt template. Next batch uses this version.");
    };

    function log(level, tag, msg) {
        logCount++;
        document.getElementById("logBadge").textContent = logCount;

        const feed = document.getElementById("logFeed");
        const empty = feed.querySelector(".empty-state");
        if (empty) empty.remove();

        const now = new Date();
        const ts = now.toTimeString().substring(0,8);
        const levelClass = {
            ok: "log-level-ok", err: "log-level-err",
            warn: "log-level-warn", info: "log-level-info"
        }[level] || "log-level-info";
        const levelLabel = { ok:"  OK", err:" ERR", warn:"WARN", info:"INFO" }[level] || "INFO";

        const el = document.createElement("div");
        el.className = "log-entry";
        el.innerHTML = `<span class="log-time">${ts}</span><span class="${levelClass}">[${levelLabel}]</span><span style="color:var(--warning); font-family:var(--mono); min-width:70px;">${escHtml(tag)}</span><span class="log-msg">${escHtml(msg)}</span>`;

        feed.insertBefore(el, feed.firstChild);
        while (feed.children.length > 500) feed.removeChild(feed.lastChild);

        debugState.logHistory.unshift({ at: new Date().toISOString(), level, tag, msg: String(msg || "") });
        if (debugState.logHistory.length > DEBUG_LIMITS.maxLogRows) {
            debugState.logHistory.length = DEBUG_LIMITS.maxLogRows;
        }
    }

    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    function setDot(dotId, color, statusText) {
        const dot = document.getElementById(dotId);
        if (!dot) return;
        dot.className = "status-dot dot-" + color;
        const parent = dot.parentElement;
        if (parent) parent.textContent = "";
        if (dot && parent) {
            parent.appendChild(dot);
            parent.appendChild(document.createTextNode(" " + statusText));
        }
    }

    function escHtml(s) {
        return String(s)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;");
    }

    function normalizePromptTemplate(value, fallback) {
        const norm = String(value || "").trim();
        const template = norm || fallback;
        const withOverview = template.includes("{{SYSTEMS_OVERVIEW}}") ? template : `${template}\n\n== HEART WALK SYSTEMS OVERVIEW ==\n{{SYSTEMS_OVERVIEW}}`;
        const withInput = withOverview.includes("{{INPUT_BLOCKS}}") ? withOverview : `${withOverview}\n\n== INPUT BLOCKS ==\n{{INPUT_BLOCKS}}`;
        return withInput;
    }

    function clampInt(n, min, max) {
        return Math.max(min, Math.min(max, n));
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    const btnResetSynth = document.getElementById("btnResetSynth");
    if (btnResetSynth) {
        btnResetSynth.addEventListener("click", () => window.resetSynthesisOutputs(btnResetSynth));
    }

    init();
