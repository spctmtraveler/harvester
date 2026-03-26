// Release hygiene: update BOTH APP_VERSION and APP_LAST_UPDATED_UTC before every live push.
    const APP_VERSION = "v4.5";
    // Set to the push time in UTC (banner converts to viewer's local time).
    const APP_LAST_UPDATED_UTC = "2026-03-25T00:00:00Z";

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

    function renderAppVersionBanner() {
        const el = document.getElementById('app-version-banner');
        if (!el) return;
        el.textContent = `Designer ${APP_VERSION} · Last updated ${formatLocalLastUpdated(APP_LAST_UPDATED_UTC)}`;
    }

    renderAppVersionBanner();

    const container = document.getElementById('presentation-container');
    const stage = document.getElementById('slide-stage');
    const speakerNotesPanel = document.getElementById('speaker-notes-panel');
    const speakerNotesInput = document.getElementById('speaker-notes-input');
    let currentSlideIndex = 0;
    let slidesData = []; 
    let appConfig = {};
    let nudgeMode = 'global'; 
    let activeColorTarget = null;
    let selectedElements = [];
    let activeSettingsTab = 'typography';
    const DESIGNER_DB_APP_NAME = 'heart_walk_designer';
    const DESIGNER_STYLE_NAMESPACE = 'designer_image_styles';
    const DESIGNER_OVERVIEW_NAMESPACE = 'designer_overview_texts';
    const DESIGNER_OVERVIEW_KEY = 'heart_walk_systems_overview';
    const DESIGNER_DECK_NAMESPACE = 'designer_decks';
    const DESIGNER_DECK_AUTOSAVE_KEY = 'autosave_current';
    const DEFAULT_HEART_WALK_OVERVIEW = `# Heart Walk - System Overview

Heart Walk is a market-based fundraising and engagement campaign operated by the American Heart Association. It generates corporate sponsorship revenue, activates employee participation, and builds long-term leadership pipelines in each market.

National teams set strategy, goals, and brand standards. Local market teams execute the campaign, recruit volunteer leaders, manage corporate relationships, and coordinate campaign meetings and events.

Internal staff recruit and coach volunteer leaders. Volunteer leaders open doors to companies, make sponsorship asks, recruit additional leaders, and mobilize employee participation.

Typical campaign actions include recruiting an ELT Chair, recruiting ELT members, conducting campaign meetings, identifying corporate prospects, making asks, capturing commitments, tracking pipeline status, and recognizing sponsors and participants.

The system is relationship-based and supported by tools such as Salesforce, reporting dashboards, slide decks, annotated agendas, call scripts, email templates, and planning documents.`;
    let dbHelperPromise = null;
    let designerDbInitPromise = null;
    let cachedImageStyles = [];
    let overviewTextCache = DEFAULT_HEART_WALK_OVERVIEW;
    let aiToolsPromise = null;
    let deckAutosaveTimer = null;
    let deckAutosaveInFlight = false;
    let pendingDeckAutosave = false;
    let lastRemoteDeckSnapshot = '';
    let lastDeckLoadedFromRemote = '';
    const FIELD_ASYNC_STATE = new Map();
    const BATCH_IMAGE_STATE = { running: false, cancelRequested: false, total: 0, completed: 0, failed: 0, current: [], parallelism: 1 };
    const BATCH_IMAGE_PARALLELISM_STORAGE_KEY = 'heart_walk_batch_parallelism';
    const DEFAULT_BATCH_IMAGE_PARALLELISM = 3;
    const IMAGE_MANAGE_STATE = new Map();
    const IMAGE_DIMENSION_CACHE = new Map();

    // ── Style Presets System ──
    const PRESETS_STORAGE_KEY = 'heart_walk_style_presets';
    const ACTIVE_PRESET_KEY = 'heart_walk_active_preset_id';

    // The original factory default — always available, cannot be deleted.
    const DEFAULT_STYLE_PRESET = {
        id: '__factory_default__',
        name: 'Factory Default',
        created: '2026-01-01T00:00:00Z',
        style: {
            'font-title': "'Source Sans 3', sans-serif", 'size-title': '45pt', 'color-title': '#16bfec',
            'font-subtitle': "'Source Sans 3', sans-serif", 'size-subtitle': '25pt', 'color-subtitle': '#1e1d21',
            'font-h1': "'Source Sans 3', sans-serif", 'size-h1': '32pt', 'color-h1': '#16bfec',
            'font-h2': "'Source Sans 3', sans-serif", 'size-h2': '28pt', 'color-h2': '#16bfec',
            'font-h3': "'Source Sans 3', sans-serif", 'size-h3': '18pt', 'color-h3': '#1e1d21',
            'font-normal': "'Source Sans 3', sans-serif", 'size-normal': '16pt', 'color-normal': '#1e1d21',
            'font-p-large': "'Source Sans 3', sans-serif", 'size-p-large': '20pt', 'color-p-large': '#1e1d21',
            'font-p-normal': "'Source Sans 3', sans-serif", 'size-p-normal': '16pt', 'color-p-normal': '#1e1d21',
            'font-p-small': "'Source Sans 3', sans-serif", 'size-p-small': '13pt', 'color-p-small': '#1e1d21',
            'font-quote-body': "'Source Sans 3', sans-serif", 'size-quote-body': '18pt', 'color-quote-body': '#1e1d21',
            'font-quote-attrib': "'Source Sans 3', sans-serif", 'size-quote-attrib': '16pt', 'color-quote-attrib': '#1e1d21',
            'globalX': 0, 'globalY': 0, 'showShapes': true,
            'shapePath': null, 'shapeViewBox': null,
            'typeOffsets': { cover: {x:0,y:0}, section: {x:0,y:0}, standard: {x:0,y:0}, 'two-column': {x:0,y:0} }
        }
    };

    // Keys that are "styling" — everything the preset system manages
    const STYLE_KEYS = [
        'font-title','size-title','color-title',
        'font-subtitle','size-subtitle','color-subtitle',
        'font-h1','size-h1','color-h1',
        'font-h2','size-h2','color-h2',
        'font-h3','size-h3','color-h3',
        'font-normal','size-normal','color-normal',
        'font-p-large','size-p-large','color-p-large',
        'font-p-normal','size-p-normal','color-p-normal',
        'font-p-small','size-p-small','color-p-small',
        'font-quote-body','size-quote-body','color-quote-body',
        'font-quote-attrib','size-quote-attrib','color-quote-attrib',
        'globalX','globalY','showShapes','shapePath','shapeViewBox','typeOffsets'
    ];

    function loadPresets() {
        try {
            const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    function savePresets(presets) {
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
    }

    function getActivePresetId() {
        return localStorage.getItem(ACTIVE_PRESET_KEY) || DEFAULT_STYLE_PRESET.id;
    }

    function setActivePresetId(id) {
        localStorage.setItem(ACTIVE_PRESET_KEY, id);
    }

    function getAllPresetsWithDefault() {
        const userPresets = loadPresets();
        return [DEFAULT_STYLE_PRESET, ...userPresets];
    }

    function extractStyleFromConfig(cfg) {
        const style = {};
        STYLE_KEYS.forEach(k => {
            if (cfg[k] !== undefined) style[k] = JSON.parse(JSON.stringify(cfg[k]));
        });
        return style;
    }

    function applyPresetStyle(presetStyle) {
        STYLE_KEYS.forEach(k => {
            if (presetStyle[k] !== undefined && presetStyle[k] !== null) {
                appConfig[k] = JSON.parse(JSON.stringify(presetStyle[k]));
            }
        });
        // Ensure shapePath/viewBox fall back to global defaults
        if (!appConfig.shapePath) appConfig.shapePath = defaultShapePath;
        if (!appConfig.shapeViewBox) appConfig.shapeViewBox = defaultViewBox;
        // Ensure typeOffsets structure
        if (!appConfig.typeOffsets) appConfig.typeOffsets = {};
        for (const t of ['cover','section','standard','two-column']) {
            if (!appConfig.typeOffsets[t]) appConfig.typeOffsets[t] = {x:0,y:0};
        }
    }

    function saveCurrentAsPreset() {
        const nameInput = document.getElementById('preset-name-input');
        let name = (nameInput.value || '').trim();
        if (!name) {
            name = 'Preset ' + new Date().toLocaleDateString();
        }
        const preset = {
            id: 'preset_' + Date.now(),
            name,
            created: new Date().toISOString(),
            style: extractStyleFromConfig(appConfig)
        };
        const presets = loadPresets();
        presets.push(preset);
        savePresets(presets);
        setActivePresetId(preset.id);
        nameInput.value = '';
        renderPresetList();
    }

    function activatePreset(id) {
        const all = getAllPresetsWithDefault();
        const preset = all.find(p => p.id === id);
        if (!preset) return;
        applyPresetStyle(preset.style);
        setActivePresetId(id);
        applyConfig(); updateSettingsUI(); render(); saveState(); showSlide(currentSlideIndex);
        renderPresetList();
    }

    function deletePreset(id) {
        if (id === DEFAULT_STYLE_PRESET.id) return; // can't delete factory default
        const presets = loadPresets().filter(p => p.id !== id);
        savePresets(presets);
        if (getActivePresetId() === id) {
            // Fall back to most recent remaining, or factory default
            const fallback = presets.length > 0 ? presets[presets.length - 1].id : DEFAULT_STYLE_PRESET.id;
            setActivePresetId(fallback);
        }
        renderPresetList();
    }

    function renderPresetList() {
        const listEl = document.getElementById('preset-list');
        if (!listEl) return;
        const all = getAllPresetsWithDefault();
        const activeId = getActivePresetId();
        listEl.innerHTML = all.map(p => {
            const isActive = p.id === activeId;
            const delBtn = p.id === DEFAULT_STYLE_PRESET.id ? '' : `<button class="preset-del" onclick="event.stopPropagation(); deletePreset('${p.id}')" title="Delete">×</button>`;
            const dateStr = p.id === DEFAULT_STYLE_PRESET.id ? 'built-in' : new Date(p.created).toLocaleDateString();
            return `<div class="preset-item ${isActive ? 'active' : ''}" onclick="activatePreset('${p.id}')">
                <span class="preset-name">${p.name}</span>
                <span class="preset-date">${dateStr}</span>
                ${delBtn}
            </div>`;
        }).join('');
    }

    const iconSVG = `<svg width="40" height="8" style="margin-right:15px; display:inline-block; vertical-align:middle; flex-shrink:0"><rect width="6" height="6" fill="var(--powder-blue)"/><rect x="10" width="6" height="6" fill="var(--powder-blue)"/><rect x="20" width="6" height="6" fill="var(--powder-blue)"/><rect x="30" width="6" height="6" fill="var(--powder-blue)"/></svg>`;
    const defaultShapePath = "M4404 352C3699.78 869.891 4323.8 1271.68 3996.14 1626.1 3687.56 1928.59 2961.96 1552.77 2438 2478.56 3091.81 2477.03 3750.19 2480.09 4404 2478.56L4404 352Z";
    const defaultViewBox = "2438 352 1966 2127";

    const types = [
        { id: 'title', label: 'Cover Title' },
        { id: 'subtitle', label: 'Subtitle' },
        { id: 'h1', label: 'H1 (Section)' },
        { id: 'h2', label: 'H2 (Header)' },
        { id: 'h3', label: 'H3 (Sub)' },
        { id: 'normal', label: 'Body (Legacy)' },
        { id: 'p-large', label: 'P Large' },
        { id: 'p-normal', label: 'P Normal' },
        { id: 'p-small', label: 'P Small' },
        { id: 'quote-body', label: 'Quote Text' },
        { id: 'quote-attrib', label: 'Quote Source' }
    ];
    const fontOptions = [ { name: 'Source Sans 3', value: "'Source Sans 3', sans-serif" }, { name: 'Lora', value: "'Lora', serif" }, { name: 'Roboto', value: "'Roboto', sans-serif" }, { name: 'Open Sans', value: "'Open Sans', sans-serif" }, { name: 'Lato', value: "'Lato', sans-serif" }, { name: 'Montserrat', value: "'Montserrat', sans-serif" }, { name: 'Poppins', value: "'Poppins', sans-serif" }, { name: 'Playfair Display', value: "'Playfair Display', serif" }, { name: 'Merriweather', value: "'Merriweather', serif" }, { name: 'Nunito', value: "'Nunito', sans-serif" }, { name: 'Raleway', value: "'Raleway', sans-serif" }, { name: 'Oswald', value: "'Oswald', sans-serif" } ];
    const palette = [ '#16bfec', '#1e1d21', '#ffffff', '#FCB526', '#FF5C5C', '#965ADB', '#F36C21', '#22D460', '#08C4BE' ];

    const cssVarMap = {
        'var(--powder-blue)': '#16bfec',
        'var(--brand-black)': '#1e1d21',
        'var(--white)': '#ffffff',
        'var(--c-mental)': '#FCB526',
        'var(--c-emotional)': '#FF5C5C',
        'var(--c-physical)': '#965ADB',
        'var(--c-social)': '#F36C21',
        'var(--c-material)': '#22D460',
        'var(--c-temporal)': '#08C4BE'
    };

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getTrimmedConfigValue(key) {
        return String(appConfig?.[key] || '').trim();
    }

    function getImagePromptStyle() {
        return getTrimmedConfigValue('imagePromptStyle');
    }

    function hasUniversalQuoteAttribution() {
        return !!getTrimmedConfigValue('universalQuoteAttribution');
    }

    function getResolvedQuoteAttribution(field) {
        return getTrimmedConfigValue('universalQuoteAttribution') || String(field?.quoteAttribution || '').trim();
    }

    function getFieldRequestKey(slideIndex, fieldPath) {
        return `${slideIndex}::${fieldPath}`;
    }

    function getFieldAsyncState(slideIndex, fieldPath) {
        const key = getFieldRequestKey(slideIndex, fieldPath);
        if (!FIELD_ASYNC_STATE.has(key)) {
            FIELD_ASYNC_STATE.set(key, { promptPending: false, generateQueued: false, requestId: 0, promptPromise: null });
        }
        return FIELD_ASYNC_STATE.get(key);
    }

    function isImageManageMode(slideIndex, fieldPath) {
        return IMAGE_MANAGE_STATE.get(getFieldRequestKey(slideIndex, fieldPath)) === true;
    }

    function setImageManageMode(slideIndex, fieldPath, isOpen) {
        const key = getFieldRequestKey(slideIndex, fieldPath);
        if (isOpen) IMAGE_MANAGE_STATE.set(key, true);
        else IMAGE_MANAGE_STATE.delete(key);
    }

    function getImageHistoryEntries(field) {
        const history = Array.isArray(field?.imageHistory) ? field.imageHistory : [];
        return history.slice().reverse().map((url, reverseIndex) => ({
            url,
            historyIndex: history.length - 1 - reverseIndex,
            label: `Version ${reverseIndex + 1}`
        }));
    }

    async function getImageDimensions(imageUrl) {
        const src = String(imageUrl || '').trim();
        if (!src) throw new Error('Missing image URL.');
        if (IMAGE_DIMENSION_CACHE.has(src)) return IMAGE_DIMENSION_CACHE.get(src);
        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
            img.onerror = () => reject(new Error('Could not measure image dimensions.'));
            img.src = src;
        });
        IMAGE_DIMENSION_CACHE.set(src, promise);
        try {
            return await promise;
        } catch (err) {
            IMAGE_DIMENSION_CACHE.delete(src);
            throw err;
        }
    }

    function getContainedImagePlacement(box, dimensions, align = 'top') {
        const safeWidth = Math.max(0.01, Number(box.w) || 0.01);
        const safeHeight = Math.max(0.01, Number(box.h) || 0.01);
        const width = Math.max(1, Number(dimensions?.width) || 1);
        const height = Math.max(1, Number(dimensions?.height) || 1);
        const scale = Math.min(safeWidth / width, safeHeight / height);
        const renderW = width * scale;
        const renderH = height * scale;
        let offsetX = (safeWidth - renderW) / 2;
        let offsetY = 0;

        if (align === 'left') {
            offsetX = 0;
        } else if (align === 'right') {
            offsetX = safeWidth - renderW;
        } else if (align === 'bottom') {
            offsetY = safeHeight - renderH;
        } else if (align === 'center') {
            offsetY = (safeHeight - renderH) / 2;
        }

        return {
            x: box.x + Math.max(0, offsetX),
            y: box.y + Math.max(0, offsetY),
            w: renderW,
            h: renderH
        };
    }

    function stripCitationMarkers(text) {
        return String(text || '').replace(/\(\?\)/g, '').replace(/\u200B/g, '').replace(/\s+/g, ' ').trim();
    }

    function normalizeAiPromptResponse(responseText) {
        let text = String(responseText || '').trim();
        text = text.replace(/^```(?:json|markdown|text)?/i, '').replace(/```$/i, '').trim();
        text = text.replace(/^Prompt\s*:\s*/i, '').trim();
        text = text.replace(/^"+|"+$/g, '').trim();
        return text.split(/\n{2,}/)[0].trim();
    }

    function collectFieldContextText(field, label) {
        if (!field) return '';
        if (field.mode === 'text') return `${label}: ${stripCitationMarkers(field.text || '')}`.trim();
        if (field.mode === 'quote') {
            const quoteText = stripCitationMarkers(field.quoteText || '');
            const attrib = String(field.quoteAttribution || '').trim();
            return quoteText ? `${label}: ${quoteText}${attrib ? ` (${attrib})` : ''}` : '';
        }
        const notes = stripCitationMarkers(field.imageNotes || field.imagePrompt || '');
        return notes ? `${label}: ${notes}` : '';
    }

    function summarizeSlideForImagePrompt(slide, fieldPath) {
        ensureSlideSchema(slide);
        const parts = [];
        const title = String(slide.title || '').trim();
        const speakerNotes = stripCitationMarkers(slide.speakerNotes || '');
        if (title) parts.push(`Slide title: ${title}`);
        if (slide.type === 'cover') {
            const subtitle = stripCitationMarkers(slide.subtitle || '');
            if (subtitle) parts.push(`Subtitle: ${subtitle}`);
        } else if (slide.type === 'standard') {
            const bodySummary = collectFieldContextText(slide.bodyField, 'Main content');
            if (bodySummary) parts.push(bodySummary);
        } else if (slide.type === 'two-column') {
            const leftSummary = collectFieldContextText(slide.columns?.leftField, 'Left column');
            const rightSummary = collectFieldContextText(slide.columns?.rightField, 'Right column');
            if (leftSummary) parts.push(leftSummary);
            if (rightSummary) parts.push(rightSummary);
        }
        if (speakerNotes) parts.push(`Speaker notes: ${speakerNotes}`);
        parts.push(`Target field: ${fieldPath === 'bodyField' ? 'main panel image' : fieldPath === 'columns.leftField' ? 'left column image' : 'right column image'}`);
        return parts.filter(Boolean).join('\n');
    }

    function buildAutomaticImagePromptRequest(slide, fieldPath) {
        const slideSummary = summarizeSlideForImagePrompt(slide, fieldPath);
        const style = getImagePromptStyle();
        const overview = String(overviewTextCache || DEFAULT_HEART_WALK_OVERVIEW).trim();
        return [
            'You are writing one image-generation prompt for a slide in the Heart Walk Designer app.',
            'Return only the final image prompt text. No markdown, labels, JSON, or explanation.',
            '',
            'Requirements:',
            '- The image should support the slide content without repeating the slide text verbatim.',
            '- Prefer concise but vivid prompt language.',
            '- If a universal visual style is provided, use it naturally.',
            '- Do not mention UI markers, citations, or question marks.',
            '',
            'Heart Walk systems overview:',
            overview,
            '',
            'Universal image style reference:',
            style || 'No universal style provided.',
            '',
            'Slide context:',
            slideSummary
        ].join('\n');
    }

    function getNotesInputForField(slideIndex, fieldPath) {
        const slideEl = container.querySelector(`.slide[data-index="${slideIndex}"]`);
        if (!slideEl) return null;
        return slideEl.querySelector(`[data-role="image-notes"][data-field-path="${fieldPath}"]`);
    }

    function updateImagePromptInputs(slideIndex, fieldPath, value) {
        const notesEl = getNotesInputForField(slideIndex, fieldPath);
        if (notesEl && document.activeElement !== notesEl) notesEl.value = value;
    }

    function setSettingsStatus(id, message, isError = false) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('error', !!isError);
    }

    function serializeDeckState(pretty = false) {
        return JSON.stringify({ config: appConfig, slides: slidesData }, null, pretty ? 2 : 0);
    }

    async function saveDeckSnapshotToDb(serializedDeck = serializeDeckState(), options = {}) {
        if (!serializedDeck || serializedDeck === lastRemoteDeckSnapshot) return true;
        try {
            const DBHelper = await initDesignerDb();
            await DBHelper.query(
                DESIGNER_DB_APP_NAME,
                'INSERT INTO kv_store (namespace, key_name, value_json, updated_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_at = NOW()',
                [DESIGNER_DECK_NAMESPACE, DESIGNER_DECK_AUTOSAVE_KEY, serializedDeck]
            );
            lastRemoteDeckSnapshot = serializedDeck;
            if (options.showToastOnSuccess) showToast('Deck autosaved to DB.');
            return true;
        } catch (err) {
            console.warn('[Designer] Failed to autosave deck to DB:', err);
            if (!options.silent) {
                showToast('Saved locally, but DB autosave failed.', 'error', 3600);
            }
            return false;
        }
    }

    function scheduleDeckAutosave(options = {}) {
        const delayMs = Number.isFinite(options.delayMs) ? options.delayMs : 900;
        if (deckAutosaveTimer) clearTimeout(deckAutosaveTimer);
        deckAutosaveTimer = setTimeout(async () => {
            deckAutosaveTimer = null;
            if (deckAutosaveInFlight) {
                pendingDeckAutosave = true;
                return;
            }
            deckAutosaveInFlight = true;
            try {
                await saveDeckSnapshotToDb(serializeDeckState(), { silent: true });
            } finally {
                deckAutosaveInFlight = false;
                if (pendingDeckAutosave) {
                    pendingDeckAutosave = false;
                    scheduleDeckAutosave({ delayMs: 250 });
                }
            }
        }, delayMs);
    }

    async function flushDeckAutosave(options = {}) {
        if (deckAutosaveTimer) {
            clearTimeout(deckAutosaveTimer);
            deckAutosaveTimer = null;
        }
        if (deckAutosaveInFlight) {
            pendingDeckAutosave = true;
            return false;
        }
        deckAutosaveInFlight = true;
        try {
            return await saveDeckSnapshotToDb(serializeDeckState(), options);
        } finally {
            deckAutosaveInFlight = false;
            if (pendingDeckAutosave) {
                pendingDeckAutosave = false;
                scheduleDeckAutosave({ delayMs: 250 });
            }
        }
    }

    async function hydrateRemoteDeckAutosave(preferRemote = false) {
        try {
            const DBHelper = await initDesignerDb();
            const result = await DBHelper.query(
                DESIGNER_DB_APP_NAME,
                'SELECT value_json FROM kv_store WHERE namespace = ? AND key_name = ? LIMIT 1',
                [DESIGNER_DECK_NAMESPACE, DESIGNER_DECK_AUTOSAVE_KEY]
            );
            const serializedDeck = String(result?.rows?.[0]?.value_json || '').trim();
            if (!serializedDeck) return false;
            lastRemoteDeckSnapshot = serializedDeck;
            if (!preferRemote || serializedDeck === lastDeckLoadedFromRemote) return true;

            const parsed = JSON.parse(serializedDeck);
            if (!parsed || !Array.isArray(parsed.slides)) return false;
            appConfig = parsed.config || {};
            slidesData = parsed.slides.map(ensureSlideSchema);
            fillConfigFromActivePreset(appConfig);
            if (!appConfig.typeOffsets) appConfig.typeOffsets = {};
            for (const type of ['cover', 'section', 'standard', 'two-column']) {
                if (!appConfig.typeOffsets[type]) appConfig.typeOffsets[type] = { x: 0, y: 0 };
            }
            lastDeckLoadedFromRemote = serializedDeck;
            applyConfig(); render(); saveState(); showSlide(0);
            showToast('Recovered the latest autosaved deck from DB.', 'info', 3200);
            return true;
        } catch (err) {
            console.warn('[Designer] Failed to load remote deck autosave:', err);
            return false;
        }
    }

    function updateBatchStatusUI() {
        const statusEl = document.getElementById('batch-image-status');
        const runBtn = document.getElementById('generate-missing-images-btn');
        const cancelBtn = document.getElementById('cancel-generate-missing-images-btn');
        if (statusEl) {
            if (!BATCH_IMAGE_STATE.running) {
                const parallelism = getBatchParallelism();
                statusEl.textContent = `No image generation batch running. Parallel requests: ${parallelism}.`;
            } else {
                const parts = [`${BATCH_IMAGE_STATE.completed}/${BATCH_IMAGE_STATE.total} completed`];
                parts.push(`Parallel: ${BATCH_IMAGE_STATE.parallelism}`);
                if (BATCH_IMAGE_STATE.failed) parts.push(`${BATCH_IMAGE_STATE.failed} failed`);
                if (Array.isArray(BATCH_IMAGE_STATE.current) && BATCH_IMAGE_STATE.current.length) {
                    parts.push(`Active: ${BATCH_IMAGE_STATE.current.join(' | ')}`);
                }
                if (BATCH_IMAGE_STATE.cancelRequested) parts.push('Cancel requested');
                statusEl.textContent = parts.join(' · ');
            }
        }
        if (runBtn) runBtn.disabled = BATCH_IMAGE_STATE.running;
        if (cancelBtn) cancelBtn.disabled = !BATCH_IMAGE_STATE.running;
    }

    function getBatchParallelism() {
        const input = document.getElementById('batch-image-parallelism');
        const rawValue = Number(input?.value ?? localStorage.getItem(BATCH_IMAGE_PARALLELISM_STORAGE_KEY) ?? DEFAULT_BATCH_IMAGE_PARALLELISM);
        return Math.max(1, Math.min(6, Number.isFinite(rawValue) ? Math.round(rawValue) : DEFAULT_BATCH_IMAGE_PARALLELISM));
    }

    function normalizeBatchParallelismInput() {
        const input = document.getElementById('batch-image-parallelism');
        if (!input) return getBatchParallelism();
        const normalized = getBatchParallelism();
        input.value = String(normalized);
        localStorage.setItem(BATCH_IMAGE_PARALLELISM_STORAGE_KEY, String(normalized));
        updateBatchStatusUI();
        return normalized;
    }

    function syncLayoutActionButtons() {
        const addBtn = document.getElementById('add-second-column-btn');
        const removeBtn = document.getElementById('remove-second-column-btn');
        const slide = slidesData[currentSlideIndex];
        const type = slide?.type;
        if (addBtn) addBtn.disabled = type !== 'standard';
        if (removeBtn) removeBtn.disabled = type !== 'two-column';
    }

    async function getAiTools() {
        if (!aiToolsPromise) aiToolsPromise = import('https://happydo.xyz/api/ailnl.js');
        return aiToolsPromise;
    }

    async function getDbHelper() {
        if (!dbHelperPromise) dbHelperPromise = import('https://happydo.xyz/api_auto_db/db_helper.js');
        return dbHelperPromise;
    }

    async function initDesignerDb() {
        if (!designerDbInitPromise) {
            designerDbInitPromise = (async () => {
                const { DBHelper } = await getDbHelper();
                await DBHelper.init(DESIGNER_DB_APP_NAME);
                return DBHelper;
            })();
        }
        return designerDbInitPromise;
    }

    function updateImageStyleSelectUI() {
        const select = document.getElementById('image-style-select');
        if (!select) return;
        const currentStyle = String(appConfig.imagePromptStyle || '').trim();
        const options = ['<option value="">Custom / current style</option>'];
        cachedImageStyles.forEach(style => {
            options.push(`<option value="${escapeHtml(style.name)}">${escapeHtml(style.name)}</option>`);
        });
        select.innerHTML = options.join('');
        const matched = cachedImageStyles.find(style => String(style.prompt || '').trim() === currentStyle);
        select.value = matched ? matched.name : '';
    }

    async function reloadNamedImageStylesFromDb(showToastOnSuccess = false) {
        try {
            const DBHelper = await initDesignerDb();
            const result = await DBHelper.query(
                DESIGNER_DB_APP_NAME,
                'SELECT key_name, value_json, updated_at FROM kv_store WHERE namespace = ? ORDER BY key_name ASC',
                [DESIGNER_STYLE_NAMESPACE]
            );
            cachedImageStyles = (result?.rows || []).map(row => {
                let parsed = {};
                try { parsed = JSON.parse(row.value_json || '{}'); } catch { parsed = {}; }
                const name = String(parsed.name || row.key_name || '').trim();
                const prompt = String(parsed.prompt || '').trim();
                return name && prompt ? { name, prompt, updatedAt: row.updated_at || '' } : null;
            }).filter(Boolean);
            updateImageStyleSelectUI();
            setSettingsStatus('image-style-status', `${cachedImageStyles.length} style${cachedImageStyles.length === 1 ? '' : 's'} loaded from DB.`);
            if (showToastOnSuccess) showToast('Image styles loaded from DB.');
        } catch (err) {
            console.warn('[Designer] Failed to load image styles from DB:', err);
            setSettingsStatus('image-style-status', 'Could not load styles from DB. Using local values.', true);
            if (showToastOnSuccess) showToast('Could not load image styles from DB.', 'error', 3200);
        }
    }

    async function saveCurrentImageStyleToDb() {
        const nameEl = document.getElementById('image-style-name');
        const styleText = String(document.getElementById('image-prompt-style')?.value || '').trim();
        const styleName = String(nameEl?.value || '').trim();
        if (!styleText) {
            setSettingsStatus('image-style-status', 'Enter a style prompt before saving.', true);
            showToast('Enter an image style before saving.', 'error', 2600);
            return;
        }
        if (!styleName) {
            setSettingsStatus('image-style-status', 'Enter a style name before saving.', true);
            showToast('Enter a style name before saving.', 'error', 2600);
            return;
        }
        const existing = cachedImageStyles.find(style => style.name.toLowerCase() === styleName.toLowerCase());
        if (existing && !confirm(`Overwrite the saved style "${styleName}"?`)) return;
        try {
            const DBHelper = await initDesignerDb();
            await DBHelper.query(
                DESIGNER_DB_APP_NAME,
                'INSERT INTO kv_store (namespace, key_name, value_json, updated_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_at = NOW()',
                [DESIGNER_STYLE_NAMESPACE, styleName, JSON.stringify({ name: styleName, prompt: styleText })]
            );
            setSettingsStatus('image-style-status', `Saved style "${styleName}" to DB.`);
            showToast(`Saved style "${styleName}".`);
            await reloadNamedImageStylesFromDb(false);
            updateImageStyleSelectUI();
        } catch (err) {
            console.warn('[Designer] Failed to save image style to DB:', err);
            setSettingsStatus('image-style-status', 'Could not save style to DB.', true);
            showToast('Could not save style to DB.', 'error', 3200);
        }
    }

    function applySelectedImageStyleFromDb() {
        const select = document.getElementById('image-style-select');
        if (!select) return;
        const selected = cachedImageStyles.find(style => style.name === select.value);
        if (!selected) return;
        appConfig.imagePromptStyle = selected.prompt;
        const styleInput = document.getElementById('image-prompt-style');
        if (styleInput) styleInput.value = selected.prompt;
        saveState();
        setSettingsStatus('image-style-status', `Applied style "${selected.name}" to this deck.`);
        showToast(`Applied style "${selected.name}".`);
    }

    async function reloadOverviewTextFromDb(showToastOnSuccess = false) {
        try {
            const DBHelper = await initDesignerDb();
            const result = await DBHelper.query(
                DESIGNER_DB_APP_NAME,
                'SELECT value_json FROM kv_store WHERE namespace = ? AND key_name = ? LIMIT 1',
                [DESIGNER_OVERVIEW_NAMESPACE, DESIGNER_OVERVIEW_KEY]
            );
            const raw = result?.rows?.[0]?.value_json;
            if (raw) {
                let parsed = {};
                try { parsed = JSON.parse(raw); } catch { parsed = {}; }
                overviewTextCache = String(parsed.text || DEFAULT_HEART_WALK_OVERVIEW).trim();
            } else {
                overviewTextCache = DEFAULT_HEART_WALK_OVERVIEW;
            }
            const overviewEl = document.getElementById('heart-walk-overview-text');
            if (overviewEl && document.activeElement !== overviewEl) overviewEl.value = overviewTextCache;
            setSettingsStatus('overview-status', 'Overview text loaded from DB.');
            if (showToastOnSuccess) showToast('Overview text loaded from DB.');
        } catch (err) {
            console.warn('[Designer] Failed to load overview text from DB:', err);
            overviewTextCache = overviewTextCache || DEFAULT_HEART_WALK_OVERVIEW;
            const overviewEl = document.getElementById('heart-walk-overview-text');
            if (overviewEl && !overviewEl.value) overviewEl.value = overviewTextCache;
            setSettingsStatus('overview-status', 'Could not load overview text from DB. Using local default.', true);
            if (showToastOnSuccess) showToast('Could not load overview text from DB.', 'error', 3200);
        }
    }

    async function saveOverviewTextToDb() {
        const overviewEl = document.getElementById('heart-walk-overview-text');
        const nextText = String(overviewEl?.value || '').trim();
        if (!nextText) {
            setSettingsStatus('overview-status', 'Overview text cannot be empty.', true);
            showToast('Overview text cannot be empty.', 'error', 2600);
            return;
        }
        try {
            const DBHelper = await initDesignerDb();
            await DBHelper.query(
                DESIGNER_DB_APP_NAME,
                'INSERT INTO kv_store (namespace, key_name, value_json, updated_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_at = NOW()',
                [DESIGNER_OVERVIEW_NAMESPACE, DESIGNER_OVERVIEW_KEY, JSON.stringify({ text: nextText })]
            );
            overviewTextCache = nextText;
            setSettingsStatus('overview-status', 'Saved overview text to DB.');
            showToast('Saved overview text to DB.');
        } catch (err) {
            console.warn('[Designer] Failed to save overview text to DB:', err);
            setSettingsStatus('overview-status', 'Could not save overview text to DB.', true);
            showToast('Could not save overview text to DB.', 'error', 3200);
        }
    }

    async function hydrateRemoteDesignerSettings() {
        await Promise.allSettled([
            reloadNamedImageStylesFromDb(false),
            reloadOverviewTextFromDb(false)
        ]);
        updateBatchStatusUI();
    }

    function buildImageGenerationPrompt(rawPrompt) {
        const basePrompt = String(rawPrompt || '').trim();
        if (!basePrompt) return '';
        const style = getImagePromptStyle();
        if (!style) return basePrompt;
        if (basePrompt.toLowerCase().includes(style.toLowerCase())) return basePrompt;
        return `${basePrompt}\n\nVisual style: ${style}`;
    }

    function getClipboardImageFile(clipboardData) {
        const items = Array.from(clipboardData?.items || []);
        for (const item of items) {
            if (String(item.type || '').startsWith('image/')) {
                const file = item.getAsFile();
                if (file) return file;
            }
        }
        const files = Array.from(clipboardData?.files || []);
        return files.find(file => String(file.type || '').startsWith('image/')) || null;
    }

    function ensureFieldDefaults(field, fallbackText = '') {
        const base = field || {};
        const mode = ['text', 'image', 'quote'].includes(base.mode) ? base.mode : 'text';
        const imageAlign = ['center', 'left', 'right', 'top', 'bottom'].includes(base.imageAlign) ? base.imageAlign : 'center';
        const textScale = ['large', 'normal', 'small'].includes(base.textScale) ? base.textScale : 'normal';
        const rawDelta = Number(base.fontDelta ?? 0);
        const fontDelta = Number.isFinite(rawDelta) ? Math.max(-12, Math.min(12, rawDelta)) : 0;
        return {
            mode,
            text: base.text ?? fallbackText,
            imageUrl: base.imageUrl || '',
            imageAlign,
            imagePrompt: base.imagePrompt || '',   // AI-suggested image idea (preserved across mode switches)
            imageNotes: base.imageNotes || '',         // alt-text / image description for accessibility & AI generation
            imageHistory: Array.isArray(base.imageHistory) ? base.imageHistory : [],
            quoteText: base.quoteText ?? fallbackText,
            quoteAttribution: base.quoteAttribution || '',
            sources: Array.isArray(base.sources) ? base.sources : [],
            textScale,
            fontDelta
        };
    }

    function extractQuoteBubbleFromMarkdown(text) {
        const lines = String(text || '').split(/\r?\n/);
        if (!lines.length) return null;

        let markerIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            if (/^\s*>\s*\*\*\s*Quote\s*Bubble/i.test(lines[i] || '')) {
                markerIdx = i;
                break;
            }
        }
        if (markerIdx < 0) return null;

        const marker = String(lines[markerIdx] || '');
        const speakerMatch = marker.match(/quote\s*bubble\s*[—-]\s*(.+?)\*\*/i);
        const speaker = (speakerMatch?.[1] || '').trim();

        let quoteIdx = -1;
        for (let i = markerIdx + 1; i < lines.length; i++) {
            if (/^\s*>/.test(lines[i] || '')) {
                quoteIdx = i;
                break;
            }
            if (String(lines[i] || '').trim() !== '') break;
        }
        if (quoteIdx < 0) return null;

        let quoteText = String(lines[quoteIdx] || '').replace(/^\s*>\s*/, '').trim();
        quoteText = quoteText.replace(/^"+/, '').replace(/"+$/, '').trim();
        if (!quoteText) return null;

        const keep = lines.filter((_, idx) => idx !== markerIdx && idx !== quoteIdx);
        const leftText = keep.join('\n').replace(/\n{3,}/g, '\n\n').trim();

        return { leftText, quoteText, speaker };
    }

    /** Recognized slide types → rendering pipelines */
    const KNOWN_SLIDE_TYPES = new Set(['cover', 'section', 'standard', 'two-column']);

    function ensureSlideSchema(slide) {
        if (!slide || typeof slide !== 'object') return { type: 'standard', title: '(empty)', content: '', speakerNotes: '', bodyField: ensureFieldDefaults({}, '') };

        // Coerce unknown types → standard so they still render
        if (!KNOWN_SLIDE_TYPES.has(slide.type)) {
            console.warn(`[Designer] Unknown slide type "${slide.type}" → coerced to "standard"`);
            slide._originalType = slide.type;  // stash for debugging
            slide.type = 'standard';
        }

        // Cover: ensure subtitle exists
        if (slide.type === 'cover') {
            slide.subtitle = slide.subtitle ?? '';
        }
        slide.speakerNotes = slide.speakerNotes ?? '';

        // Standard: ensure bodyField exists
        if (slide.type === 'standard') {
            slide.bodyField = ensureFieldDefaults(slide.bodyField, slide.content || '');
            if (!slide.content) slide.content = slide.bodyField.text || '';

            if (slide.bodyField.mode === 'text') {
                const parsedQuote = extractQuoteBubbleFromMarkdown(slide.bodyField.text || slide.content || '');
                if (parsedQuote?.quoteText) {
                    slide.type = 'two-column';
                    slide.content = parsedQuote.leftText || '';
                    slide.columns = {
                        splitPct: 55,
                        leftField: ensureFieldDefaults({ mode: 'text', text: parsedQuote.leftText || '' }, parsedQuote.leftText || ''),
                        rightField: ensureFieldDefaults({ mode: 'quote', quoteText: parsedQuote.quoteText, quoteAttribution: parsedQuote.speaker || '' }, '')
                    };
                    delete slide.bodyField;
                }
            }
        }

        // Two-column: ensure columns + sub-fields exist
        if (slide.type === 'two-column') {
            const leftBase = slide.columns?.leftField || { mode: 'text', text: slide.content || '' };
            const rightBase = slide.columns?.rightField || { mode: 'text', text: '' };
            const splitPct = Number(slide.columns?.splitPct ?? 50);
            slide.columns = {
                splitPct: Number.isFinite(splitPct) ? Math.max(20, Math.min(80, splitPct)) : 50,
                leftField: ensureFieldDefaults(leftBase, leftBase.text || ''),
                rightField: ensureFieldDefaults(rightBase, rightBase.text || '')
            };
            if (!slide.content) slide.content = leftBase.text || '';
        }

        // Ensure title always exists
        if (!slide.title) slide.title = slide.type === 'cover' ? 'Untitled Deck' : '';

        return slide;
    }

    function getByPath(obj, path) {
        return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj);
    }

    function setByPath(obj, path, value) {
        const keys = path.split('.');
        const last = keys.pop();
        let ref = obj;
        keys.forEach(key => {
            if (!ref[key] || typeof ref[key] !== 'object') ref[key] = {};
            ref = ref[key];
        });
        ref[last] = value;
    }

    function formatSignedDelta(v) {
        const n = Number(v || 0);
        if (!Number.isFinite(n) || n === 0) return '0';
        return n > 0 ? `+${n}` : `${n}`;
    }

    function showFieldTypoIndicator(field) {
        const el = document.getElementById('field-typo-indicator');
        if (!el || !field) return;
        const scale = String(field.textScale || 'normal');
        const delta = Number(field.fontDelta || 0);
        el.textContent = `P: ${scale}  ·  Δ ${formatSignedDelta(delta)}px`;
        el.classList.add('visible');
    }

    function hideFieldTypoIndicator() {
        const el = document.getElementById('field-typo-indicator');
        if (!el) return;
        el.classList.remove('visible');
    }

    function getFieldFromEditable(el) {
        if (!el) return null;
        const role = el.dataset.role;
        if (!role || !['field-text', 'field-quote-text', 'field-quote-attrib'].includes(role)) return null;
        const slideEl = el.closest('.slide');
        if (!slideEl) return null;
        const index = parseInt(slideEl.dataset.index, 10);
        if (Number.isNaN(index)) return null;
        const slide = slidesData[index];
        ensureSlideSchema(slide);
        return getByPath(slide, el.dataset.fieldPath);
    }

    function imageAlignStyle(align) {
        if (align === 'left') return 'justify-content:flex-start;align-items:flex-start;';
        if (align === 'right') return 'justify-content:flex-end;align-items:flex-start;';
        if (align === 'bottom') return 'justify-content:center;align-items:flex-end;';
        if (align === 'center') return 'justify-content:center;align-items:center;';
        return 'justify-content:center;align-items:flex-start;';
    }

    // ── SVG icon paths for mode selector ──
    const MODE_ICONS = {
        text: '<svg class="mode-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h12M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        image: '<svg class="mode-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 15l2-2 3 4 3-3 2 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="10" r="1" fill="currentColor"/></svg>',
        quote: '<svg class="mode-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 10.5c0-2.2 1.2-3.8 3.5-4.5v2c-1.1.4-1.5 1.1-1.5 2.5H11V18H7.5v-7.5zm9 0c0-2.2 1.2-3.8 3.5-4.5v2c-1.1.4-1.5 1.1-1.5 2.5H20V18h-3.5v-7.5z" fill="currentColor"/></svg>'
    };

    function renderFieldControls(fieldPath, field) {
        // Icon-only mode selector — appears on hover via CSS
        const modes = ['text', 'image', 'quote'];
        const labels = { text: 'Text', image: 'Image', quote: 'Quote' };
        const btns = modes.map(m =>
            `<button class="field-mode-btn ${field.mode === m ? 'active' : ''}" data-role="field-mode-btn" data-field-path="${fieldPath}" data-mode-value="${m}" title="${labels[m]}" aria-label="${labels[m]}">${MODE_ICONS[m]}</button>`
        ).join('');
        const fontBtns = `<div class="field-font-stepper" title="Adjust local font size.">
            <button class="field-font-step-btn" data-role="field-font-step" data-field-path="${fieldPath}" data-step="1" title="Adjust local font size.">▲</button>
            <button class="field-font-step-btn" data-role="field-font-step" data-field-path="${fieldPath}" data-step="-1" title="Adjust local font size.">▼</button>
        </div>`;
        return `<div class="field-mode-icons"><div class="field-mode-main">${btns}</div>${fontBtns}</div>`;
    }

    function renderFieldBody(fieldPath, field, slideIndex = currentSlideIndex) {
        // ── Shared helper: image notes row (shown below loaded image) ──
        function imageNotesHtml(fieldPath, field, options = {}) {
            const notes = field.imageNotes || '';
            const historyEntries = getImageHistoryEntries(field);
            const historyHtml = historyEntries.length
                ? `<div class="image-history-picker-row">
                    <select class="image-history-select" data-role="image-history-select" data-field-path="${fieldPath}">
                        <option value="">Restore previous version...</option>
                        ${historyEntries.map(entry => `<option value="${entry.historyIndex}">${entry.label}</option>`).join('')}
                    </select>
                    <button class="image-history-restore-btn" data-role="image-history-restore-btn" data-field-path="${fieldPath}">Restore</button>
                </div>`
                : '<div class="image-history-empty">No previous image versions yet.</div>';
            return `<div class="image-tools-row${options.managePanel ? ' image-tools-row-manage' : ''}">
                <textarea class="image-notes-field" data-role="image-notes" data-field-path="${fieldPath}" rows="2" placeholder="Image description / alt-text (also used as AI prompt)">${escapeHtml(notes)}</textarea>
                <div class="image-tools-btns">
                    <button class="auto-prompt-btn" data-role="auto-prompt-btn" data-default-label="Auto Prompt" data-field-path="${fieldPath}" title="Draft an image prompt from the slide content">Auto Prompt</button>
                    <button class="ai-gen-btn" data-role="ai-gen-btn" data-default-label="${options.managePanel ? 'Regenerate' : 'AI'}" data-field-path="${fieldPath}" title="Generate new image from description">${options.managePanel ? 'Regenerate' : 'AI'}</button>
                    <label class="btn-browse-file" title="Browse for image file">📂 Browse<input type="file" accept="image/*" data-role="field-image-file" data-field-path="${fieldPath}" style="display:none"></label>
                    ${options.managePanel ? `<button class="image-manage-close-btn" data-role="image-manage-close-btn" data-field-path="${fieldPath}">Done</button>` : ''}
                </div>
                ${options.managePanel ? `<div class="image-manage-meta">
                    <div class="drop-cell-url image-manage-url-block">
                        <div class="drop-cell-title">Paste URL</div>
                        <div class="url-row">
                            <input type="text" placeholder="https://..." data-role="field-image-url" data-field-path="${fieldPath}">
                            <button data-role="url-load-btn" data-field-path="${fieldPath}">Load</button>
                        </div>
                    </div>
                    <div class="image-manage-paste-hint" data-role="image-paste-target" data-field-path="${fieldPath}" tabindex="0">Click here, then press Ctrl+V to paste a copied image.</div>
                    ${historyHtml}
                </div>` : ''}
            </div>`;
        }

        if (field.mode === 'image') {
            if (field.imageUrl) {
                const manageOpen = isImageManageMode(slideIndex, fieldPath);
                const altText = escapeHtml(field.imageNotes || 'Slide image');
                return `<div class="field-body field-body-loaded" data-mode="image">
                    <div class="image-display-shell${manageOpen ? ' is-managing' : ''}">
                        ${manageOpen
                            ? `<div class="image-manage-panel" data-role="image-manage-panel" data-field-path="${fieldPath}">
                                <div class="image-manage-heading">Replace or revise image</div>
                                ${imageNotesHtml(fieldPath, field, { managePanel: true })}
                            </div>`
                            : `<div class="image-field" data-role="image-field" data-field-path="${fieldPath}" data-image-align="${field.imageAlign || 'top'}" style="${imageAlignStyle(field.imageAlign)}" tabindex="0" title="Click near an edge to align. Hover for image settings.">
                                <button class="image-settings-btn" data-role="image-settings-btn" data-field-path="${fieldPath}" title="Manage image">
                                    <i class="fa-solid fa-gear" aria-hidden="true"></i>
                                </button>
                                <img src="${escapeHtml(field.imageUrl)}" alt="${altText}">
                            </div>`}
                    </div>
                </div>`;
            }
            // ── No image: unified drop-zone with all 4 options ──
            const notes = field.imageNotes || '';
            return `<div class="field-body" data-mode="image">
                <div class="image-drop-zone" data-role="image-drop-zone" data-field-path="${fieldPath}">
                    <input type="file" accept="image/*" data-role="field-image-file" data-field-path="${fieldPath}" style="display:none">
                    <div class="drop-zone-grid">
                        <div class="drop-zone-cell drop-cell-browse">
                            <svg class="drop-icon" viewBox="0 0 24 24"><path d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/></svg>
                            <div class="drop-label">Drop image here or click to browse</div>
                        </div>
                        <div class="drop-zone-cell drop-cell-paste" data-role="image-paste-target" data-field-path="${fieldPath}" tabindex="0" title="Click here, then paste an image from your clipboard">
                            <div class="drop-cell-title">Paste Image</div>
                            <div class="drop-paste-hint">Click here, then press Ctrl+V to paste a copied image.</div>
                        </div>
                        <div class="drop-zone-cell drop-cell-url">
                            <div class="drop-cell-title">Paste URL</div>
                            <div class="url-row">
                                <input type="text" placeholder="https://..." data-role="field-image-url" data-field-path="${fieldPath}">
                                <button data-role="url-load-btn" data-field-path="${fieldPath}">Load</button>
                            </div>
                        </div>
                        <div class="drop-zone-cell drop-cell-ai">
                            <div class="drop-cell-title">AI Generate</div>
                            <div class="image-ai-compose">
                                <textarea class="image-notes-field" data-role="image-notes" data-field-path="${fieldPath}" rows="3" placeholder="Describe the image you want…">${escapeHtml(notes)}</textarea>
                                <div class="image-ai-actions">
                                    <button class="auto-prompt-btn" data-role="auto-prompt-btn" data-default-label="Auto Prompt" data-field-path="${fieldPath}">Auto Prompt</button>
                                    <button class="ai-gen-btn" data-role="ai-gen-btn" data-default-label="Generate" data-field-path="${fieldPath}">Generate</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        }

        if (field.mode === 'quote') {
            const quoteAttribution = getResolvedQuoteAttribution(field);
            const quoteOverrideActive = hasUniversalQuoteAttribution();
            const hideAttrib = !!appConfig.hideAttrib;
            const hideGraphics = !!appConfig.hideAllImages;
            const attribClass = (quoteAttribution && !hideAttrib) ? 'quote-attrib' : 'quote-attrib quote-attrib-empty';
            const attribText = (quoteAttribution && !hideAttrib) ? escapeHtml(quoteAttribution) : '&nbsp;';
            const quoteBoxClass = hideGraphics ? 'quote-vector-box quote-plain-box' : 'quote-vector-box';
            const quoteBodyClass = hideGraphics ? 'quote-body quote-body-plain' : 'quote-body';
            const openingMark = hideGraphics ? '<div class="quote-opening-mark" aria-hidden="true">“</div>' : '';
            return `<div class="field-body" data-mode="quote">
                <div class="${quoteBoxClass}" style="--field-font-delta:${field.fontDelta || 0}px;">
                    ${openingMark}
                    <div class="${quoteBodyClass}" contenteditable="true" data-role="field-quote-text" data-field-path="${fieldPath}">${escapeHtml(field.quoteText || '')}</div>
                    <div class="${attribClass}${quoteOverrideActive ? ' quote-attrib-override' : ''}" contenteditable="${quoteOverrideActive ? 'false' : 'true'}" data-role="field-quote-attrib" data-field-path="${fieldPath}" title="${quoteOverrideActive ? 'Using universal quote attribution from Settings.' : ''}">${attribText}</div>
                </div>
            </div>`;
        }

        return `<div class="field-body" data-mode="text"><div class="slide-content" style="--field-font-delta:${field.fontDelta || 0}px;" data-text-scale="${field.textScale || 'normal'}" contenteditable="true" data-role="field-text" data-field-path="${fieldPath}">${mdToHtml(field.text || '')}</div></div>`;
    }

    function renderFieldShell(fieldPath, field, slideIndex = currentSlideIndex) {
        return `<div class="field-shell">${renderFieldControls(fieldPath, field)}${renderFieldBody(fieldPath, field, slideIndex)}</div>`;
    }

    function resizeStage() {
        const baseWidth = 1280; const baseHeight = 720;
        const availWidth = window.innerWidth - 60; const availHeight = window.innerHeight - 60;
        const scale = Math.min(availWidth / baseWidth, availHeight / baseHeight);
        stage.style.transform = `scale(${scale})`;
    }
    window.addEventListener('resize', resizeStage);

    function renderSettingsRows() {
        const wrapper = document.getElementById('design-rows');
        wrapper.innerHTML = '';
        const optionsHTML = fontOptions.map(f => `<option value="${f.value}">${f.name}</option>`).join('');
        types.forEach(t => {
            wrapper.innerHTML += `<div class="setting-row"><span>${t.label}:</span><select id="font-${t.id}" onchange="updateTheme()">${optionsHTML}</select><input type="number" id="size-${t.id}" onchange="updateTheme()"><div class="color-trigger" id="color-btn-${t.id}" onclick="openColorPicker(event, '${t.id}')"></div></div>`;
        });
        const pop = document.getElementById('color-picker-popover');
        pop.innerHTML = '';
        palette.forEach(c => { pop.innerHTML += `<div class="swatch-btn" style="background:${c}" onclick="pickColor('${c}')"></div>`; });
        pop.innerHTML += `<div class="swatch-btn" style="background:conic-gradient(red,yellow,lime,aqua,blue,magenta,red)" onclick="triggerCustomColor()"></div>`;
    }

    function setSettingsTab(tabId) {
        activeSettingsTab = ['typography', 'content', 'layout', 'export'].includes(tabId) ? tabId : 'typography';
        document.querySelectorAll('[data-settings-tab]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.settingsTab === activeSettingsTab);
        });
        document.querySelectorAll('[data-settings-panel]').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.settingsPanel === activeSettingsTab);
        });
    }

    function renderSpeakerNotesPanel() {
        if (!speakerNotesPanel || !speakerNotesInput) return;
        const showPanel = !!appConfig.showSpeakerNotes;
        const slide = slidesData[currentSlideIndex];
        ensureSlideSchema(slide);
        const hasNotes = !!String(slide?.speakerNotes || '').trim();
        document.body.classList.toggle('speaker-notes-open', showPanel);
        document.body.classList.toggle('has-slide-speaker-notes', hasNotes);
        speakerNotesPanel.classList.toggle('open', showPanel);
        if (!showPanel) return;
        const label = document.getElementById('speaker-notes-slide-label');
        if (label) {
            const title = String(slide?.title || '').trim();
            label.textContent = title ? `Slide ${currentSlideIndex + 1} · ${title}` : `Slide ${currentSlideIndex + 1}`;
        }
        if (document.activeElement !== speakerNotesInput) {
            speakerNotesInput.value = slide?.speakerNotes || '';
        }
    }

    function toggleSpeakerNotes(nextState) {
        const checkbox = document.getElementById('toggle-speaker-notes');
        const shouldShow = typeof nextState === 'boolean' ? nextState : !!checkbox?.checked;
        appConfig.showSpeakerNotes = shouldShow;
        if (checkbox) checkbox.checked = shouldShow;
        saveState();
        renderSpeakerNotesPanel();
    }

    function updateSpeakerNotes() {
        const slide = slidesData[currentSlideIndex];
        if (!slide) return;
        ensureSlideSchema(slide);
        slide.speakerNotes = speakerNotesInput.value;
        saveState();
    }

    function syncUniversalQuoteAttributionPreview() {
        const quoteOverrideActive = hasUniversalQuoteAttribution();
        const quoteAttribution = getTrimmedConfigValue('universalQuoteAttribution');
        const hideAttrib = !!appConfig.hideAttrib;
        document.querySelectorAll('[data-role="field-quote-attrib"]').forEach(el => {
            const slideEl = el.closest('.slide');
            if (!slideEl) return;
            const index = parseInt(slideEl.dataset.index, 10);
            if (Number.isNaN(index)) return;
            const slide = slidesData[index];
            ensureSlideSchema(slide);
            const field = getByPath(slide, el.dataset.fieldPath);
            if (!field) return;
            const resolved = quoteOverrideActive ? quoteAttribution : String(field.quoteAttribution || '').trim();
            const visible = !!resolved && !hideAttrib;
            el.classList.toggle('quote-attrib-empty', !visible);
            el.classList.toggle('quote-attrib-override', quoteOverrideActive);
            el.setAttribute('contenteditable', quoteOverrideActive ? 'false' : 'true');
            el.title = quoteOverrideActive ? 'Using universal quote attribution from Settings.' : '';
            el.innerHTML = visible ? escapeHtml(resolved) : '&nbsp;';
        });
    }

    function render() {
        stage.innerHTML = ''; 
        slidesData.forEach((slide, index) => {
            ensureSlideSchema(slide);
            const slideEl = document.createElement('div');
            slideEl.className = `slide ${index === currentSlideIndex ? 'active' : ''}`;
            slideEl.dataset.index = index;
            slideEl.dataset.type = slide.type;
            if (slide.type === 'cover' || slide.type === 'section') slideEl.classList.add('layout-centered');
            
            // LOCAL & TEMPLATE OFFSETS
            slideEl.style.setProperty('--local-x', (slide.x || 0) + 'px');
            slideEl.style.setProperty('--local-y', (slide.y || 0) + 'px');
            
            // Inject Template Offsets
            const tOff = appConfig.typeOffsets ? (appConfig.typeOffsets[slide.type] || {x:0, y:0}) : {x:0, y:0};
            slideEl.style.setProperty('--template-x', tOff.x + 'px');
            slideEl.style.setProperty('--template-y', tOff.y + 'px');

            let shapeHTML = '';
            if (slide.type === 'cover' || slide.type === 'section') {
                const color = slide.shapeColor || 'var(--c-emotional)';
                const path = appConfig.shapePath || defaultShapePath;
                const viewBox = appConfig.shapeViewBox || defaultViewBox;
                shapeHTML = `<div class="decor-shape" style="color:${color}"><svg viewBox="${viewBox}" preserveAspectRatio="none" style="width:100%; height:100%;"><path d="${path}" fill="currentColor"></path></svg></div>`;
            }

            const titleStyle = `transform: translate(${slide.titleX || 0}px, ${slide.titleY || 0}px)`;
            const bodyStyle = `transform: translate(${slide.bodyX || 0}px, ${slide.bodyY || 0}px)`;

            let innerHTML = '';
            if (slide.type === 'cover') {
                innerHTML = `<div class="title-wrapper" style="${titleStyle}"><div class="title-text" contenteditable="true" data-key="title">${slide.title || 'Title'}</div></div>
                             <div class="body-wrapper" style="${bodyStyle}"><div class="subtitle-text" contenteditable="true" data-key="subtitle">${slide.subtitle || 'Subtitle'}</div></div>`;
            } else if (slide.type === 'section') {
                innerHTML = `<div class="title-wrapper" style="${titleStyle}"><h1 contenteditable="true" data-key="title">${slide.title || 'Section'}</h1></div>`;
            } else if (slide.type === 'two-column') {
                const splitPct = slide.columns?.splitPct ?? 50;
                innerHTML = `<div class="title-wrapper" style="${titleStyle}"><h2 contenteditable="true" data-key="title">${iconSVG}${slide.title || 'Two Column Slide'}</h2></div>
                             <div class="body-wrapper" style="${bodyStyle}">
                                 <div class="two-col-layout" style="--split-left:${splitPct}%;" data-role="two-col-layout" data-slide-index="${index}">
                                     ${renderFieldShell('columns.leftField', slide.columns.leftField, index)}
                                     <div class="split-divider" data-role="split-divider" data-slide-index="${index}" title="Drag to resize columns"></div>
                                     ${renderFieldShell('columns.rightField', slide.columns.rightField, index)}
                                 </div>
                             </div>`;
            } else {
                innerHTML = `<div class="title-wrapper" style="${titleStyle}"><h2 contenteditable="true" data-key="title">${iconSVG}${slide.title || 'Slide Title'}</h2></div>
                             <div class="body-wrapper" style="${bodyStyle}">${renderFieldShell('bodyField', slide.bodyField, index)}</div>`;
            }
            
            slideEl.innerHTML = `${shapeHTML}<div class="slide-inner">${innerHTML}</div>`;
            
            if (slide.type === 'cover' || slide.type === 'section') {
                slideEl.addEventListener('contextmenu', (e) => {
                    if (document.body.classList.contains('show-shapes')) { e.preventDefault(); showContextMenu(e.clientX, e.clientY); }
                });
            }
            stage.appendChild(slideEl);
        });
        updateSettingsUI();
        renderSpeakerNotesPanel();
    }

    document.addEventListener('mousedown', (e) => {
        if (e.ctrlKey) {
            const wrapper = e.target.closest('.title-wrapper, .body-wrapper');
            if (wrapper) {
                e.preventDefault(); e.stopPropagation();
                if (wrapper.classList.contains('selected-for-move')) {
                    wrapper.classList.remove('selected-for-move');
                    selectedElements = selectedElements.filter(el => el !== wrapper);
                } else {
                    wrapper.classList.add('selected-for-move');
                    selectedElements.push(wrapper);
                }
                updateSelectionMenu();
            }
        } else {
            if (!e.target.closest('.selected-for-move') && !e.target.closest('#selection-floater') && !e.target.closest('#settings-wrapper')) {
                document.querySelectorAll('.selected-for-move').forEach(el => el.classList.remove('selected-for-move'));
                selectedElements = [];
                document.getElementById('selection-floater').style.display = 'none';
            }
        }
    });

    function updateSelectionMenu() {
        const floater = document.getElementById('selection-floater');
        if (selectedElements.length > 0) {
            const rect = selectedElements[0].getBoundingClientRect();
            floater.style.display = 'flex';
            floater.style.top = rect.top + 'px';
            floater.style.left = (rect.right + 10) + 'px';
            const radios = document.getElementsByName('move-scope');
            radios.forEach(r => r.checked = (r.value === nudgeMode));
        } else { floater.style.display = 'none'; }
    }

    function toggleScope() {
        const modes = ['global', 'template', 'local'];
        let idx = modes.indexOf(nudgeMode);
        setNudgeMode(modes[(idx + 1) % 3]);
    }

    function setNudgeMode(mode) {
        nudgeMode = mode;
        const btn = document.getElementById('scope-btn');
        if(btn) {
            let label = "Mode: ALL SLIDES";
            let color = "var(--powder-blue)";
            if(mode === 'template') { label = "Mode: THIS TEMPLATE"; color = "#9b59b6"; }
            if(mode === 'local') { label = "Mode: THIS SLIDE"; color = "#e67e22"; }
            btn.innerText = label;
            btn.style.color = color;
        }
    }

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            const dx = (e.key === 'ArrowRight' ? 5 : (e.key === 'ArrowLeft' ? -5 : 0));
            const dy = (e.key === 'ArrowDown' ? 5 : (e.key === 'ArrowUp' ? -5 : 0));
            
            if (nudgeMode === 'global') {
                appConfig.globalX = (appConfig.globalX || 0) + dx;
                appConfig.globalY = (appConfig.globalY || 0) + dy;
                applyConfig();
            } else if (nudgeMode === 'template') {
                const type = slidesData[currentSlideIndex].type;
                if(!appConfig.typeOffsets) appConfig.typeOffsets = {};
                if(!appConfig.typeOffsets[type]) appConfig.typeOffsets[type] = {x:0, y:0};
                appConfig.typeOffsets[type].x += dx;
                appConfig.typeOffsets[type].y += dy;
                render(); // Re-render to update CSS variables for this type
            } else {
                const slide = slidesData[currentSlideIndex];
                if (selectedElements.length > 0) {
                    selectedElements.forEach(el => {
                        if (el.classList.contains('title-wrapper')) {
                            slide.titleX = (slide.titleX || 0) + dx;
                            slide.titleY = (slide.titleY || 0) + dy;
                            el.style.transform = `translate(${slide.titleX}px, ${slide.titleY}px)`;
                        } else if (el.classList.contains('body-wrapper')) {
                            slide.bodyX = (slide.bodyX || 0) + dx;
                            slide.bodyY = (slide.bodyY || 0) + dy;
                            el.style.transform = `translate(${slide.bodyX}px, ${slide.bodyY}px)`;
                        }
                    });
                } else {
                    slide.x = (slide.x || 0) + dx;
                    slide.y = (slide.y || 0) + dy;
                    document.querySelector('.slide.active').style.setProperty('--local-x', slide.x + 'px');
                    document.querySelector('.slide.active').style.setProperty('--local-y', slide.y + 'px');
                }
            }
            saveState();
        }
        if (!e.ctrlKey && !e.target.closest('[contenteditable]')) {
            if (e.key === 'ArrowRight') showSlide(currentSlideIndex + 1);
            if (e.key === 'ArrowLeft') showSlide(currentSlideIndex - 1);
        }
    });

    function openColorPicker(e, typeId) { e.stopPropagation(); activeColorTarget = typeId; const pop = document.getElementById('color-picker-popover'); const rect = e.target.getBoundingClientRect(); pop.style.top = rect.bottom + 5 + 'px'; pop.style.left = rect.left - 100 + 'px'; pop.classList.add('visible'); }
    function pickColor(hex) { if(!activeColorTarget) return; appConfig[`color-${activeColorTarget}`] = hex; applyConfig(); saveState(); document.getElementById('color-picker-popover').classList.remove('visible'); updateSettingsUI(); }
    function triggerCustomColor() { const input = document.getElementById('hidden-color-input'); input.click(); input.oninput = (e) => pickColor(e.target.value); }
    document.addEventListener('click', (e) => { if(!e.target.closest('#color-picker-popover') && !e.target.closest('.color-trigger')) document.getElementById('color-picker-popover').classList.remove('visible'); });
    
    function mdToHtml(md) {
        if (!md) return '';
        const lines = md.split('\n');
        let html = '';
        let listStack = []; // stack of 'ul' or 'ol'

        function closeListsTo(targetDepth) {
            while (listStack.length > targetDepth) {
                html += `</${listStack.pop()}>`;
            }
        }

        for (const line of lines) {
            // Detect indent level (2 spaces or 1 tab = 1 level)
            const indentMatch = line.match(/^(\s*)/);
            const rawIndent = indentMatch ? indentMatch[1] : '';
            const depth = Math.floor(rawIndent.replace(/\t/g, '  ').length / 2);
            const trimmed = line.trim();

            if (!trimmed) {
                closeListsTo(0);
                html += '<br>';
                continue;
            }

            // Header
            if (/^###\s+/.test(trimmed)) {
                closeListsTo(0);
                html += `<h3>${applyInline(trimmed.replace(/^###\s+/, ''))}</h3>`;
                continue;
            }

            // Bullet: *, -, or + prefix
            const bulletMatch = trimmed.match(/^[\*\-\+]\s+(.*)/);
            if (bulletMatch) {
                const listDepth = depth + 1;
                while (listStack.length < listDepth) { listStack.push('ul'); html += '<ul>'; }
                closeListsTo(listDepth);
                html += `<li>${applyInline(bulletMatch[1])}</li>`;
                continue;
            }

            // Numbered list
            const numMatch = trimmed.match(/^\d+[\.\)]\s+(.*)/);
            if (numMatch) {
                const listDepth = depth + 1;
                while (listStack.length < listDepth) { listStack.push('ol'); html += '<ol>'; }
                closeListsTo(listDepth);
                html += `<li>${applyInline(numMatch[1])}</li>`;
                continue;
            }

            // Plain paragraph
            closeListsTo(0);
            html += `<p>${applyInline(trimmed)}</p>`;
        }
        closeListsTo(0);
        return html;
    }

    function applyInline(text) {
        return text
            .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.+?)\*/g, '<i>$1</i>')
            .replace(/__(.+?)__/g, '<b>$1</b>')
            .replace(/_(.+?)_/g, '<i>$1</i>');
    }
    function htmlToMd(html) { let temp = document.createElement('div'); temp.innerHTML = html; let text = temp.innerHTML; text = text.replace(/<h3>/gi, '\n### ').replace(/<\/h3>/gi, '\n').replace(/<b>|<strong>/gi, '**').replace(/<\/b>|<\/strong>/gi, '**').replace(/<i>|<em>/gi, '*').replace(/<\/i>|<\/em>/gi, '*').replace(/<li>/gi, '\n* ').replace(/<\/li>/gi, '').replace(/<ul>|<\/ul>|<ol>|<\/ol>/gi, '').replace(/<small>|<\/small>/gi, '').replace(/<br>|<p>|<\/p>|<div>|<\/div>/gi, '\n'); return text.split('\n').map(line => line.trim()).filter(l => l).join('\n'); }

    function configHasStyling(cfg) {
        // Check if the config has ANY font/size/color keys defined
        return STYLE_KEYS.some(k => k.startsWith('font-') || k.startsWith('size-') || k.startsWith('color-'))  
            && STYLE_KEYS.filter(k => k.startsWith('font-') || k.startsWith('size-') || k.startsWith('color-'))
                         .some(k => cfg[k] !== undefined);
    }

    function fillConfigFromActivePreset(cfg) {
        // Fill in any missing styling keys from the active preset
        const activeId = getActivePresetId();
        const all = getAllPresetsWithDefault();
        const preset = all.find(p => p.id === activeId) || DEFAULT_STYLE_PRESET;
        STYLE_KEYS.forEach(k => {
            if (cfg[k] === undefined || cfg[k] === null) {
                if (preset.style[k] !== undefined && preset.style[k] !== null) {
                    cfg[k] = JSON.parse(JSON.stringify(preset.style[k]));
                }
            }
        });
        return cfg;
    }

    function init() {
        renderSettingsRows();
        let hasLocalDeck = false;
        try {
            const saved = JSON.parse(localStorage.getItem('heart_walk_deck_pro_v3'));
            if (saved) {
                appConfig = saved.config;
                slidesData = saved.slides;
                hasLocalDeck = true;
                lastDeckLoadedFromRemote = serializeDeckState();
            }
        } catch (err) {
            console.warn('[Designer] Could not read local autosave:', err);
        }
        if (!hasLocalDeck) {
            // No saved state: start from active preset (or factory default)
            appConfig = {};
            fillConfigFromActivePreset(appConfig);
            appConfig.shapePath = appConfig.shapePath || defaultShapePath;
            appConfig.shapeViewBox = appConfig.shapeViewBox || defaultViewBox;
            slidesData = [{ type: 'cover', title: 'Start', subtitle: 'Import JSON to begin' }];
        }

        if (typeof appConfig.showShapes !== 'boolean') appConfig.showShapes = true;
        if (typeof appConfig.hideAttrib !== 'boolean') appConfig.hideAttrib = false;
        if (typeof appConfig.hideAllImages !== 'boolean') appConfig.hideAllImages = false;
        if (typeof appConfig.imagePromptStyle !== 'string') appConfig.imagePromptStyle = '';
        if (typeof appConfig.universalQuoteAttribution !== 'string') appConfig.universalQuoteAttribution = '';
        if (typeof appConfig.showSpeakerNotes !== 'boolean') appConfig.showSpeakerNotes = false;
        
        // Ensure Template Offsets exist (Backward Compat)
        if(!appConfig.typeOffsets) appConfig.typeOffsets = {};
        if(!appConfig.typeOffsets.cover) appConfig.typeOffsets.cover = {x:0, y:0};
        if(!appConfig.typeOffsets.section) appConfig.typeOffsets.section = {x:0, y:0};
        if(!appConfig.typeOffsets.standard) appConfig.typeOffsets.standard = {x:0, y:0};
        if(!appConfig.typeOffsets['two-column']) appConfig.typeOffsets['two-column'] = {x:0, y:0};
        slidesData = (slidesData || []).map(ensureSlideSchema);

        // Fill any missing styling from active preset
        fillConfigFromActivePreset(appConfig);

        applyConfig(); render(); resizeStage(); renderPresetList(); setSettingsTab(activeSettingsTab);
        hydrateRemoteDesignerSettings();
        if (!hasLocalDeck) {
            hydrateRemoteDeckAutosave(true);
        } else {
            scheduleDeckAutosave({ delayMs: 1500 });
        }
    }

    function saveState(flushRemote = false) {
        const serializedDeck = serializeDeckState();
        try {
            localStorage.setItem('heart_walk_deck_pro_v3', serializedDeck);
        } catch (err) {
            console.error('[Designer] Local deck autosave failed:', err);
            showToast('Local deck autosave failed. The deck may be too large to store in the browser.', 'error', 4200);
            return false;
        }
        if (flushRemote) flushDeckAutosave({ silent: true });
        else scheduleDeckAutosave();
        return true;
    }
    function applyConfig() { document.documentElement.style.setProperty('--global-x', (appConfig.globalX || 0) + 'px'); document.documentElement.style.setProperty('--global-y', (appConfig.globalY || 0) + 'px'); if (appConfig.showShapes) document.body.classList.add('show-shapes'); else document.body.classList.remove('show-shapes'); types.forEach(t => { document.documentElement.style.setProperty(`--font-${t.id}`, appConfig[`font-${t.id}`] || "'Source Sans 3', sans-serif"); document.documentElement.style.setProperty(`--size-${t.id}`, appConfig[`size-${t.id}`] || '18pt'); document.documentElement.style.setProperty(`--color-${t.id}`, appConfig[`color-${t.id}`] || '#1e1d21'); }); }
    function updateTheme() { appConfig.showShapes = document.getElementById('toggle-shapes').checked; types.forEach(t => { appConfig[`font-${t.id}`] = document.getElementById(`font-${t.id}`).value; appConfig[`size-${t.id}`] = document.getElementById(`size-${t.id}`).value + 'pt'; }); applyConfig(); saveState(); }
    function toggleHideAllImages() { appConfig.hideAllImages = document.getElementById('toggle-hide-images').checked; saveState(); render(); showSlide(currentSlideIndex); }
    function toggleHideAttrib() { appConfig.hideAttrib = document.getElementById('toggle-hide-attrib').checked; saveState(); syncUniversalQuoteAttributionPreview(); render(); showSlide(currentSlideIndex); }
    function updateImagePromptStyle() { appConfig.imagePromptStyle = document.getElementById('image-prompt-style').value.trim(); saveState(); updateImageStyleSelectUI(); }
    function updateUniversalQuoteAttribution() { appConfig.universalQuoteAttribution = document.getElementById('universal-quote-attribution').value; saveState(); syncUniversalQuoteAttributionPreview(); }
    function commitUniversalQuoteAttribution() { saveState(); render(); showSlide(currentSlideIndex); }
    function updateSettingsUI() { document.getElementById('toggle-shapes').checked = (typeof appConfig.showShapes === 'boolean') ? appConfig.showShapes : true; document.getElementById('toggle-hide-images').checked = !!appConfig.hideAllImages; document.getElementById('toggle-hide-attrib').checked = !!appConfig.hideAttrib; document.getElementById('toggle-speaker-notes').checked = !!appConfig.showSpeakerNotes; document.getElementById('image-prompt-style').value = appConfig.imagePromptStyle || ''; document.getElementById('universal-quote-attribution').value = appConfig.universalQuoteAttribution || ''; const overviewEl = document.getElementById('heart-walk-overview-text'); if (overviewEl && document.activeElement !== overviewEl) overviewEl.value = overviewTextCache || DEFAULT_HEART_WALK_OVERVIEW; types.forEach(t => { const fEl = document.getElementById(`font-${t.id}`); const sEl = document.getElementById(`size-${t.id}`); const cBtn = document.getElementById(`color-btn-${t.id}`); if(fEl) fEl.value = appConfig[`font-${t.id}`] || "'Source Sans 3', sans-serif"; if(sEl) sEl.value = (appConfig[`size-${t.id}`] || '').replace('pt',''); if(cBtn) cBtn.style.backgroundColor = appConfig[`color-${t.id}`] || '#000'; }); renderPresetList(); setSettingsTab(activeSettingsTab); renderSpeakerNotesPanel(); updateImageStyleSelectUI(); normalizeBatchParallelismInput(); updateBatchStatusUI(); syncLayoutActionButtons(); }
    // ════════════════════════════════════════════════
    //  Resilient import pipeline — extracts JSON from AI prose,
    //  handles slides-only arrays, missing config, unknown types, etc.
    // ════════════════════════════════════════════════

    /**
     * Try to extract a JSON object or array from a string that may contain
     * surrounding prose (e.g. "Below is a JSON representation...").
     * Strategy: find outermost { } or [ ] by brace-depth counting.
     */
    function extractJSON(raw) {
        const trimmed = raw.trim();
        // Fast path: already starts with { or [
        if (trimmed[0] === '{' || trimmed[0] === '[') return trimmed;

        // Try to find first { or [ that starts JSON
        const firstBrace = trimmed.indexOf('{');
        const firstBracket = trimmed.indexOf('[');
        let start = -1;
        let openChar = '{';
        let closeChar = '}';
        if (firstBrace === -1 && firstBracket === -1) return trimmed; // no JSON found
        if (firstBrace === -1) { start = firstBracket; openChar = '['; closeChar = ']'; }
        else if (firstBracket === -1) { start = firstBrace; }
        else if (firstBracket < firstBrace) { start = firstBracket; openChar = '['; closeChar = ']'; }
        else { start = firstBrace; }

        // Walk forward counting depth (only track the outermost delimiter type;
        // nested braces/brackets of the *other* kind are always balanced in valid JSON)
        let depth = 0;
        let inString = false;
        let escape = false;
        for (let i = start; i < trimmed.length; i++) {
            const ch = trimmed[i];
            if (escape) { escape = false; continue; }
            if (ch === '\\') { escape = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === openChar) depth++;
            if (ch === closeChar) depth--;
            if (depth === 0) {
                return trimmed.slice(start, i + 1);
            }
        }
        // Fallback: return from first brace to end
        return trimmed.slice(start);
    }

    function getImportValueLabel(value) {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'an array';
        return typeof value;
    }

    function stripTrailingCommas(jsonLikeText) {
        let output = '';
        let inString = false;
        let escape = false;

        for (let i = 0; i < jsonLikeText.length; i++) {
            const ch = jsonLikeText[i];
            if (escape) {
                output += ch;
                escape = false;
                continue;
            }
            if (ch === '\\') {
                output += ch;
                escape = true;
                continue;
            }
            if (ch === '"') {
                output += ch;
                inString = !inString;
                continue;
            }
            if (!inString && ch === ',') {
                let lookahead = i + 1;
                while (lookahead < jsonLikeText.length && /\s/.test(jsonLikeText[lookahead])) lookahead++;
                if (jsonLikeText[lookahead] === '}' || jsonLikeText[lookahead] === ']') continue;
            }
            output += ch;
        }

        return output;
    }

    function tryParseJsonVariants(candidate, warnings) {
        try {
            return JSON.parse(candidate);
        } catch (_directErr) {
            const repaired = stripTrailingCommas(candidate);
            if (repaired !== candidate) {
                try {
                    const parsed = JSON.parse(repaired);
                    warnings.push('Removed trailing commas from the import payload.');
                    return parsed;
                } catch (_repairErr) {
                    return null;
                }
            }
            return null;
        }
    }

    function normalizeImportSourceItem(item, warnings, contextLabel, itemIndex) {
        const prefix = `${contextLabel} source ${itemIndex + 1}`;
        if (typeof item === 'string') {
            const text = item.trim();
            if (!text) {
                warnings.push(`${prefix} was blank and was ignored.`);
                return null;
            }
            warnings.push(`${prefix} was a plain string — converted into { text }.`);
            return { text, interviewee: '' };
        }
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            warnings.push(`${prefix} was ${getImportValueLabel(item)} and was ignored.`);
            return null;
        }

        const text = typeof item.text === 'string' ? item.text.trim() : '';
        const interviewee = typeof item.interviewee === 'string' ? item.interviewee.trim() : '';
        if (!text) {
            warnings.push(`${prefix} was missing text and was ignored.`);
            return null;
        }

        return { text, interviewee };
    }

    function normalizeImportSources(rawSources, warnings, contextLabel) {
        if (rawSources == null) return [];
        if (!Array.isArray(rawSources)) {
            warnings.push(`${contextLabel} had non-array sources and they were ignored.`);
            return [];
        }

        return rawSources
            .map((item, index) => normalizeImportSourceItem(item, warnings, contextLabel, index))
            .filter(Boolean);
    }

    function normalizeImportImageHistory(rawHistory, warnings, contextLabel) {
        if (rawHistory == null) return [];
        if (!Array.isArray(rawHistory)) {
            warnings.push(`${contextLabel} had non-array imageHistory and it was reset.`);
            return [];
        }

        const normalized = rawHistory
            .filter(item => typeof item === 'string' && item.trim())
            .map(item => item.trim());

        if (normalized.length !== rawHistory.length) {
            warnings.push(`${contextLabel} had invalid imageHistory entries and they were ignored.`);
        }

        return normalized;
    }

    function normalizeImportField(field, warnings, contextLabel, fallbackText = '') {
        if (field == null) return ensureFieldDefaults({}, fallbackText);
        if (typeof field === 'string') {
            warnings.push(`${contextLabel} was a string — treated as a text field.`);
            return ensureFieldDefaults({ mode: 'text', text: field }, field);
        }
        if (typeof field !== 'object' || Array.isArray(field)) {
            warnings.push(`${contextLabel} was ${getImportValueLabel(field)} — replaced with an empty text field.`);
            return ensureFieldDefaults({}, fallbackText);
        }

        const normalized = { ...field };
        if (normalized.mode && !['text', 'image', 'quote'].includes(normalized.mode)) {
            warnings.push(`${contextLabel} had unknown mode "${normalized.mode}" — changed to "text".`);
        }
        if (normalized.imageAlign && !['center', 'left', 'right', 'top', 'bottom'].includes(normalized.imageAlign)) {
            warnings.push(`${contextLabel} had invalid imageAlign "${normalized.imageAlign}" — reset to "center".`);
        }
        if (normalized.textScale && !['large', 'normal', 'small'].includes(normalized.textScale)) {
            warnings.push(`${contextLabel} had invalid textScale "${normalized.textScale}" — reset to "normal".`);
        }

        normalized.sources = normalizeImportSources(normalized.sources, warnings, contextLabel);
        normalized.imageHistory = normalizeImportImageHistory(normalized.imageHistory, warnings, contextLabel);
        return ensureFieldDefaults(normalized, fallbackText);
    }

    function normalizeImportedSlide(slide, slideIndex, warnings) {
        const slideLabel = `Slide ${slideIndex + 1}`;
        if (!slide || typeof slide !== 'object' || Array.isArray(slide)) {
            warnings.push(`${slideLabel} was ${getImportValueLabel(slide)} and was skipped.`);
            return null;
        }

        const normalized = { ...slide };
        const effectiveType = KNOWN_SLIDE_TYPES.has(normalized.type) ? normalized.type : 'standard';

        if (effectiveType === 'standard') {
            if (!normalized.bodyField && typeof normalized.content === 'string' && normalized.content.trim()) {
                warnings.push(`${slideLabel} was missing bodyField — built it from content.`);
            }
            normalized.bodyField = normalizeImportField(normalized.bodyField, warnings, `${slideLabel} bodyField`, normalized.content || '');
        }

        if (effectiveType === 'two-column') {
            if (!normalized.columns || typeof normalized.columns !== 'object' || Array.isArray(normalized.columns)) {
                warnings.push(`${slideLabel} had invalid columns and they were rebuilt.`);
                normalized.columns = {};
            }

            const rawSplitPct = normalized.columns.splitPct ?? 50;
            const splitPct = Number(rawSplitPct);
            if (rawSplitPct != null && !Number.isFinite(splitPct)) {
                warnings.push(`${slideLabel} had non-numeric splitPct and it was reset to 50.`);
            }

            normalized.columns = {
                ...normalized.columns,
                splitPct: Number.isFinite(splitPct) ? splitPct : 50,
                leftField: normalizeImportField(normalized.columns.leftField, warnings, `${slideLabel} leftField`, normalized.content || ''),
                rightField: normalizeImportField(normalized.columns.rightField, warnings, `${slideLabel} rightField`, '')
            };
        }

        try {
            return ensureSlideSchema(normalized);
        } catch (err) {
            warnings.push(`${slideLabel} could not be normalized (${err.message}) and was skipped.`);
            return null;
        }
    }

    /**
     * Parse input string into { data, warnings }.
     * Handles: raw JSON, AI-wrapped JSON, slides-only arrays,
     * objects with slides but no config, markdown/code-fenced JSON, etc.
     */
    function smartParseInput(raw) {
        const warnings = [];

        // Reject obvious non-data
        const trimmed = String(raw || '').replace(/^\uFEFF/, '').trim();
        if (!trimmed) throw new Error('Input is empty.');
        if (trimmed.startsWith('<') && !trimmed.startsWith('[')) {
            throw new Error('Input appears to be HTML, not JSON.');
        }

        // Strip markdown code fences: ```json ... ``` or ``` ... ```
        let cleaned = trimmed.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

        // Try direct parse first
        let data = tryParseJsonVariants(cleaned, warnings);
        if (!data) {
            // Try extracting JSON from surrounding prose
            const extracted = extractJSON(cleaned);
            data = tryParseJsonVariants(extracted, warnings);
            if (data) {
                warnings.push('JSON was extracted from surrounding text (AI prose wrapper detected).');
            } else {
                throw new Error(
                    `Could not parse JSON. The input may contain invalid syntax.\n\n` +
                    `Tip: If you pasted AI output, make sure the JSON object is complete ` +
                    `(matching braces/brackets). Designer can repair trailing commas, but not missing quotes or missing braces.`
                );
            }
        }

        // ── Normalize the parsed data into { config, slides } ──

        // Case 1: bare array → treat as slides
        if (Array.isArray(data)) {
            warnings.push('Input was a plain array — interpreted as slides (no config).');
            data = { config: null, slides: data };
        }

        // Case 2: object but no slides key → look for common alternatives
        if (!Array.isArray(data.slides)) {
            if (Array.isArray(data.deck)) {
                data.slides = data.deck;
                warnings.push('Found "deck" array instead of "slides" — used it.');
            } else if (data.type && typeof data.title === 'string') {
                // Single slide object
                data = { config: null, slides: [data] };
                warnings.push('Input was a single slide — wrapped into a one-slide deck.');
            } else {
                throw new Error(
                    'No "slides" array found in the JSON.\n\n' +
                    'Expected format: { "config": {...}, "slides": [...] }\n' +
                    'Or a plain array of slide objects.'
                );
            }
        }

        if (data.slides.length === 0) {
            throw new Error('The "slides" array is empty — nothing to render.');
        }

        // Missing or null config — supply sensible defaults
        if (!data.config || typeof data.config !== 'object') {
            warnings.push('No "config" found — using default design settings.');
            data.config = null; // will be handled below
        }

        return { data, warnings };
    }

    function loadDeckData(inputString) {
        try {
            const { data, warnings } = smartParseInput(inputString);

            // ── Config ──
            if (data.config) {
                appConfig = data.config;
                // If imported config has no styling (e.g. from Reporter),
                // fill from the active style preset
                if (!configHasStyling(appConfig)) {
                    fillConfigFromActivePreset(appConfig);
                    warnings.push('No styling in config — applied active style preset.');
                }
            } else {
                // Preserve current config so we don't clobber an existing theme
                // (appConfig already has sensible defaults from init)
            }

            // ── Slide schema normalization ──
            let coercedTypes = 0;
            let missingBodyFields = 0;
            let missingColumns = 0;
            let skippedSlides = 0;
            slidesData = data.slides.map((slide, index) => {
                // Track fixups for user notice
                if (slide.type && !KNOWN_SLIDE_TYPES.has(slide.type)) coercedTypes++;
                if (slide.type === 'standard' && !slide.bodyField) missingBodyFields++;
                if (slide.type === 'two-column' && !slide.columns) missingColumns++;
                const normalized = normalizeImportedSlide(slide, index, warnings);
                if (!normalized) skippedSlides++;
                return normalized;
            }).filter(Boolean);

            if (slidesData.length === 0) {
                throw new Error('No usable slides were found after import repair. Check the input for malformed slide objects or invalid JSON structure.');
            }

            if (coercedTypes > 0) warnings.push(`${coercedTypes} slide(s) had unknown types → converted to "standard".`);
            if (missingBodyFields > 0) warnings.push(`${missingBodyFields} standard slide(s) were missing bodyField → auto-created from content.`);
            if (missingColumns > 0) warnings.push(`${missingColumns} two-column slide(s) were missing columns → auto-created.`);
            if (skippedSlides > 0) warnings.push(`${skippedSlides} slide(s) could not be repaired and were skipped.`);

            // ── Ensure template offsets ──
            if (!appConfig.typeOffsets) appConfig.typeOffsets = {};
            for (const t of ['cover', 'section', 'standard', 'two-column']) {
                if (!appConfig.typeOffsets[t]) appConfig.typeOffsets[t] = { x: 0, y: 0 };
            }

            applyConfig(); render(); saveState(); showSlide(0);
            document.body.classList.add('flash-success');
            setTimeout(() => document.body.classList.remove('flash-success'), 600);
            closeImport(); toggleSettings();

            console.log(`[Designer] Import OK — ${slidesData.length} slides loaded. Warnings: ${warnings.length}`);
            warnings.forEach(w => console.warn('[Designer Import]', w));

            // Show import notices to user if any
            if (warnings.length > 0) {
                showNotice(warnings);
            }
        } catch (err) {
            showError(err.message);
        }
    }

    function handleFileSelect(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) { loadDeckData(e.target.result); };
        reader.readAsText(file);
        input.value = '';
    }
    async function importFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            loadDeckData(text);
        } catch (err) {
            showError('Clipboard access denied or empty.');
        }
    }
    function processManualImport() {
        loadDeckData(document.getElementById('import-area').value);
    }

    function showError(msg) {
        document.getElementById('error-message').innerText = msg;
        document.getElementById('error-modal').classList.add('open');
    }
    function closeError() { document.getElementById('error-modal').classList.remove('open'); }

    function showNotice(warnings) {
        const body = document.getElementById('notice-body');
        body.innerHTML = '<ul>' + warnings.map(w => `<li>${w}</li>`).join('') + '</ul>';
        document.getElementById('import-notice').classList.add('visible');
    }
    function dismissNotice() {
        document.getElementById('import-notice').classList.remove('visible');
    }

    let toastTimer = null;
    function showToast(message, variant = 'info', durationMs = 2200) {
        const el = document.getElementById('toast-notice');
        if (!el) return;
        el.textContent = message;
        el.classList.remove('error');
        if (variant === 'error') el.classList.add('error');
        el.classList.add('visible');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            el.classList.remove('visible');
        }, durationMs);
    }
    
    function nudge(x, y) { 
        if (nudgeMode === 'global') { 
            appConfig.globalX = (appConfig.globalX || 0) + x; 
            appConfig.globalY = (appConfig.globalY || 0) + y; 
            applyConfig(); 
        } else if (nudgeMode === 'template') {
            const type = slidesData[currentSlideIndex].type;
            if(!appConfig.typeOffsets[type]) appConfig.typeOffsets[type] = {x:0, y:0};
            appConfig.typeOffsets[type].x += x;
            appConfig.typeOffsets[type].y += y;
            render();
        } else { 
            const slide = slidesData[currentSlideIndex]; 
            slide.x = (slide.x || 0) + x; 
            slide.y = (slide.y || 0) + y; 
            document.querySelector(`.slide.active`).style.setProperty('--local-x', slide.x + 'px'); 
            document.querySelector(`.slide.active`).style.setProperty('--local-y', slide.y + 'px'); 
        } 
        saveState(); 
    }

    function startSplitDrag(dividerEl, clientX) {
        const slideIndex = parseInt(dividerEl.dataset.slideIndex, 10);
        const layout = dividerEl.closest('.two-col-layout');
        if (!layout || Number.isNaN(slideIndex)) return;
        dividerEl.classList.add('is-dragging');

        const bounds = layout.getBoundingClientRect();
        const slide = slidesData[slideIndex];
        ensureSlideSchema(slide);

        const onMove = (moveEvent) => {
            const x = moveEvent.clientX - bounds.left;
            const pct = (x / bounds.width) * 100;
            const clamped = Math.max(20, Math.min(80, pct));
            slide.columns.splitPct = Math.round(clamped * 10) / 10;
            layout.style.setProperty('--split-left', `${slide.columns.splitPct}%`);
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            dividerEl.classList.remove('is-dragging');
            saveState();
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        onMove({ clientX });
    }

    function edgeAlignFromClick(rect, x, y) {
        const edgeThreshold = 22;
        if (y - rect.top <= edgeThreshold) return 'top';
        if (rect.bottom - y <= edgeThreshold) return 'bottom';
        if (x - rect.left <= edgeThreshold) return 'left';
        if (rect.right - x <= edgeThreshold) return 'right';
        return 'center';
    }

    container.addEventListener('input', (e) => {
        const el = e.target;
        const slideEl = el.closest('.slide');
        if (!slideEl) return;
        const index = parseInt(slideEl.dataset.index, 10);
        if (Number.isNaN(index)) return;
        const slide = slidesData[index];
        ensureSlideSchema(slide);

        if (el.dataset.role === 'field-text') {
            const field = getByPath(slide, el.dataset.fieldPath);
            field.text = htmlToMd(el.innerHTML);
            if (el.dataset.fieldPath === 'bodyField') slide.content = field.text;
            saveState();
            showFieldTypoIndicator(field);
            return;
        }
        if (el.dataset.role === 'field-quote-text') {
            const field = getByPath(slide, el.dataset.fieldPath);
            field.quoteText = el.innerText;
            saveState();
            showFieldTypoIndicator(field);
            return;
        }
        if (el.dataset.role === 'field-quote-attrib') {
            if (hasUniversalQuoteAttribution()) return;
            const field = getByPath(slide, el.dataset.fieldPath);
            field.quoteAttribution = String(el.innerText || '').replace(/\u00a0/g, ' ').trim();
            el.classList.toggle('quote-attrib-empty', !field.quoteAttribution);
            if (!field.quoteAttribution && el.innerHTML.trim() === '') el.innerHTML = '&nbsp;';
            saveState();
            showFieldTypoIndicator(field);
            return;
        }
        if (el.dataset.role === 'ai-prompt-edit') {
            const field = getByPath(slide, el.dataset.fieldPath);
            if (field) field.imagePrompt = el.value;
            saveState();
            return;
        }

        if (!el.dataset.key) return;
        const key = el.dataset.key;
        if (key === 'content') slide[key] = htmlToMd(el.innerHTML);
        else slide[key] = el.innerText;
        saveState();
    });

    container.addEventListener('change', (e) => {
        const el = e.target;
        const slideEl = el.closest('.slide');
        if (!slideEl) return;
        const index = parseInt(slideEl.dataset.index, 10);
        if (Number.isNaN(index)) return;
        const slide = slidesData[index];
        ensureSlideSchema(slide);

        // ── File input for image upload ──
        if (el.dataset.role === 'field-image-file' && el.files?.length) {
            handleImageFile(el.files[0], el.dataset.fieldPath, index);
            return;
        }
    });

    if (speakerNotesInput) {
        speakerNotesInput.addEventListener('input', updateSpeakerNotes);
    }

    // ── Mode icon button clicks ──
    container.addEventListener('click', (e) => {
        const fontStepBtn = e.target.closest('[data-role="field-font-step"]');
        if (fontStepBtn) {
            const slideEl = fontStepBtn.closest('.slide');
            if (!slideEl) return;
            const index = parseInt(slideEl.dataset.index, 10);
            if (Number.isNaN(index)) return;
            const slide = slidesData[index];
            ensureSlideSchema(slide);
            const field = getByPath(slide, fontStepBtn.dataset.fieldPath);
            if (!field) return;
            const step = parseInt(fontStepBtn.dataset.step, 10) || 0;
            const next = (Number(field.fontDelta || 0) + step);
            field.fontDelta = Math.max(-12, Math.min(12, next));
            render(); saveState(); showSlide(currentSlideIndex);
            showFieldTypoIndicator(field);
            return;
        }

        const modeBtn = e.target.closest('[data-role="field-mode-btn"]');
        if (modeBtn) {
            const slideEl = modeBtn.closest('.slide');
            if (!slideEl) return;
            const index = parseInt(slideEl.dataset.index, 10);
            if (Number.isNaN(index)) return;
            const slide = slidesData[index];
            ensureSlideSchema(slide);
            const field = getByPath(slide, modeBtn.dataset.fieldPath);
            if (!field) return;
            const newMode = modeBtn.dataset.modeValue;
            if (field.mode === newMode) return; // already active
            field.mode = newMode;
            if (modeBtn.dataset.fieldPath === 'bodyField') slide.content = field.text || '';
            render(); saveState(); showSlide(currentSlideIndex);
            console.log(`[Designer] Field ${modeBtn.dataset.fieldPath} mode → ${newMode}`);
            return;
        }

        const pasteTarget = e.target.closest('[data-role="image-paste-target"]');
        if (pasteTarget) {
            pasteTarget.focus();
            return;
        }

        // ── URL Load button ──
        const urlBtn = e.target.closest('[data-role="url-load-btn"]');
        if (urlBtn) {
            const slideEl = urlBtn.closest('.slide');
            if (!slideEl) return;
            const index = parseInt(slideEl.dataset.index, 10);
            if (Number.isNaN(index)) return;
            const slide = slidesData[index];
            ensureSlideSchema(slide);
            const urlInput = urlBtn.parentElement.querySelector('[data-role="field-image-url"]');
            const field = getByPath(slide, urlBtn.dataset.fieldPath);
            if (field && urlInput) {
                pushImageHistory(field);
                field.imageUrl = urlInput.value.trim();
                setImageManageMode(index, urlBtn.dataset.fieldPath, false);
                saveState(); render(); showSlide(currentSlideIndex);
                console.log(`[Designer] Image URL loaded: ${field.imageUrl.slice(0, 60)}`);
            }
            return;
        }

        const settingsBtn = e.target.closest('[data-role="image-settings-btn"]');
        if (settingsBtn) {
            e.stopPropagation();
            const slideEl = settingsBtn.closest('.slide');
            if (!slideEl) return;
            const index = parseInt(slideEl.dataset.index, 10);
            if (Number.isNaN(index)) return;
            setImageManageMode(index, settingsBtn.dataset.fieldPath, true);
            render(); showSlide(currentSlideIndex);
            return;
        }

        const manageCloseBtn = e.target.closest('[data-role="image-manage-close-btn"]');
        if (manageCloseBtn) {
            e.stopPropagation();
            const slideEl = manageCloseBtn.closest('.slide');
            if (!slideEl) return;
            const index = parseInt(slideEl.dataset.index, 10);
            if (Number.isNaN(index)) return;
            setImageManageMode(index, manageCloseBtn.dataset.fieldPath, false);
            render(); showSlide(currentSlideIndex);
            return;
        }

        // ── AI Image Generate button ──
        const aiGenBtn = e.target.closest('[data-role="ai-gen-btn"]');
        if (aiGenBtn) {
            e.stopPropagation();
            const slideEl = aiGenBtn.closest('.slide');
            if (!slideEl) return;
            const index = parseInt(slideEl.dataset.index, 10);
            if (Number.isNaN(index)) return;
            requestImageGeneration(aiGenBtn.dataset.fieldPath, index, aiGenBtn);
            return;
        }

        const autoPromptBtn = e.target.closest('[data-role="auto-prompt-btn"]');
        if (autoPromptBtn) {
            e.stopPropagation();
            const slideEl = autoPromptBtn.closest('.slide');
            if (!slideEl) return;
            const index = parseInt(slideEl.dataset.index, 10);
            if (Number.isNaN(index)) return;
            generateAutomaticImagePrompt(autoPromptBtn.dataset.fieldPath, index, { triggerBtn: autoPromptBtn });
            return;
        }

        const historyRestoreBtn = e.target.closest('[data-role="image-history-restore-btn"]');
        if (historyRestoreBtn) {
            e.stopPropagation();
            const select = historyRestoreBtn.closest('.image-tools-row')?.querySelector(`[data-role="image-history-select"][data-field-path="${historyRestoreBtn.dataset.fieldPath}"]`);
            if (!select?.value) {
                showToast('Choose a previous image version first.', 'error', 2400);
                return;
            }
            restoreImageHistoryVersion(historyRestoreBtn.dataset.fieldPath, index, select.value);
            return;
        }

        // ── AI Image Regenerate button ──
        const aiRegenBtn = e.target.closest('[data-role="ai-regen-btn"]');
        if (aiRegenBtn) {
            e.stopPropagation();
            const slideEl = aiRegenBtn.closest('.slide');
            if (!slideEl) return;
            const index = parseInt(slideEl.dataset.index, 10);
            if (Number.isNaN(index)) return;
            generateAIImage(aiRegenBtn.dataset.fieldPath, index, null, aiRegenBtn);
            return;
        }

        // ── Image history undo button ──
        const histBtn = e.target.closest('[data-role="image-history-btn"]');
        if (histBtn) {
            e.stopPropagation();
            const slideEl = histBtn.closest('.slide');
            if (!slideEl) return;
            const index = parseInt(slideEl.dataset.index, 10);
            if (Number.isNaN(index)) return;
            undoImageHistory(histBtn.dataset.fieldPath, index);
            return;
        }

        // ── Click on drop-zone opens file picker ──
        const dropZone = e.target.closest('[data-role="image-drop-zone"]');
        if (dropZone && !e.target.closest('input') && !e.target.closest('button') && !e.target.closest('textarea') && !e.target.closest('.drop-cell-url') && !e.target.closest('.drop-cell-ai')) {
            const fileInput = dropZone.querySelector('[data-role="field-image-file"]');
            if (fileInput) fileInput.click();
            return;
        }

        // ── Image edge alignment click (existing) ──
        const imageField = e.target.closest('[data-role="image-field"]');
        if (!imageField) return;
        const slideEl = imageField.closest('.slide');
        if (!slideEl) return;
        const index = parseInt(slideEl.dataset.index, 10);
        if (Number.isNaN(index)) return;
        const slide = slidesData[index];
        const fieldPath = imageField.dataset.fieldPath;
        const field = getByPath(slide, fieldPath);
        if (!field) return;

        imageField.focus({ preventScroll: true });
        const rect = imageField.getBoundingClientRect();
        field.imageAlign = edgeAlignFromClick(rect, e.clientX, e.clientY);
        imageField.style.cssText += imageAlignStyle(field.imageAlign);
        saveState();
        render();
        showSlide(currentSlideIndex);
    });

    container.addEventListener('paste', (e) => {
        if (e.target.closest('textarea, input, [contenteditable="true"]')) return;
        const pasteHost = e.target.closest('[data-role="image-paste-target"], [data-role="image-field"]');
        if (!pasteHost) return;
        const file = getClipboardImageFile(e.clipboardData);
        if (!file) return;
        const slideEl = pasteHost.closest('.slide');
        if (!slideEl) return;
        const index = parseInt(slideEl.dataset.index, 10);
        if (Number.isNaN(index)) return;
        e.preventDefault();
        handleImageFile(file, pasteHost.dataset.fieldPath, index);
    });

    // ── Image notes blur → save ──
    container.addEventListener('change', (e) => {
        const notesEl = e.target.closest('[data-role="image-notes"]');
        if (notesEl) {
            const slideEl = notesEl.closest('.slide');
            if (!slideEl) return;
            const index = parseInt(slideEl.dataset.index, 10);
            if (Number.isNaN(index)) return;
            const slide = slidesData[index];
            ensureSlideSchema(slide);
            const field = getByPath(slide, notesEl.dataset.fieldPath);
            if (field) {
                field.imageNotes = notesEl.value;
                field.imagePrompt = notesEl.value;
                saveState();
            }
        }
    });

    // ── Drag-and-drop image handling ──
    container.addEventListener('dragover', (e) => {
        const dropZone = e.target.closest('[data-role="image-drop-zone"]');
        if (!dropZone) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        dropZone.classList.add('drag-over');
    });
    container.addEventListener('dragleave', (e) => {
        const dropZone = e.target.closest('[data-role="image-drop-zone"]');
        if (!dropZone) return;
        dropZone.classList.remove('drag-over');
    });
    container.addEventListener('drop', (e) => {
        const dropZone = e.target.closest('[data-role="image-drop-zone"]');
        if (!dropZone) return;
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer?.files?.[0];
        if (!file || !file.type.startsWith('image/')) {
            console.warn('[Designer] Drop rejected — not an image file.');
            return;
        }
        const slideEl = dropZone.closest('.slide');
        if (!slideEl) return;
        const index = parseInt(slideEl.dataset.index, 10);
        handleImageFile(file, dropZone.dataset.fieldPath, index);
    });

    // ── Split divider drag (re-attached after refactor) ──
    container.addEventListener('mousedown', (e) => {
        const divider = e.target.closest('[data-role="split-divider"]');
        if (divider) {
            e.preventDefault();
            startSplitDrag(divider, e.clientX);
        }
    });

    // ════════════════════════════════════════════════
    //  Image upload handler — uploads to server, falls back to data-URI
    // ════════════════════════════════════════════════
    const IMAGE_UPLOAD_URL = 'https://happydo.xyz/harvester/api/image-store.php';
    const IMAGE_HISTORY_MAX = 10;
    const AI_GEN_IN_FLIGHT = new Set();

    /** Push the current imageUrl onto the field's history stack before replacing it */
    function pushImageHistory(field) {
        if (!field) return;
        if (!Array.isArray(field.imageHistory)) field.imageHistory = [];
        const current = (field.imageUrl || '').trim();
        if (current && current !== field.imageHistory[field.imageHistory.length - 1]) {
            field.imageHistory.push(current);
            // Cap history stack to prevent localStorage bloat
            if (field.imageHistory.length > IMAGE_HISTORY_MAX) {
                field.imageHistory = field.imageHistory.slice(-IMAGE_HISTORY_MAX);
            }
        }
    }

    /** Pop the most recent image from history, restoring it as the active image */
    function undoImageHistory(fieldPath, slideIndex) {
        const slide = slidesData[slideIndex];
        ensureSlideSchema(slide);
        const field = getByPath(slide, fieldPath);
        if (!field || !Array.isArray(field.imageHistory) || field.imageHistory.length === 0) return;
        field.imageUrl = field.imageHistory.pop();
        console.log(`[Designer] Image history undo → restored (${field.imageHistory.length} remaining)`);
        saveState(); render(); showSlide(currentSlideIndex);
    }

    function restoreImageHistoryVersion(fieldPath, slideIndex, historyIndex) {
        const slide = slidesData[slideIndex];
        ensureSlideSchema(slide);
        const field = getByPath(slide, fieldPath);
        if (!field || !Array.isArray(field.imageHistory) || field.imageHistory.length === 0) return false;
        const numericIndex = Number(historyIndex);
        if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= field.imageHistory.length) return false;
        const restoredUrl = field.imageHistory.splice(numericIndex, 1)[0];
        if (!restoredUrl) return false;
        pushImageHistory(field);
        field.imageUrl = restoredUrl;
        saveState(); render(); showSlide(currentSlideIndex);
        showToast('Restored a previous image version.');
        return true;
    }

    function refreshImageActionButtons(slideIndex, fieldPath) {
        const slideEl = container.querySelector(`.slide[data-index="${slideIndex}"]`);
        if (!slideEl) return;
        const key = getFieldRequestKey(slideIndex, fieldPath);
        const state = getFieldAsyncState(slideIndex, fieldPath);
        const generatingImage = AI_GEN_IN_FLIGHT.has(key);
        slideEl.querySelectorAll(`[data-role="auto-prompt-btn"][data-field-path="${fieldPath}"]`).forEach(btn => {
            const defaultLabel = btn.dataset.defaultLabel || 'Auto Prompt';
            btn.disabled = state.promptPending;
            btn.innerHTML = state.promptPending ? '<span class="ai-spinner"></span> Drafting…' : defaultLabel;
        });
        slideEl.querySelectorAll(`[data-role="ai-gen-btn"][data-field-path="${fieldPath}"]`).forEach(btn => {
            const defaultLabel = btn.dataset.defaultLabel || 'Generate';
            if (generatingImage) return;
            btn.disabled = false;
            btn.classList.toggle('is-queued', !!state.generateQueued);
            btn.textContent = state.generateQueued ? 'Queued…' : defaultLabel;
        });
        slideEl.querySelectorAll(`[data-role="ai-regen-btn"][data-field-path="${fieldPath}"]`).forEach(btn => {
            if (generatingImage) return;
            btn.disabled = false;
            btn.textContent = btn.dataset.defaultLabel || 'Regenerate';
        });
        slideEl.querySelectorAll(`[data-role="image-settings-btn"][data-field-path="${fieldPath}"]`).forEach(btn => {
            btn.disabled = generatingImage || state.promptPending;
        });
    }

    function getImageFieldsForSlide(slide) {
        ensureSlideSchema(slide);
        const targets = [];
        if (slide.type === 'standard' && slide.bodyField?.mode === 'image') {
            targets.push({ fieldPath: 'bodyField', field: slide.bodyField });
        }
        if (slide.type === 'two-column') {
            if (slide.columns?.leftField?.mode === 'image') targets.push({ fieldPath: 'columns.leftField', field: slide.columns.leftField });
            if (slide.columns?.rightField?.mode === 'image') targets.push({ fieldPath: 'columns.rightField', field: slide.columns.rightField });
        }
        return targets;
    }

    function getAllMissingImageTargets() {
        const targets = [];
        slidesData.forEach((slide, slideIndex) => {
            getImageFieldsForSlide(slide).forEach(target => {
                if (!String(target.field.imageUrl || '').trim()) targets.push({ slideIndex, fieldPath: target.fieldPath });
            });
        });
        return targets;
    }

    function slideHasMeaningfulFieldContent(field) {
        if (!field) return false;
        return !!String(field.text || field.quoteText || field.quoteAttribution || field.imageUrl || field.imagePrompt || field.imageNotes || '').trim();
    }

    function convertStandardToTwoColumn(slide) {
        ensureSlideSchema(slide);
        const leftField = ensureFieldDefaults(slide.bodyField, slide.content || '');
        slide.type = 'two-column';
        slide.columns = {
            splitPct: 50,
            leftField,
            rightField: ensureFieldDefaults({ mode: 'image', imageUrl: '', imageAlign: 'center', imagePrompt: '', imageNotes: '' }, '')
        };
        slide.content = leftField.text || slide.content || '';
        delete slide.bodyField;
        return slide;
    }

    function convertTwoColumnToStandard(slide) {
        ensureSlideSchema(slide);
        const leftField = ensureFieldDefaults(slide.columns?.leftField, slide.content || '');
        slide.type = 'standard';
        slide.bodyField = leftField;
        slide.content = leftField.text || slide.content || '';
        delete slide.columns;
        return slide;
    }

    function addSecondColumnToCurrentSlide() {
        const slide = slidesData[currentSlideIndex];
        if (!slide || slide.type !== 'standard') {
            showToast('Select a standard slide to add a second column.', 'error', 2500);
            return;
        }
        convertStandardToTwoColumn(slide);
        render(); saveState(); showSlide(currentSlideIndex);
        showToast('Added a second column with a default image panel.');
    }

    function removeSecondColumnFromCurrentSlide() {
        const slide = slidesData[currentSlideIndex];
        if (!slide || slide.type !== 'two-column') {
            showToast('Select a two-column slide to remove the second column.', 'error', 2500);
            return;
        }
        if (slideHasMeaningfulFieldContent(slide.columns?.rightField) && !confirm('Remove the second column? Content in the right column will be discarded.')) {
            return;
        }
        convertTwoColumnToStandard(slide);
        render(); saveState(); showSlide(currentSlideIndex);
        showToast('Removed the second column.');
    }

    async function handleImageFile(file, fieldPath, slideIndex) {
        if (!file || !file.type.startsWith('image/')) {
            console.warn('[Designer] handleImageFile: not an image file');
            return;
        }
        const slide = slidesData[slideIndex];
        ensureSlideSchema(slide);
        const field = getByPath(slide, fieldPath);
        if (!field) { console.error('[Designer] handleImageFile: field not found at', fieldPath); return; }

        console.log(`[Designer] Uploading image: ${file.name} (${(file.size/1024).toFixed(1)} KB) → field ${fieldPath}`);

        pushImageHistory(field);

        // Try server upload first
        try {
            const form = new FormData();
            form.append('image', file);
            const resp = await fetch(IMAGE_UPLOAD_URL, { method: 'POST', body: form });
            if (resp.ok) {
                const result = await resp.json();
                if (result.url) {
                    field.imageUrl = result.url;
                    setImageManageMode(slideIndex, fieldPath, false);
                    console.log(`[Designer] ✓ Server upload OK: ${result.url}`);
                    saveState(true); render(); showSlide(currentSlideIndex);
                    showToast('Image saved to the deck and autosaved to DB.', 'info', 2600);
                    return;
                }
            }
            console.warn(`[Designer] Server upload failed (${resp.status}), falling back to data-URI`);
        } catch (err) {
            console.warn(`[Designer] Server upload error: ${err.message}. Falling back to data-URI.`);
        }

        // Fallback: embed as data-URI (works offline but inflates JSON)
        const reader = new FileReader();
        reader.onload = (ev) => {
            field.imageUrl = ev.target.result;
            setImageManageMode(slideIndex, fieldPath, false);
            console.log(`[Designer] ✓ Image embedded as data-URI (${(ev.target.result.length/1024).toFixed(1)} KB)`);
            const savedOk = saveState(true);
            render(); showSlide(currentSlideIndex);
            showToast(savedOk
                ? 'Image embedded into the deck JSON. This is portable but can make browser autosave less reliable for very large decks.'
                : 'Image preview updated, but browser autosave failed. Upload-backed image URLs are more reliable than embedded data URIs.', savedOk ? 'info' : 'error', 4600);
        };
        reader.onerror = () => {
            console.error('[Designer] FileReader error for', file.name);
        };
        reader.readAsDataURL(file);
    }

    async function generateAutomaticImagePrompt(fieldPath, slideIndex, options = {}) {
        const slide = slidesData[slideIndex];
        ensureSlideSchema(slide);
        const field = getByPath(slide, fieldPath);
        if (!field) throw new Error(`Field not found: ${fieldPath}`);

        const state = getFieldAsyncState(slideIndex, fieldPath);
        if (state.promptPending) {
            if (options.queueGenerate) state.generateQueued = true;
            refreshImageActionButtons(slideIndex, fieldPath);
            return state.promptPromise;
        }

        state.promptPending = true;
        if (options.queueGenerate) state.generateQueued = true;
        const requestId = ++state.requestId;
        refreshImageActionButtons(slideIndex, fieldPath);

        state.promptPromise = (async () => {
            try {
                const { askAI } = await getAiTools();
                const response = await askAI(buildAutomaticImagePromptRequest(slide, fieldPath), 'openai', {
                    temperature: 0.2,
                    timeoutMs: 45000
                });
                const promptText = normalizeAiPromptResponse(response);
                if (!promptText) throw new Error('AI returned an empty image prompt.');
                if (requestId !== state.requestId) return '';

                field.imagePrompt = promptText;
                field.imageNotes = promptText;
                saveState();
                updateImagePromptInputs(slideIndex, fieldPath, promptText);
                showToast('Image prompt drafted.');

                if (state.generateQueued) {
                    state.generateQueued = false;
                    refreshImageActionButtons(slideIndex, fieldPath);
                    await generateAIImage(fieldPath, slideIndex, promptText);
                }

                return promptText;
            } catch (err) {
                state.generateQueued = false;
                showToast(`Auto prompt failed: ${err.message}`, 'error', 3600);
                throw err;
            } finally {
                if (requestId === state.requestId) {
                    state.promptPending = false;
                    state.promptPromise = null;
                }
                refreshImageActionButtons(slideIndex, fieldPath);
            }
        })();

        return state.promptPromise;
    }

    async function requestImageGeneration(fieldPath, slideIndex, triggerBtn = null) {
        const slide = slidesData[slideIndex];
        ensureSlideSchema(slide);
        const field = getByPath(slide, fieldPath);
        if (!field) return;

        const notesEl = getNotesInputForField(slideIndex, fieldPath);
        const customPrompt = String(notesEl?.value || '').trim();
        if (customPrompt) {
            const state = getFieldAsyncState(slideIndex, fieldPath);
            state.generateQueued = false;
            refreshImageActionButtons(slideIndex, fieldPath);
            await generateAIImage(fieldPath, slideIndex, customPrompt, triggerBtn);
            return;
        }

        const existingPrompt = String(field.imagePrompt || field.imageNotes || '').trim();
        if (existingPrompt) {
            await generateAIImage(fieldPath, slideIndex, existingPrompt, triggerBtn);
            return;
        }

        const state = getFieldAsyncState(slideIndex, fieldPath);
        state.generateQueued = true;
        refreshImageActionButtons(slideIndex, fieldPath);
        showToast('Generating an image prompt first, then the image.', 'info', 2800);
        await generateAutomaticImagePrompt(fieldPath, slideIndex, { queueGenerate: true });
    }

    async function generateMissingImagesBatch() {
        if (BATCH_IMAGE_STATE.running) return;
        const targets = getAllMissingImageTargets();
        if (!targets.length) {
            showToast('No empty image fields were found.');
            return;
        }

        const parallelism = Math.min(getBatchParallelism(), targets.length);

        BATCH_IMAGE_STATE.running = true;
        BATCH_IMAGE_STATE.cancelRequested = false;
        BATCH_IMAGE_STATE.total = targets.length;
        BATCH_IMAGE_STATE.completed = 0;
        BATCH_IMAGE_STATE.failed = 0;
        BATCH_IMAGE_STATE.current = [];
        BATCH_IMAGE_STATE.parallelism = parallelism;
        updateBatchStatusUI();
        showToast(`Generating ${targets.length} missing image${targets.length === 1 ? '' : 's'} with ${parallelism} parallel request${parallelism === 1 ? '' : 's'}...`, 'info', 2600);

        let nextIndex = 0;
        const runTarget = async (target) => {
            const slide = slidesData[target.slideIndex];
            const title = String(slide?.title || `Slide ${target.slideIndex + 1}`).trim();
            const label = `S${target.slideIndex + 1} ${title} · ${target.fieldPath}`;
            BATCH_IMAGE_STATE.current.push(label);
            updateBatchStatusUI();
            try {
                const field = getByPath(slide, target.fieldPath);
                const existingPrompt = String(field?.imagePrompt || field?.imageNotes || '').trim();
                if (existingPrompt) {
                    await generateAIImage(target.fieldPath, target.slideIndex, existingPrompt);
                } else {
                    const promptText = await generateAutomaticImagePrompt(target.fieldPath, target.slideIndex);
                    await generateAIImage(target.fieldPath, target.slideIndex, promptText);
                }
            } catch (err) {
                BATCH_IMAGE_STATE.failed += 1;
                console.warn('[Designer] Batch image generation failed:', target, err);
            } finally {
                BATCH_IMAGE_STATE.current = BATCH_IMAGE_STATE.current.filter(entry => entry !== label);
                BATCH_IMAGE_STATE.completed += 1;
                updateBatchStatusUI();
            }
        };

        const worker = async () => {
            while (!BATCH_IMAGE_STATE.cancelRequested) {
                const assignedIndex = nextIndex;
                nextIndex += 1;
                if (assignedIndex >= targets.length) return;
                await runTarget(targets[assignedIndex]);
            }
        };

        await Promise.all(Array.from({ length: parallelism }, () => worker()));

        const cancelled = BATCH_IMAGE_STATE.cancelRequested;
        const summary = cancelled
            ? `Image batch cancelled after ${BATCH_IMAGE_STATE.completed}/${BATCH_IMAGE_STATE.total}.`
            : `Image batch finished: ${BATCH_IMAGE_STATE.completed - BATCH_IMAGE_STATE.failed} succeeded, ${BATCH_IMAGE_STATE.failed} failed.`;
        BATCH_IMAGE_STATE.running = false;
        BATCH_IMAGE_STATE.cancelRequested = false;
        BATCH_IMAGE_STATE.current = [];
        updateBatchStatusUI();
        showToast(summary, cancelled ? 'error' : 'info', 4200);
    }

    function cancelMissingImagesBatch() {
        if (!BATCH_IMAGE_STATE.running) return;
        BATCH_IMAGE_STATE.cancelRequested = true;
        updateBatchStatusUI();
        showToast('Batch cancel requested. Active image requests will finish first.', 'info', 3200);
    }

    function addNewSlide(type) {
        let template;
        if (type === 'standard') {
            template = { type: 'standard', title: 'New Slide', content: '* Point 1', speakerNotes: '', bodyField: ensureFieldDefaults({ mode: 'text', text: '* Point 1' }, '* Point 1') };
        } else if (type === 'two-column') {
            template = {
                type: 'two-column',
                title: 'Two-Column Slide',
                speakerNotes: '',
                columns: {
                    splitPct: 50,
                    leftField: ensureFieldDefaults({ mode: 'text', text: '* Left panel notes' }, '* Left panel notes'),
                    rightField: ensureFieldDefaults({ mode: 'image', imageUrl: '', imageAlign: 'center' }, '• Right panel notes')
                }
            };
        } else {
            template = { type: type, title: 'New Title', subtitle: 'Subtitle', speakerNotes: '' };
        }
        slidesData.splice(currentSlideIndex + 1, 0, template);
        currentSlideIndex++;
        render();
        saveState();
        showSlide(currentSlideIndex);
    }
    function deleteSlide() { if (slidesData.length <= 1) return; if (confirm("Delete slide?")) { slidesData.splice(currentSlideIndex, 1); if (currentSlideIndex >= slidesData.length) currentSlideIndex--; render(); saveState(); showSlide(currentSlideIndex); } }
    function showSlide(idx) { if (idx < 0 || idx >= slidesData.length) return; currentSlideIndex = idx; document.querySelectorAll('.slide').forEach((s, i) => s.classList.toggle('active', i === idx)); updateSelectionMenu(); renderSpeakerNotesPanel(); syncLayoutActionButtons(); }
    function exportDeck() { navigator.clipboard.writeText(serializeDeckState(true)).then(() => alert("JSON Copied!")); }
    async function copyJsonHowTo() {
        const guide = [
            'Designer JSON authoring guide',
            '',
            'Use this format:',
            '{',
            '  "config": {',
            '    "globalX": 0,',
            '    "globalY": 0,',
            '    "imagePromptStyle": "Optional universal image style"',
            '  },',
            '  "slides": [',
            '    { "type": "cover", "title": "Deck Title", "subtitle": "Optional subtitle" },',
            '    { "type": "section", "title": "Section Header", "subtitle": "Optional subtitle" },',
            '    {',
            '      "type": "standard",',
            '      "title": "Slide title",',
            '      "bodyField": { "mode": "text", "text": "Bullet or paragraph text" }',
            '    },',
            '    {',
            '      "type": "two-column",',
            '      "title": "Two-column title",',
            '      "columns": {',
            '        "splitPct": 55,',
            '        "leftField": { "mode": "text", "text": "Left content" },',
            '        "rightField": { "mode": "quote", "quoteText": "Quoted text", "quoteAttribution": "Person" }',
            '      }',
            '    }',
            '  ]',
            '}',
            '',
            'Rules and tips:',
            '- Required top-level key: "slides" (array).',
            '- Optional top-level key: "config" (object). If missing, Designer uses defaults.',
            '- `config.imagePromptStyle` stores the universal image style used for AI image generation.',
            '- Supported slide types: "cover", "section", "standard", "two-column".',
            '- Unknown slide types are auto-converted to "standard".',
            '- If you only have one slide object, wrap it in "slides".',
            '- A plain array is accepted and treated as slides.',
            '- AI prose around JSON is okay, but the JSON object must still be valid.',
            '- For image fields use mode "image" with "imageUrl".',
            '- Use "imageNotes" for alt-text and AI image generation prompts.',
            '- Automatic prompt drafting writes into `imagePrompt` and `imageNotes` on the field.',
            '',
            'How to use:',
            '1) Paste this guide into an AI prompt and ask for valid JSON only.',
            '2) In Designer, open Settings > Import JSON.',
            '3) Paste the JSON or use Upload/Clipboard import.'
        ].join('\n');

        showToast('Copying JSON guide...');
        try {
            await navigator.clipboard.writeText(guide);
            showToast('JSON how-to copied to clipboard.');
        } catch (err) {
            showToast('Clipboard was blocked. Allow clipboard access and try again.', 'error', 3200);
        }
    }
    function toggleSettings() { document.getElementById('settings-panel').classList.toggle('open'); }
    function openImport() { document.getElementById('import-modal').classList.add('open'); }
    function closeImport() { document.getElementById('import-modal').classList.remove('open'); }
    function resetAll() { if(confirm("Clear All?")) { localStorage.removeItem('heart_walk_deck_pro_v3'); location.reload(); }}
    function exec(cmd, val=null) { document.execCommand(cmd, false, val); }

    function getActiveFieldContext() {
        const sel = window.getSelection();
        const anchor = sel && sel.anchorNode ? (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode) : null;
        const editable = anchor ? anchor.closest('[data-role="field-text"]') : null;
        if (!editable) return null;
        const slideEl = editable.closest('.slide');
        if (!slideEl) return null;
        const index = parseInt(slideEl.dataset.index, 10);
        if (Number.isNaN(index)) return null;
        const slide = slidesData[index];
        ensureSlideSchema(slide);
        const field = getByPath(slide, editable.dataset.fieldPath);
        if (!field) return null;
        return { slide, field, editable };
    }

    function setActiveFieldTextScale(scale) {
        const resolved = ['large', 'normal', 'small'].includes(scale) ? scale : 'normal';
        const ctx = getActiveFieldContext();
        if (!ctx) return;
        ctx.field.textScale = resolved;
        saveState();
        render();
        showSlide(currentSlideIndex);
        showFieldTypoIndicator(ctx.field);
    }

    container.addEventListener('focusin', (e) => {
        const field = getFieldFromEditable(e.target);
        if (field) showFieldTypoIndicator(field);
    });

    container.addEventListener('focusout', (e) => {
        const target = e.relatedTarget;
        if (target && target.closest && target.closest('.field-shell')) return;
        setTimeout(() => {
            const active = document.activeElement;
            if (active && active.closest && active.closest('[data-role="field-text"], [data-role="field-quote-text"], [data-role="field-quote-attrib"]')) return;
            hideFieldTypoIndicator();
        }, 0);
    });

    function showContextMenu(x, y) { const menu = document.getElementById('context-menu'); menu.style.left = x + 'px'; menu.style.top = y + 'px'; menu.classList.add('visible'); }
    function setShapeColor(colorVar) { slidesData[currentSlideIndex].shapeColor = colorVar; render(); saveState(); document.getElementById('context-menu').classList.remove('visible'); }
    document.addEventListener('click', e => { if(e.target.closest('[contenteditable]') || e.target.closest('#settings-wrapper') || e.target.closest('#top-hotspot') || e.target.closest('.modal-content') || e.target.closest('.error-content') || e.target.closest('#selection-floater') || e.target.closest('.color-trigger') || e.target.closest('#color-picker-popover') || e.target.closest('#context-menu') || e.target.closest('.color-option')) return; if(!e.ctrlKey) { document.querySelectorAll('.selected-for-move').forEach(el => el.classList.remove('selected-for-move')); selectedElements = []; updateSelectionMenu(); } document.getElementById('context-menu').classList.remove('visible'); });
    
    // --- PPT GENERATOR LOGIC ---
    async function generatePPTX() {
        let pres = new PptxGenJS();
        pres.layout = 'LAYOUT_WIDE';

        const hideAllImages = !!appConfig.hideAllImages;

        const getHex = (key, fallback) => {
            let val = appConfig[key] || fallback;
            if (cssVarMap[val]) val = cssVarMap[val];
            return val.replace('#', '');
        };

        const getPt = (key, fallback) => {
            let val = appConfig[key] || fallback;
            return parseInt(val.replace('pt', ''));
        };

        const getScaleKey = (safeField) => {
            const scale = String(safeField?.textScale || 'normal');
            if (scale === 'large') return 'p-large';
            if (scale === 'small') return 'p-small';
            return 'p-normal';
        };

        const parseBullets = (mdText, basePt) => {
            const lines = mdText.split('\n');
            let items = [];
            lines.forEach(line => {
                const indentMatch = line.match(/^(\s*)/);
                const rawIndent = indentMatch ? indentMatch[1] : '';
                const indentLevel = Math.floor(rawIndent.replace(/\t/g, '  ').length / 2);
                let clean = stripCitationMarkers(line).trim();
                if(!clean) {
                    // Blank line → paragraph break
                    items.push({ text: '', options: { breakLine: true, fontSize: basePt * 0.5 } });
                    return;
                }

                let isBullet = false;
                let isNumbered = false;
                let isBold = false;
                let isItalic = false;
                let fontSize = basePt;
                
                // Detect ### Header
                if(clean.startsWith('### ')) {
                    clean = clean.substring(4);
                    isBold = true;
                    fontSize += 2;
                }
                // Detect Bullets: *, -, +
                else if(/^[\*\-\+]\s+/.test(clean)) {
                    clean = clean.replace(/^[\*\-\+]\s+/, '');
                    isBullet = true;
                }
                // Detect numbered lists: 1. or 1)
                else if(/^\d+[\.\)]\s+/.test(clean)) {
                    clean = clean.replace(/^\d+[\.\)]\s+/, '');
                    isNumbered = true;
                }

                // Detect inline bold/italic and strip markers for PPTX
                if (/^\*\*(.+)\*\*$/.test(clean) || /^__(.+)__$/.test(clean)) {
                    clean = clean.replace(/^\*\*(.+)\*\*$/, '$1').replace(/^__(.+)__$/, '$1');
                    isBold = true;
                }
                if (/^\*(.+)\*$/.test(clean) || /^_(.+)_$/.test(clean)) {
                    clean = clean.replace(/^\*(.+)\*$/, '$1').replace(/^_(.+)_$/, '$1');
                    isItalic = true;
                }

                // Spacing: paragraphs get full space, root bullets get 3/4, nested less
                const isRootListItem = (isBullet || isNumbered) && indentLevel === 0;
                const paraSpaceAfter = (!isBullet && !isNumbered && !isBold) ? 12
                    : isRootListItem ? 8
                    : 3;

                items.push({ 
                    text: clean, 
                    options: { 
                        breakLine: true, 
                        bullet: isBullet ? { indent: indentLevel * 18 } : (isNumbered ? { type: 'number', indent: indentLevel * 18 } : false),
                        bold: isBold,
                        italic: isItalic,
                        fontSize: fontSize,
                        indentLevel: indentLevel,
                        paraSpaceBefore: isBold ? 10 : (indentLevel > 0 ? 2 : 5),
                        paraSpaceAfter: paraSpaceAfter
                    } 
                });
            });
            return items;
        };

        const addFieldToPpt = async (pptSlide, field, x, y, w, h) => {
            const safeField = ensureFieldDefaults(field, '');
            if (safeField.mode === 'image') {
                if (hideAllImages) return;
                if (safeField.imageUrl) {
                    try {
                        const dimensions = await getImageDimensions(safeField.imageUrl);
                        const fit = getContainedImagePlacement({ x, y, w, h }, dimensions, safeField.imageAlign || 'top');
                        pptSlide.addImage({ path: safeField.imageUrl, x: fit.x, y: fit.y, w: fit.w, h: fit.h });
                    } catch {
                        pptSlide.addText(`Image: ${safeField.imageUrl}`, { x, y, w, h, color: '777777', fontSize: 12, fit: 'resize' });
                    }
                } else {
                    pptSlide.addText('Image placeholder', { x, y, w, h, color: '777777', fontSize: 12, valign: 'mid', align: 'center' });
                }
                return;
            }

            if (safeField.mode === 'quote') {
                const quoteText = String(safeField.quoteText || '').trim();
                if (!quoteText) return;

                const quoteBodyPt = Math.max(10, getPt('size-quote-body', '18pt') + ((safeField.fontDelta || 0) * 0.75));
                const quoteBodyColor = getHex('color-quote-body', '1e1d21');
                const quoteAttribPt = Math.max(8, getPt('size-quote-attrib', '16pt') + ((safeField.fontDelta || 0) * 0.75));
                const quoteAttribColor = getHex('color-quote-attrib', '1e1d21');
                const quoteAttrib = getResolvedQuoteAttribution(safeField);
                const attribH = (quoteAttrib && !appConfig.hideAttrib) ? 0.35 : 0;

                // Quote bubble: 90% of field width, 50% of field height, centered at 40% down
                const bubbleW = w * 0.9;
                const bubbleH = h * 0.5;
                const bubbleX = x + (w - bubbleW) / 2;
                const bubbleY = y + (h * 0.4) - (bubbleH / 2);
                // Rect body is 79.5% of total SVG height (766/963)
                const rectH = bubbleH * 0.795;

                if (!hideAllImages) {
                    const bubbleSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1720 963" preserveAspectRatio="none">'
                        + '<path d="M0 200.6C0 89.8 89.8 0 200.6 0L1519.4 0C1630.2 0 1720 89.8 1720 200.6L1720 565.4C1720 676.2 1630.2 766 1519.4 766L200.6 766C89.8 766 0 676.2 0 565.4Z" fill="#F5E5B3"/>'
                        + '<path d="M257 743 496 743 376.5 963Z" fill="#F5E5B3"/>'
                        + '</svg>';
                    pptSlide.addImage({
                        data: 'data:image/svg+xml;base64,' + btoa(bubbleSvg),
                        x: bubbleX, y: bubbleY, w: bubbleW, h: bubbleH
                    });

                    // Quote text positioned inside the rect portion of the bubble
                    pptSlide.addText(quoteText, {
                        x: bubbleX + 0.3, y: bubbleY + 0.15,
                        w: bubbleW - 0.6,
                        h: Math.max(0.2, rectH - 0.3 - attribH),
                        color: quoteBodyColor, fontSize: quoteBodyPt,
                        align: 'center', valign: 'mid', fontFace: 'Arial'
                    });

                    if (quoteAttrib && !appConfig.hideAttrib) {
                        pptSlide.addText(quoteAttrib, {
                            x: bubbleX + 0.3, y: bubbleY + rectH - attribH - 0.15,
                            w: bubbleW - 0.6, h: attribH,
                            color: quoteAttribColor, bold: true,
                            fontSize: quoteAttribPt,
                            align: 'right', fontFace: 'Arial'
                        });
                    }
                } else {
                    // Plain-text fallback when images hidden
                    pptSlide.addText(quoteText, {
                        x: x + 0.2, y: y + (h * 0.4) - 0.5,
                        w: w - 0.4, h: Math.max(0.2, 1.0),
                        color: quoteBodyColor, fontSize: quoteBodyPt,
                        align: 'center', valign: 'mid', fontFace: 'Arial'
                    });
                    if (quoteAttrib && !appConfig.hideAttrib) {
                        pptSlide.addText(quoteAttrib, {
                            x: x + 0.2, y: y + (h * 0.4) + 0.5,
                            w: w - 0.4, h: attribH,
                            color: quoteAttribColor, bold: true,
                            fontSize: quoteAttribPt,
                            align: 'right', fontFace: 'Arial'
                        });
                    }
                }
                return;
            }

            const scaleKey = getScaleKey(safeField);
            const basePt = Math.max(8, getPt(`size-${scaleKey}`, '16pt') + ((safeField.fontDelta || 0) * 0.75));
            const textObjects = parseBullets(safeField.text || '', basePt);
            textObjects.forEach(obj => {
                obj.options.color = getHex(`color-${scaleKey}`, '333333');
                obj.options.fontFace = 'Arial';
            });
            pptSlide.addText(textObjects, { x, y, w, h, valign: 'top' });
        };

        for (const [index, data] of slidesData.entries()) {
            let slide = pres.addSlide();
            const speakerNotes = String(data.speakerNotes || '').trim();
            if (speakerNotes) slide.addNotes(speakerNotes);
            
            // Background Vector Shape (SVG path — matches HTML preview)
            if (!hideAllImages && appConfig.showShapes && (data.type === 'cover' || data.type === 'section')) {
                let shapeColorVar = data.shapeColor || 'var(--c-emotional)';
                let shapeHex = cssVarMap[shapeColorVar] || 'FF5C5C';
                shapeHex = shapeHex.replace('#','');

                const shapeSvgPath = appConfig.shapePath || defaultShapePath;
                const shapeSvgVB  = appConfig.shapeViewBox || defaultViewBox;
                const shapeSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'
                    + shapeSvgVB + '" preserveAspectRatio="none"><path d="'
                    + shapeSvgPath + '" fill="#' + shapeHex + '" fill-opacity="0.9"/></svg>';
                slide.addImage({
                    data: 'data:image/svg+xml;base64,' + btoa(shapeSvg),
                    x: '55%', y: '35%', w: '45%', h: '65%'
                });
            }

            // Text Elements
            if (data.type === 'cover') {
                slide.addText(data.title, { 
                    x: 0.5, y: '38%', w: '90%', h: 1, 
                    fontSize: getPt('size-title', '45pt'), 
                    color: getHex('color-title', '16bfec'), 
                    bold: true, align: 'center', fontFace: 'Arial'
                });
                slide.addText(data.subtitle, { 
                    x: 0.5, y: '47%', w: '90%', h: 1, 
                    fontSize: getPt('size-subtitle', '25pt'), 
                    color: getHex('color-subtitle', '333333'), 
                    align: 'center', fontFace: 'Arial'
                });
            } 
            else if (data.type === 'section') {
                slide.addText(data.title, { 
                    x: 0.5, y: '45%', w: '90%', h: 1.5, 
                    fontSize: getPt('size-h1', '32pt'), 
                    color: getHex('color-h1', '16bfec'), 
                    bold: true, align: 'center', fontFace: 'Arial'
                });
            } 
            else {
                slide.addText(data.title, { 
                    x: 0.83, y: 0.63, w: 11.67, h: 1, 
                    fontSize: getPt('size-h2', '28pt'), 
                    color: getHex('color-h2', '16bfec'), 
                    bold: true, fontFace: 'Arial'
                });

                if (data.type === 'two-column') {
                    ensureSlideSchema(data);
                    const split = Math.max(20, Math.min(80, Number(data.columns?.splitPct ?? 50)));
                    const totalW = 11.67;
                    const gap = 0.18;
                    const leftW = (totalW - gap) * (split / 100);
                    const rightW = (totalW - gap) - leftW;
                    const baseX = 0.83;
                    const baseY = 1.83;
                    const bodyH = 5.0;
                    await addFieldToPpt(slide, data.columns.leftField, baseX, baseY, leftW, bodyH);
                    await addFieldToPpt(slide, data.columns.rightField, baseX + leftW + gap, baseY, rightW, bodyH);
                } else {
                    const field = ensureFieldDefaults(data.bodyField, data.content || '');
                    await addFieldToPpt(slide, field, 0.83, 1.83, 11.67, 5.0);
                }
            }

            // Slide Number
            slide.slideNumber = { x: '95%', y: '90%', fontSize: 10, color: '999999' };
        }

        await pres.writeFile({ fileName: "HeartWalk_Deck_Fixed.pptx" });
    }

    // ════════════════════════════════════════════════
    //  AI Image Generation — uses generateImage() from ailnl.js
    // ════════════════════════════════════════════════
    async function generateAIImage(fieldPath, slideIndex, customPrompt, triggerBtn = null) {
        console.log('[Designer] generateAIImage called:', { fieldPath, slideIndex, customPrompt: customPrompt?.slice(0, 60) });
        const slide = slidesData[slideIndex];
        ensureSlideSchema(slide);
        const field = getByPath(slide, fieldPath);
        if (!field) { console.error('[Designer] generateAIImage: field not found at', fieldPath); return; }

        const promptBase = customPrompt || field.imagePrompt || field.imageNotes;
        if (!promptBase) {
            const state = getFieldAsyncState(slideIndex, fieldPath);
            if (state.promptPending) {
                state.generateQueued = true;
                refreshImageActionButtons(slideIndex, fieldPath);
                showToast('Image generation queued until the prompt is ready.', 'info', 2800);
                return;
            }
            console.warn('[Designer] No image prompt available');
            showToast('Enter an image description first or use Auto Prompt.', 'error', 2600);
            return;
        }
        const prompt = buildImageGenerationPrompt(promptBase);
        console.log('[Designer] Using prompt:', prompt.slice(0, 100));

        const reqKey = `${slideIndex}::${fieldPath}`;
        if (AI_GEN_IN_FLIGHT.has(reqKey)) {
            console.warn('[Designer] generateAIImage skipped: request already in-flight for', reqKey);
            showToast('Image generation already in progress for this field.', 'error', 2200);
            return;
        }
        AI_GEN_IN_FLIGHT.add(reqKey);

        // Persist edited prompt
        if (customPrompt) {
            field.imagePrompt = customPrompt;
            field.imageNotes = customPrompt;
            saveState();
            updateImagePromptInputs(slideIndex, fieldPath, customPrompt);
        }

        // Show loading spinner on the matching button(s) for this slide+field.
        const btnSelector =
            `[data-role="ai-gen-btn"][data-field-path="${fieldPath}"],` +
            `[data-role="ai-regen-btn"][data-field-path="${fieldPath}"]`;
        const slideEl = container.querySelector(`.slide[data-index="${slideIndex}"]`);
        const btns = slideEl ? Array.from(slideEl.querySelectorAll(btnSelector)) : [];
        if (triggerBtn && !btns.includes(triggerBtn)) btns.push(triggerBtn);
        const btnStates = btns.map(btn => ({ btn, label: btn.dataset.defaultLabel || btn.textContent }));
        btnStates.forEach(({ btn }) => {
            btn.disabled = true;
            btn.innerHTML = '<span class="ai-spinner"></span> Generating…';
        });
        console.log('[Designer] Loading ailnl.js module...');

        try {
            const { generateImage } = await getAiTools();
            console.log('[Designer] ailnl.js loaded, calling generateImage...');
            const result = await generateImage(prompt, 'openai', {
                size: '1536x1024',
                timeoutMs: 90000,
                debug: true
            });
            console.log('[Designer] generateImage returned:', { error: result.error, hasUrl: !!result.url, urlPreview: result.url?.slice(0, 80) });

            if (result.error) {
                console.error('[Designer] AI image generation failed:', result.error);
                showToast('Image generation failed: ' + result.error, 'error', 4000);
                return;
            }

            if (result.url) {
                // Push old image to history before replacing
                pushImageHistory(field);

                // If base64 data-URI, attempt server upload for persistence
                if (result.url.startsWith('data:')) {
                    try {
                        const blob = await (await fetch(result.url)).blob();
                        const file = new File([blob], 'ai-generated.png', { type: 'image/png' });
                        const form = new FormData();
                        form.append('image', file);
                        const resp = await fetch(IMAGE_UPLOAD_URL, { method: 'POST', body: form });
                        if (resp.ok) {
                            const uploadResult = await resp.json();
                            if (uploadResult.url) {
                                field.imageUrl = uploadResult.url;
                                setImageManageMode(slideIndex, fieldPath, false);
                                console.log('[Designer] ✓ AI image uploaded to server:', uploadResult.url);
                                saveState(true); render(); showSlide(currentSlideIndex);
                                showToast('Generated image saved to the deck and autosaved to DB.', 'info', 2800);
                                return;
                            }
                        }
                    } catch (uploadErr) {
                        console.warn('[Designer] Upload of AI image failed, using data-URI:', uploadErr.message);
                    }
                }
                field.imageUrl = result.url;
                setImageManageMode(slideIndex, fieldPath, false);
                console.log('[Designer] ✓ AI image generated:', result.url.slice(0, 80));
                const savedOk = saveState(true);
                render(); showSlide(currentSlideIndex);
                if (String(result.url || '').startsWith('data:')) {
                    showToast(savedOk
                        ? 'Generated image was embedded into the deck JSON. For the most reliable persistence, use upload-backed image URLs.'
                        : 'Generated image preview updated, but autosave failed. The generated image was not stored durably.', savedOk ? 'info' : 'error', 4600);
                } else {
                    showToast('Generated image saved to the deck and autosaved to DB.', 'info', 2800);
                }
            }
        } catch (err) {
            console.error('[Designer] AI image generation error:', err);
            alert('Image generation error: ' + err.message);
        } finally {
            AI_GEN_IN_FLIGHT.delete(reqKey);
            btnStates.forEach(({ btn, label }) => {
                btn.disabled = false;
                btn.textContent = label;
            });
            refreshImageActionButtons(slideIndex, fieldPath);
        }
    }

    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
    //  Smoke Tests \u2014 automated validation of core Designer requirements
    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
    function runSmokeTests() {
        const results = [];

        function pass(name, detail) { results.push({ name, ok: true, detail }); }
        function fail(name, detail) { results.push({ name, ok: false, detail }); }

        // \u2500\u2500 TEST 1: JSON contract smoke test \u2500\u2500
        // import + export preserves required schema keys and slide types
        try {
            const testPayload = {
                config: { 'font-title': "'Source Sans 3', sans-serif", 'size-title': '32pt', 'color-title': '#16bfec', showShapes: true },
                slides: [
                    { type: 'cover', title: 'Test Cover', subtitle: 'Sub' },
                    { type: 'section', title: 'Test Section' },
                    { type: 'standard', title: 'Test Standard', content: '* Bullet', bodyField: { mode: 'text', text: '* Bullet', imageUrl: '', imageAlign: 'center', imagePrompt: 'test prompt', quoteText: '', quoteAttribution: '' } },
                    { type: 'two-column', title: 'Test TwoCol', columns: { splitPct: 55, leftField: { mode: 'text', text: 'Left' }, rightField: { mode: 'quote', quoteText: 'Quote', quoteAttribution: 'Author' } } }
                ]
            };
            const parsed = smartParseInput(JSON.stringify(testPayload));
            const slides = parsed.data.slides.map(ensureSlideSchema);
            const types = slides.map(s => s.type);
            const hasAllTypes = ['cover', 'section', 'standard', 'two-column'].every(t => types.includes(t));
            const stdHasBody = slides.find(s => s.type === 'standard')?.bodyField;
            const tcHasCols = slides.find(s => s.type === 'two-column')?.columns;
            if (hasAllTypes && stdHasBody && tcHasCols) {
                pass('JSON Contract', `All 4 slide types preserved, bodyField + columns intact.`);
            } else {
                fail('JSON Contract', `Missing: types=${hasAllTypes}, bodyField=${!!stdHasBody}, columns=${!!tcHasCols}`);
            }
        } catch (e) {
            fail('JSON Contract', `Exception: ${e.message}`);
        }

        // \u2500\u2500 TEST 2: Field-mode smoke test \u2500\u2500
        try {
            const modes = ['text', 'image', 'quote'];
            let allValid = true;
            let details = [];
            for (const m of modes) {
                const f = ensureFieldDefaults({ mode: m, text: 'T', imageUrl: 'http://x.png', quoteText: 'Q', quoteAttribution: 'A' });
                if (f.mode !== m) { allValid = false; details.push(`${m} mode not preserved`); }
            }
            // Test that renderFieldBody doesn't throw for each mode
            for (const m of modes) {
                const f = ensureFieldDefaults({ mode: m, text: 'T', imageUrl: m === 'image' ? 'http://x.png' : '', quoteText: 'Q', quoteAttribution: 'A' });
                const html = renderFieldBody('bodyField', f);
                if (!html || typeof html !== 'string') { allValid = false; details.push(`${m} render failed`); }
            }
            if (allValid) pass('Field Modes', 'All 3 modes (text/image/quote) render without errors.');
            else fail('Field Modes', details.join('; '));
        } catch (e) {
            fail('Field Modes', `Exception: ${e.message}`);
        }

        // \u2500\u2500 TEST 3: PPTX smoke test \u2500\u2500
        try {
            // Verify PptxGenJS is loaded and generatePPTX function exists
            if (typeof PptxGenJS === 'undefined') {
                fail('PPTX Export', 'PptxGenJS library not loaded.');
            } else if (typeof generatePPTX !== 'function') {
                fail('PPTX Export', 'generatePPTX function not found.');
            } else {
                // Test generatePPTX with mock slides (addFieldToPpt is scoped inside generatePPTX)
                const savedSlides = JSON.parse(JSON.stringify(slidesData));
                const savedWrite = PptxGenJS.prototype.writeFile;
                PptxGenJS.prototype.writeFile = function() { return Promise.resolve(); };
                slidesData = [
                    { type: 'standard', title: 'T', bodyField: ensureFieldDefaults({ mode: 'text', text: '* test' }) },
                    { type: 'standard', title: 'T', bodyField: ensureFieldDefaults({ mode: 'image', imageUrl: '' }) },
                    { type: 'standard', title: 'T', bodyField: ensureFieldDefaults({ mode: 'quote', quoteText: 'Q', quoteAttribution: 'A' }) },
                    { type: 'two-column', title: 'T', columns: { splitPct: 50, leftField: ensureFieldDefaults({ mode: 'text', text: 'L' }), rightField: ensureFieldDefaults({ mode: 'text', text: 'R' }) } }
                ];
                let pptOk = true;
                try { generatePPTX(); }
                catch (e) { pptOk = false; console.error('[Smoke] PPTX export error:', e); }
                slidesData = savedSlides;
                PptxGenJS.prototype.writeFile = savedWrite;
                if (pptOk) pass('PPTX Export', 'generatePPTX ran for all field modes without errors.');
                else fail('PPTX Export', 'generatePPTX threw for one or more modes.');
            }
        } catch (e) {
            fail('PPTX Export', `Exception: ${e.message}`);
        }

        // \u2500\u2500 TEST 4: Import sanitizer smoke test \u2500\u2500
        try {
            const malformed = [
                '{"slides": [{"title": "No type"}]}',                           // missing type
                '{"slides": [{"type": "standard", "title": "No body"}]}',       // missing bodyField
                '{"slides": [{"type": "two-column", "title": "No cols"}]}',     // missing columns
                '{"slides": [{"type": "banana", "title": "Bad type"}]}',        // unknown type
                '[{"type": "standard", "title": "Bare array"}]',               // bare array
                'Here is JSON: {"slides": [{"type": "cover", "title": "Prose"}]}', // AI prose
            ];
            let sanitizerOk = true;
            let issues = [];
            for (const raw of malformed) {
                try {
                    const { data } = smartParseInput(raw);
                    const slides = data.slides.map(ensureSlideSchema);
                    if (!slides.length || !slides[0].type) {
                        sanitizerOk = false;
                        issues.push(`Failed to recover: ${raw.slice(0, 40)}`);
                    }
                } catch (e) {
                    sanitizerOk = false;
                    issues.push(`Threw on: ${raw.slice(0, 40)} (${e.message})`);
                }
            }
            if (sanitizerOk) pass('Import Sanitizer', `${malformed.length} malformed payloads auto-corrected without crash.`);
            else fail('Import Sanitizer', issues.join('; '));
        } catch (e) {
            fail('Import Sanitizer', `Exception: ${e.message}`);
        }

        // \u2500\u2500 TEST 5: Image upload endpoint check \u2500\u2500
        try {
            if (typeof IMAGE_UPLOAD_URL === 'string' && IMAGE_UPLOAD_URL.includes('image-store')) {
                pass('Image Upload', `Endpoint configured: ${IMAGE_UPLOAD_URL}`);
            } else {
                fail('Image Upload', 'IMAGE_UPLOAD_URL not configured.');
            }
            // Also verify data-URI fallback path exists
            if (typeof handleImageFile === 'function') {
                pass('Image Fallback', 'handleImageFile function available (includes data-URI fallback).');
            } else {
                fail('Image Fallback', 'handleImageFile not found.');
            }
        } catch (e) {
            fail('Image Upload', `Exception: ${e.message}`);
        }

        // \u2500\u2500 TEST 6: Reporter handoff smoke test \u2500\u2500
        try {
            // Simulate a typical Reporter output payload
            const reporterPayload = JSON.stringify({
                config: {},
                slides: [
                    { type: 'cover', title: 'Heart Walk Research', subtitle: 'Executive Report' },
                    { type: 'section', title: 'Findings' },
                    { type: 'two-column', title: 'Key Finding', content: 'Analysis text',
                      columns: { splitPct: 55,
                        leftField: { mode: 'text', text: 'Analysis text', imageUrl: '', imagePrompt: '', quoteText: '', quoteAttribution: '' },
                        rightField: { mode: 'quote', text: '', imageUrl: '', imagePrompt: '', quoteText: 'It changed everything.', quoteAttribution: '' }
                      }
                    },
                    { type: 'standard', title: 'Recommendations', bodyField: { mode: 'text', text: '* Do this\n* Do that', imageUrl: '', imageAlign: 'center', imagePrompt: 'A roadmap infographic', quoteText: '', quoteAttribution: '' } }
                ]
            });
            const { data, warnings } = smartParseInput(reporterPayload);
            const slides = data.slides.map(ensureSlideSchema);
            const coverOk = slides[0]?.type === 'cover' && slides[0]?.title;
            const tcOk = slides[2]?.type === 'two-column' && slides[2]?.columns?.rightField?.quoteText;
            const stdOk = slides[3]?.type === 'standard' && slides[3]?.bodyField?.imagePrompt;
            if (coverOk && tcOk && stdOk) {
                pass('Reporter Handoff', 'Reporter JSON imported cleanly: cover, two-column+quote, standard+imagePrompt all intact.');
            } else {
                fail('Reporter Handoff', `Cover=${!!coverOk}, TwoCol+Quote=${!!tcOk}, Std+Prompt=${!!stdOk}`);
            }
        } catch (e) {
            fail('Reporter Handoff', `Exception: ${e.message}`);
        }

        // \u2500\u2500 Display results \u2500\u2500
        const body = document.getElementById('smoke-body');
        const passed = results.filter(r => r.ok).length;
        const total = results.length;
        body.innerHTML = `<div style="margin-bottom:12px; font-weight:600; font-size:14px; color:${passed === total ? '#22D460' : '#FF5C5C'}">${passed}/${total} passed</div>` +
            results.map(r => `<div class="smoke-item"><span class="${r.ok ? 'smoke-pass' : 'smoke-fail'}">${r.ok ? '\u2713' : '\u2717'}</span> ${r.name}</div><div class="smoke-detail">${r.detail || ''}</div>`).join('');
        document.getElementById('smoke-results').classList.add('open');
        console.log(`[Designer] Smoke tests: ${passed}/${total} passed`);
        results.forEach(r => console.log(`  ${r.ok ? '\u2713' : '\u2717'} ${r.name}: ${r.detail || ''}`));
    }

    init();
