    // Release hygiene: update BOTH APP_VERSION and APP_LAST_UPDATED_UTC before every live push.
    // Set to the push time in UTC (banner converts to viewer's local time).
    const APP_VERSION = "v4.1";
    const APP_LAST_UPDATED_UTC = "2026-02-23T22:00:00Z";

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
    let currentSlideIndex = 0;
    let slidesData = []; 
    let appConfig = {};
    let nudgeMode = 'global'; 
    let activeColorTarget = null;
    let selectedElements = [];

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
        { id: 'p-small', label: 'P Small' }
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
        if (!slide || typeof slide !== 'object') return { type: 'standard', title: '(empty)', content: '', bodyField: ensureFieldDefaults({}, '') };

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
        if (align === 'left') return 'justify-content:flex-start;align-items:center;';
        if (align === 'right') return 'justify-content:flex-end;align-items:center;';
        if (align === 'top') return 'justify-content:center;align-items:flex-start;';
        if (align === 'bottom') return 'justify-content:center;align-items:flex-end;';
        return 'justify-content:center;align-items:center;';
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

    function renderFieldBody(fieldPath, field) {
        // ── Shared helper: image notes row (shown below loaded image) ──
        function imageNotesHtml(fieldPath, field) {
            const notes = field.imageNotes || '';
            return `<div class="image-tools-row">
                <textarea class="image-notes-field" data-role="image-notes" data-field-path="${fieldPath}" rows="2" placeholder="Image description / alt-text (also used as AI prompt)">${escapeHtml(notes)}</textarea>
                <div class="image-tools-btns">
                    <button class="ai-gen-btn" data-role="ai-gen-btn" data-field-path="${fieldPath}" title="Generate new image from description">🎨 AI</button>
                    <label class="btn-browse-file" title="Browse for image file">📂 Browse<input type="file" accept="image/*" data-role="field-image-file" data-field-path="${fieldPath}" style="display:none"></label>
                </div>
            </div>`;
        }

        if (field.mode === 'image') {
            if (field.imageUrl) {
                // ── Image loaded: show it with alignment & edge-click ──
                const regenBtn = (field.imagePrompt || field.imageNotes)
                    ? `<button class="image-regen-btn" data-role="ai-regen-btn" data-field-path="${fieldPath}" title="Regenerate image with AI">🔄</button>`
                    : '';
                const historyLen = (field.imageHistory || []).length;
                const historyBtn = historyLen > 0
                    ? `<button class="image-history-btn" data-role="image-history-btn" data-field-path="${fieldPath}" title="Undo to previous image (${historyLen} in history)">↩ <span class="history-count">${historyLen}</span></button>`
                    : '';
                const altText = escapeHtml(field.imageNotes || 'Slide image');
                return `<div class="field-body" data-mode="image">
                    <div class="image-field" data-role="image-field" data-field-path="${fieldPath}" data-image-align="${field.imageAlign}" style="${imageAlignStyle(field.imageAlign)}">
                        ${regenBtn}
                        ${historyBtn}
                        <img src="${escapeHtml(field.imageUrl)}" alt="${altText}">
                    </div>
                    ${imageNotesHtml(fieldPath, field)}
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
                        <div class="drop-zone-cell drop-cell-url" onclick="event.stopPropagation()">
                            <div class="drop-cell-title">Paste URL</div>
                            <div class="url-row">
                                <input type="text" placeholder="https://..." data-role="field-image-url" data-field-path="${fieldPath}">
                                <button data-role="url-load-btn" data-field-path="${fieldPath}">Load</button>
                            </div>
                        </div>
                        <div class="drop-zone-cell drop-cell-ai" onclick="event.stopPropagation()">
                            <div class="drop-cell-title">AI Generate</div>
                            <textarea class="image-notes-field" data-role="image-notes" data-field-path="${fieldPath}" rows="2" placeholder="Describe the image you want…">${escapeHtml(notes)}</textarea>
                            <button class="ai-gen-btn" data-role="ai-gen-btn" data-field-path="${fieldPath}">🎨 Generate</button>
                        </div>
                    </div>
                </div>
            </div>`;
        }

        if (field.mode === 'quote') {
            const quoteAttribution = String(field.quoteAttribution ?? '').trim();
            const hideAttrib = !!appConfig.hideAttrib;
            const attribClass = (quoteAttribution && !hideAttrib) ? 'quote-attrib' : 'quote-attrib quote-attrib-empty';
            const attribText = (quoteAttribution && !hideAttrib) ? escapeHtml(quoteAttribution) : '&nbsp;';
            return `<div class="field-body" data-mode="quote">
                <div class="quote-vector-box" style="--field-font-delta:${field.fontDelta || 0}px;">
                    <div class="quote-body" contenteditable="true" data-role="field-quote-text" data-field-path="${fieldPath}">${escapeHtml(field.quoteText || '')}</div>
                    <div class="${attribClass}" contenteditable="true" data-role="field-quote-attrib" data-field-path="${fieldPath}">${attribText}</div>
                </div>
            </div>`;
        }

        return `<div class="field-body" data-mode="text"><div class="slide-content" style="--field-font-delta:${field.fontDelta || 0}px;" data-text-scale="${field.textScale || 'normal'}" contenteditable="true" data-role="field-text" data-field-path="${fieldPath}">${mdToHtml(field.text || '')}</div></div>`;
    }

    function renderFieldShell(fieldPath, field) {
        return `<div class="field-shell">${renderFieldControls(fieldPath, field)}${renderFieldBody(fieldPath, field)}</div>`;
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
                                     ${renderFieldShell('columns.leftField', slide.columns.leftField)}
                                     <div class="split-divider" data-role="split-divider" data-slide-index="${index}" title="Drag to resize columns"></div>
                                     ${renderFieldShell('columns.rightField', slide.columns.rightField)}
                                 </div>
                             </div>`;
            } else {
                innerHTML = `<div class="title-wrapper" style="${titleStyle}"><h2 contenteditable="true" data-key="title">${iconSVG}${slide.title || 'Slide Title'}</h2></div>
                             <div class="body-wrapper" style="${bodyStyle}">${renderFieldShell('bodyField', slide.bodyField)}</div>`;
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
    
    function mdToHtml(md) { if (!md) return ''; let html = md.replace(/^### (.*$)/gim, '<h3>$1</h3>').replace(/\*\*(.*)\*\*/gim, '<b>$1</b>').replace(/\*(.*)\*/gim, '<i>$1</i>').replace(/^\* (.*$)/gim, '<ul><li>$1</li></ul>').replace(/^\d\. (.*$)/gim, '<ol><li>$1</li></ol>').replace(/<\/ul>\s*<ul>/gim, '').replace(/<\/ol>\s*<ol>/gim, '').replace(/\n/gim, '<br>'); if (!html.startsWith('<') && html.length > 0) html = '<p>' + html + '</p>'; return html; }
    function htmlToMd(html) { let temp = document.createElement('div'); temp.innerHTML = html; let text = temp.innerHTML; text = text.replace(/<h3>/gi, '\n### ').replace(/<\/h3>/gi, '\n').replace(/<b>|<strong>/gi, '**').replace(/<\/b>|<\/strong>/gi, '**').replace(/<i>|<em>/gi, '*').replace(/<\/i>|<\/em>/gi, '*').replace(/<li>/gi, '\n* ').replace(/<\/li>/gi, '').replace(/<ul>|<\/ul>|<ol>|<\/ol>/gi, '').replace(/<small>|<\/small>/gi, '').replace(/<br>|<p>|<\/p>|<div>|<\/div>/gi, '\n'); return text.split('\n').map(line => line.trim()).filter(l => l).join('\n'); }

    function init() {
        renderSettingsRows();
        const saved = JSON.parse(localStorage.getItem('heart_walk_deck_pro_v3'));
        if (saved) { appConfig = saved.config; slidesData = saved.slides; } 
        else {
            appConfig = { 'font-title': "'Source Sans 3', sans-serif", 'size-title': '45pt', 'color-title': '#16bfec', 'font-subtitle': "'Source Sans 3', sans-serif", 'size-subtitle': '25pt', 'color-subtitle': '#1e1d21', 'font-h1': "'Source Sans 3', sans-serif", 'size-h1': '32pt', 'color-h1': '#16bfec', 'font-h2': "'Source Sans 3', sans-serif", 'size-h2': '28pt', 'color-h2': '#16bfec', 'font-h3': "'Source Sans 3', sans-serif", 'size-h3': '18pt', 'color-h3': '#1e1d21', 'font-normal': "'Source Sans 3', sans-serif", 'size-normal': '16pt', 'color-normal': '#1e1d21', 'font-p-large': "'Source Sans 3', sans-serif", 'size-p-large': '20pt', 'color-p-large': '#1e1d21', 'font-p-normal': "'Source Sans 3', sans-serif", 'size-p-normal': '16pt', 'color-p-normal': '#1e1d21', 'font-p-small': "'Source Sans 3', sans-serif", 'size-p-small': '13pt', 'color-p-small': '#1e1d21', 'globalX': 0, 'globalY': 0, 'showShapes': true, 'shapePath': defaultShapePath, 'shapeViewBox': defaultViewBox };
            slidesData = [{ type: 'cover', title: 'Start', subtitle: 'Import JSON to begin' }];
        }

        if (typeof appConfig.showShapes !== 'boolean') appConfig.showShapes = true;
        if (typeof appConfig.hideAttrib !== 'boolean') appConfig.hideAttrib = false;
        
        // Ensure Template Offsets exist (Backward Compat)
        if(!appConfig.typeOffsets) appConfig.typeOffsets = {};
        if(!appConfig.typeOffsets.cover) appConfig.typeOffsets.cover = {x:0, y:0};
        if(!appConfig.typeOffsets.section) appConfig.typeOffsets.section = {x:0, y:0};
        if(!appConfig.typeOffsets.standard) appConfig.typeOffsets.standard = {x:0, y:0};
        if(!appConfig.typeOffsets['two-column']) appConfig.typeOffsets['two-column'] = {x:0, y:0};
        slidesData = (slidesData || []).map(ensureSlideSchema);

        applyConfig(); render(); resizeStage();
    }

    function saveState() { localStorage.setItem('heart_walk_deck_pro_v3', JSON.stringify({ config: appConfig, slides: slidesData })); }
    function applyConfig() { document.documentElement.style.setProperty('--global-x', (appConfig.globalX || 0) + 'px'); document.documentElement.style.setProperty('--global-y', (appConfig.globalY || 0) + 'px'); if (appConfig.showShapes) document.body.classList.add('show-shapes'); else document.body.classList.remove('show-shapes'); types.forEach(t => { document.documentElement.style.setProperty(`--font-${t.id}`, appConfig[`font-${t.id}`] || "'Source Sans 3', sans-serif"); document.documentElement.style.setProperty(`--size-${t.id}`, appConfig[`size-${t.id}`] || '18pt'); document.documentElement.style.setProperty(`--color-${t.id}`, appConfig[`color-${t.id}`] || '#1e1d21'); }); }
    function updateTheme() { appConfig.showShapes = document.getElementById('toggle-shapes').checked; types.forEach(t => { appConfig[`font-${t.id}`] = document.getElementById(`font-${t.id}`).value; appConfig[`size-${t.id}`] = document.getElementById(`size-${t.id}`).value + 'pt'; }); applyConfig(); saveState(); }
    function toggleHideAllImages() { appConfig.hideAllImages = document.getElementById('toggle-hide-images').checked; saveState(); render(); showSlide(currentSlideIndex); }
    function toggleHideAttrib() { appConfig.hideAttrib = document.getElementById('toggle-hide-attrib').checked; saveState(); render(); showSlide(currentSlideIndex); }
    function updateSettingsUI() { document.getElementById('toggle-shapes').checked = (typeof appConfig.showShapes === 'boolean') ? appConfig.showShapes : true; document.getElementById('toggle-hide-attrib').checked = !!appConfig.hideAttrib; types.forEach(t => { const fEl = document.getElementById(`font-${t.id}`); const sEl = document.getElementById(`size-${t.id}`); const cBtn = document.getElementById(`color-btn-${t.id}`); if(fEl) fEl.value = appConfig[`font-${t.id}`] || "'Source Sans 3', sans-serif"; if(sEl) sEl.value = (appConfig[`size-${t.id}`] || '').replace('pt',''); if(cBtn) cBtn.style.backgroundColor = appConfig[`color-${t.id}`] || '#000'; }); }
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

    /**
     * Parse input string into { data, warnings }.
     * Handles: raw JSON, AI-wrapped JSON, slides-only arrays,
     * objects with slides but no config, markdown/code-fenced JSON, etc.
     */
    function smartParseInput(raw) {
        const warnings = [];

        // Reject obvious non-data
        const trimmed = raw.trim();
        if (!trimmed) throw new Error('Input is empty.');
        if (trimmed.startsWith('<') && !trimmed.startsWith('[')) {
            throw new Error('Input appears to be HTML, not JSON.');
        }

        // Strip markdown code fences: ```json ... ``` or ``` ... ```
        let cleaned = trimmed.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

        // Try direct parse first
        let data;
        try {
            data = JSON.parse(cleaned);
        } catch (_firstErr) {
            // Try extracting JSON from surrounding prose
            const extracted = extractJSON(cleaned);
            try {
                data = JSON.parse(extracted);
                warnings.push('JSON was extracted from surrounding text (AI prose wrapper detected).');
            } catch (_secondErr) {
                throw new Error(
                    `Could not parse JSON. The input may contain invalid syntax.\n\n` +
                    `Tip: If you pasted AI output, make sure the JSON object is complete ` +
                    `(matching braces/brackets).\n\nParser said: ${_secondErr.message}`
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

        // Ensure slides is actually an array of objects
        data.slides = data.slides.filter(s => s && typeof s === 'object');
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
            } else {
                // Preserve current config so we don't clobber an existing theme
                // (appConfig already has sensible defaults from init)
            }

            // ── Slide schema normalization ──
            let coercedTypes = 0;
            let missingBodyFields = 0;
            let missingColumns = 0;
            slidesData = data.slides.map(slide => {
                // Track fixups for user notice
                if (slide.type && !KNOWN_SLIDE_TYPES.has(slide.type)) coercedTypes++;
                if (slide.type === 'standard' && !slide.bodyField) missingBodyFields++;
                if (slide.type === 'two-column' && !slide.columns) missingColumns++;
                return ensureSlideSchema(slide);
            });

            if (coercedTypes > 0) warnings.push(`${coercedTypes} slide(s) had unknown types → converted to "standard".`);
            if (missingBodyFields > 0) warnings.push(`${missingBodyFields} standard slide(s) were missing bodyField → auto-created from content.`);
            if (missingColumns > 0) warnings.push(`${missingColumns} two-column slide(s) were missing columns → auto-created.`);

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
                saveState(); render(); showSlide(currentSlideIndex);
                console.log(`[Designer] Image URL loaded: ${field.imageUrl.slice(0, 60)}`);
            }
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
            const notesEl = (aiGenBtn.closest('.image-tools-row') || aiGenBtn.closest('.drop-cell-ai'))?.querySelector('[data-role="image-notes"]');
            const customPrompt = notesEl ? notesEl.value.trim() : null;
            if (!customPrompt) { alert('Enter an image description first.'); return; }
            generateAIImage(aiGenBtn.dataset.fieldPath, index, customPrompt);
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
            generateAIImage(aiRegenBtn.dataset.fieldPath, index);
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
        if (dropZone && !e.target.closest('input') && !e.target.closest('button') && !e.target.closest('textarea')) {
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

        const rect = imageField.getBoundingClientRect();
        field.imageAlign = edgeAlignFromClick(rect, e.clientX, e.clientY);
        imageField.style.cssText += imageAlignStyle(field.imageAlign);
        saveState();
        render();
        showSlide(currentSlideIndex);
    });

    // ── Image notes change → save ──
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
                    console.log(`[Designer] ✓ Server upload OK: ${result.url}`);
                    saveState(); render(); showSlide(currentSlideIndex);
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
            console.log(`[Designer] ✓ Image embedded as data-URI (${(ev.target.result.length/1024).toFixed(1)} KB)`);
            saveState(); render(); showSlide(currentSlideIndex);
        };
        reader.onerror = () => {
            console.error('[Designer] FileReader error for', file.name);
        };
        reader.readAsDataURL(file);
    }

    function addNewSlide(type) {
        let template;
        if (type === 'standard') {
            template = { type: 'standard', title: 'New Slide', content: '* Point 1', bodyField: ensureFieldDefaults({ mode: 'text', text: '* Point 1' }, '* Point 1') };
        } else if (type === 'two-column') {
            template = {
                type: 'two-column',
                title: 'Two-Column Slide',
                columns: {
                    splitPct: 50,
                    leftField: ensureFieldDefaults({ mode: 'text', text: '* Left panel notes' }, '* Left panel notes'),
                    rightField: ensureFieldDefaults({ mode: 'image', imageUrl: '', imageAlign: 'center' }, '• Right panel notes')
                }
            };
        } else {
            template = { type: type, title: 'New Title', subtitle: 'Subtitle' };
        }
        slidesData.splice(currentSlideIndex + 1, 0, template);
        currentSlideIndex++;
        render();
        saveState();
        showSlide(currentSlideIndex);
    }
    function deleteSlide() { if (slidesData.length <= 1) return; if (confirm("Delete slide?")) { slidesData.splice(currentSlideIndex, 1); if (currentSlideIndex >= slidesData.length) currentSlideIndex--; render(); saveState(); showSlide(currentSlideIndex); } }
    function showSlide(idx) { if (idx < 0 || idx >= slidesData.length) return; currentSlideIndex = idx; document.querySelectorAll('.slide').forEach((s, i) => s.classList.toggle('active', i === idx)); updateSelectionMenu(); }
    function exportDeck() { navigator.clipboard.writeText(JSON.stringify({ config: appConfig, slides: slidesData }, null, 2)).then(() => alert("JSON Copied!")); }
    async function copyJsonHowTo() {
        const guide = [
            'Designer JSON authoring guide',
            '',
            'Use this format:',
            '{',
            '  "config": {',
            '    "globalX": 0,',
            '    "globalY": 0',
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
            '- Supported slide types: "cover", "section", "standard", "two-column".',
            '- Unknown slide types are auto-converted to "standard".',
            '- If you only have one slide object, wrap it in "slides".',
            '- A plain array is accepted and treated as slides.',
            '- AI prose around JSON is okay, but the JSON object must still be valid.',
            '- For image fields use mode "image" with "imageUrl".',
            '- Use "imageNotes" for alt-text and AI image generation prompts.',
            '',
            'How to use:',
            '1) Paste this guide into an AI prompt and ask for valid JSON only.',
            '2) In Designer, open Settings > Import JSON.',
            '3) Paste the JSON or use Upload/Clipboard import.'
        ].join('\n');

        try {
            await navigator.clipboard.writeText(guide);
            alert('JSON how-to copied to clipboard.');
        } catch (err) {
            showError('Could not copy JSON how-to. Clipboard permissions may be blocked.');
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
    function generatePPTX() {
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
                let clean = line.trim();
                if(!clean) return;

                let isBullet = false;
                let isBold = false;
                let fontSize = basePt;
                
                // Detect ### Header
                if(clean.startsWith('### ')) {
                    clean = clean.substring(4);
                    isBold = true;
                    fontSize += 2; // slightly larger
                }
                // Detect Bullets
                else if(clean.startsWith('* ') || clean.startsWith('- ')) {
                    clean = clean.substring(2);
                    isBullet = true;
                }
                
                // PptxGenJS Text Object
                items.push({ 
                    text: clean, 
                    options: { 
                        breakLine: true, 
                        bullet: isBullet,
                        bold: isBold,
                        fontSize: fontSize,
                        paraSpaceBefore: isBold ? 10 : 5 // Add space before headers
                    } 
                });
            });
            return items;
        };

        const addFieldToPpt = (pptSlide, field, x, y, w, h) => {
            const safeField = ensureFieldDefaults(field, '');
            if (safeField.mode === 'image') {
                if (hideAllImages) return;
                if (safeField.imageUrl) {
                    try {
                        pptSlide.addImage({ path: safeField.imageUrl, x, y, w, h, sizing: { type: 'contain', x, y, w, h } });
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

                const h3Pt = Math.max(10, getPt('size-h3', '18pt') + ((safeField.fontDelta || 0) * 0.75));
                const color = getHex('color-h3', '1e1d21');
                const quoteAttrib = String(safeField.quoteAttribution || '').trim();
                const attribH = (quoteAttrib && !appConfig.hideAttrib) ? 0.4 : 0;

                // ── Speech bubble SVG background ──
                if (!hideAllImages) {
                    const bw = 400, bh = 300;
                    const bubbleSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + bw + ' ' + bh + '">'
                        + '<rect x="10" y="10" width="380" height="240" rx="26" ry="26" fill="#f5e5b3"/>'
                        + '<polygon points="80,250 140,250 110,290" fill="#f5e5b3"/>'
                        + '</svg>';
                    pptSlide.addImage({
                        data: 'data:image/svg+xml;base64,' + btoa(bubbleSvg),
                        x, y, w, h
                    });

                    // Quote text inside the bubble
                    pptSlide.addText(quoteText, {
                        x: x + 0.3, y: y + 0.2,
                        w: w - 0.6,
                        h: Math.max(0.2, h * 0.75 - attribH),
                        color, fontSize: h3Pt,
                        align: 'center', valign: 'mid', fontFace: 'Arial'
                    });

                    if (quoteAttrib && !appConfig.hideAttrib) {
                        pptSlide.addText(quoteAttrib, {
                            x: x + 0.3, y: y + h * 0.72 - attribH,
                            w: w - 0.6, h: attribH,
                            color, bold: true,
                            fontSize: Math.max(8, h3Pt - 2),
                            align: 'right', fontFace: 'Arial'
                        });
                    }
                } else {
                    // Plain-text fallback when images hidden
                    pptSlide.addText(quoteText, {
                        x: x + 0.2, y: y + 0.1,
                        w: w - 0.4,
                        h: Math.max(0.2, h - 0.3 - attribH),
                        color, fontSize: h3Pt,
                        align: 'center', valign: 'mid', fontFace: 'Arial'
                    });
                    if (quoteAttrib && !appConfig.hideAttrib) {
                        pptSlide.addText(quoteAttrib, {
                            x: x + 0.2, y: y + h - attribH,
                            w: w - 0.4, h: attribH,
                            color, bold: true,
                            fontSize: Math.max(8, h3Pt - 2),
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

        slidesData.forEach((data, index) => {
            let slide = pres.addSlide();
            
            // Background Vector Shape
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
                    addFieldToPpt(slide, data.columns.leftField, baseX, baseY, leftW, bodyH);
                    addFieldToPpt(slide, data.columns.rightField, baseX + leftW + gap, baseY, rightW, bodyH);
                } else {
                    const field = ensureFieldDefaults(data.bodyField, data.content || '');
                    addFieldToPpt(slide, field, 0.83, 1.83, 11.67, 5.0);
                }
            }

            // Slide Number
            slide.slideNumber = { x: '95%', y: '90%', fontSize: 10, color: '999999' };
        });

        pres.writeFile({ fileName: "HeartWalk_Deck_Fixed.pptx" });
    }

    // ════════════════════════════════════════════════
    //  AI Image Generation — uses generateImage() from ailnl.js
    // ════════════════════════════════════════════════
    async function generateAIImage(fieldPath, slideIndex, customPrompt) {
        const slide = slidesData[slideIndex];
        ensureSlideSchema(slide);
        const field = getByPath(slide, fieldPath);
        if (!field) { console.error('[Designer] generateAIImage: field not found at', fieldPath); return; }

        const prompt = customPrompt || field.imagePrompt || field.imageNotes;
        if (!prompt) { console.warn('[Designer] No image prompt available'); return; }

        // Persist edited prompt
        if (customPrompt) { field.imagePrompt = customPrompt; field.imageNotes = customPrompt; }

        // Show loading state on the button
        const btn = document.querySelector(
            `[data-role="ai-gen-btn"][data-field-path="${fieldPath}"],` +
            `[data-role="ai-regen-btn"][data-field-path="${fieldPath}"]`
        );
        const origLabel = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }

        try {
            const { generateImage } = await import('https://happydo.xyz/api/ailnl.js');
            const result = await generateImage(prompt, 'openai', {
                size: '1536x1024',
                timeoutMs: 90000,
                debug: true
            });

            if (result.error) {
                console.error('[Designer] AI image generation failed:', result.error);
                alert('Image generation failed: ' + result.error);
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
                                console.log('[Designer] ✓ AI image uploaded to server:', uploadResult.url);
                                saveState(); render(); showSlide(currentSlideIndex);
                                return;
                            }
                        }
                    } catch (uploadErr) {
                        console.warn('[Designer] Upload of AI image failed, using data-URI:', uploadErr.message);
                    }
                }
                field.imageUrl = result.url;
                console.log('[Designer] ✓ AI image generated:', result.url.slice(0, 80));
                saveState(); render(); showSlide(currentSlideIndex);
            }
        } catch (err) {
            console.error('[Designer] AI image generation error:', err);
            alert('Image generation error: ' + err.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = origLabel; }
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
                // Verify addFieldToPpt handles all modes without throwing
                const pres = new PptxGenJS();
                const testSlide = pres.addSlide();
                const testFields = [
                    ensureFieldDefaults({ mode: 'text', text: '* test' }),
                    ensureFieldDefaults({ mode: 'image', imageUrl: '' }),
                    ensureFieldDefaults({ mode: 'quote', quoteText: 'Q', quoteAttribution: 'A' })
                ];
                let pptOk = true;
                for (const f of testFields) {
                    try { addFieldToPpt(testSlide, f, 0.5, 1.0, 5, 3); }
                    catch (e) { pptOk = false; }
                }
                if (pptOk) pass('PPTX Export', 'All field modes added to PPT slide without errors.');
                else fail('PPTX Export', 'addFieldToPpt threw for one or more modes.');
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
