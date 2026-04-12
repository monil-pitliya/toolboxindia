/* =============================================
   ToolBox India — PDF Editor
   Full-featured PDF annotation & editing tool
   
   Libraries (loaded on demand):
   • pdf-lib     — final PDF assembly
   • pdfjs-dist  — render PDF pages
   • fabric.js   — interactive canvas (text, draw, shapes, images)
   ============================================= */

(function () {
    'use strict';

    /* ---------- state ---------- */
    let fabricCanvas = null;
    let pdfLib = null;
    let pdfjsLib = null;
    let pdfDoc = null;            // pdf.js document
    let pdfBytes = null;          // raw ArrayBuffer
    let totalPages = 0;
    let currentPage = 1;
    let pageAnnotations = {};     // { pageNum: fabricJSON }
    let pageBackgrounds = {};     // { pageNum: dataURL }
    let pageDimensions = {};      // { pageNum: {w,h} }
    let pageTextItems = {};       // { pageNum: [{str, x, y, w, h, fontSize, fontFamily}] }
    let textOverlayVisible = false;
    let currentTool = 'select';
    let undoStack = [];
    let redoStack = [];
    let isDrawingShape = false;
    let shapeStart = null;
    let activeShape = null;
    let isSaving = false;
    let suppressHistory = false;
    const DISPLAY_SCALE = 1.5;    // render quality
    const EXPORT_SCALE = 2.5;     // export quality

    /* ---------- tool definitions ---------- */
    const TOOLS = [
        { id: 'select',    icon: '↖',  label: 'Select',    shortcut: 'V' },
        { id: 'edittext',  icon: '✎',   label: 'Edit Text', shortcut: 'E' },
        { id: 'text',      icon: 'T',   label: 'Add Text',  shortcut: 'T' },
        { id: 'eraser',    icon: '🧹',  label: 'Eraser',    shortcut: 'R' },
        { id: 'draw',      icon: '✏️',  label: 'Draw',      shortcut: 'D' },
        { id: 'highlight', icon: '🖍️',  label: 'Highlight', shortcut: 'H' },
        { id: 'shapes',    icon: '⬜',  label: 'Shapes',    shortcut: 'S' },
        { id: 'whiteout',  icon: '▬',   label: 'Whiteout',  shortcut: 'W' },
        { id: 'image',     icon: '🖼️',  label: 'Image',     shortcut: 'I' },
        { id: 'sign',      icon: '✍️',  label: 'Sign',      shortcut: '' },
    ];

    const SHAPE_TYPES = [
        { id: 'rect',   label: 'Rectangle', icon: '▭' },
        { id: 'circle', label: 'Circle',    icon: '○' },
        { id: 'line',   label: 'Line',      icon: '╱' },
        { id: 'arrow',  label: 'Arrow',     icon: '→' },
    ];

    /* ---------- default properties ---------- */
    let props = {
        fontSize: 18,
        fontFamily: 'Arial',
        fontColor: '#000000',
        fontBold: false,
        fontItalic: false,
        drawColor: '#e74c3c',
        drawWidth: 3,
        shapeType: 'rect',
        shapeStroke: '#3498db',
        shapeFill: '',
        shapeStrokeWidth: 2,
        highlightColor: '#ffe066',
        highlightOpacity: 0.35,
        eraserWidth: 20,
    };

    /* ========================================
       REGISTER TOOL
       ======================================== */
    ToolRegistry.register('pdf-editor', {
        render() {
            return `
                <div id="pdfedRoot">
                    <!-- Upload Screen -->
                    <div id="pdfedUpload">
                        <div class="tool-workspace">
                            <div class="pdfed-info-banner">
                                <span class="pdfed-info-icon">📝</span>
                                <div>
                                    <strong>Edit PDF — Add Text, Images, Shapes, Signatures & More</strong>
                                    Everything runs 100% in your browser. Your files never leave your device.
                                </div>
                            </div>
                            <div class="drop-zone" id="pdfedDropZone">
                                <span class="drop-zone-icon">📄</span>
                                <h3 class="drop-zone-title">Drop your PDF here</h3>
                                <p class="drop-zone-subtitle">We'll load it so you can start editing</p>
                                <button class="drop-zone-btn" onclick="document.getElementById('pdfedFileInput').click()">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                    Choose PDF
                                </button>
                                <input type="file" id="pdfedFileInput" accept="application/pdf" style="display:none">
                                <p class="drop-zone-info">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                    PDF files only &bull; Max 50MB &bull; 100% private
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Loading Screen -->
                    <div id="pdfedLoading" style="display:none">
                        <div class="pdfed-loading-card">
                            <div class="bgr-spinner"></div>
                            <h3 id="pdfedLoadTitle">Loading PDF...</h3>
                            <p id="pdfedLoadSub">Setting up editor</p>
                        </div>
                    </div>

                    <!-- Editor Screen -->
                    <div id="pdfedEditor" style="display:none">
                        <!-- Toolbar -->
                        <div class="pdfed-toolbar">
                            <div class="pdfed-toolbar-row">
                                <div class="pdfed-tools" id="pdfedTools">
                                    ${TOOLS.map(t => `
                                        <button class="pdfed-tool-btn ${t.id === 'select' ? 'active' : ''}" data-tool="${t.id}" title="${t.label}${t.shortcut ? ' (' + t.shortcut + ')' : ''}">
                                            <span class="pdfed-tool-icon">${t.icon}</span>
                                            <span class="pdfed-tool-label">${t.label}</span>
                                        </button>
                                    `).join('')}

                                    <div class="pdfed-tool-sep"></div>

                                    <button class="pdfed-tool-btn pdfed-action-btn" id="pdfedDeleteBtn" title="Delete selected (Del)">
                                        <span class="pdfed-tool-icon">🗑️</span>
                                        <span class="pdfed-tool-label">Delete</span>
                                    </button>
                                    <button class="pdfed-tool-btn pdfed-action-btn" id="pdfedUndoBtn" title="Undo (Ctrl+Z)">
                                        <span class="pdfed-tool-icon">↩️</span>
                                        <span class="pdfed-tool-label">Undo</span>
                                    </button>
                                    <button class="pdfed-tool-btn pdfed-action-btn" id="pdfedRedoBtn" title="Redo (Ctrl+Y)">
                                        <span class="pdfed-tool-icon">↪️</span>
                                        <span class="pdfed-tool-label">Redo</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Properties Bar -->
                            <div class="pdfed-props-bar" id="pdfedPropsBar"></div>

                            <!-- Shapes Dropdown -->
                            <div class="pdfed-shapes-dropdown" id="pdfedShapesDropdown" style="display:none">
                                ${SHAPE_TYPES.map(s => `
                                    <button class="pdfed-shape-opt ${s.id === 'rect' ? 'active' : ''}" data-shape="${s.id}">
                                        <span>${s.icon}</span> ${s.label}
                                    </button>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Canvas Area -->
                        <div class="pdfed-canvas-wrap" id="pdfedCanvasWrap">
                            <canvas id="pdfedCanvas"></canvas>
                        </div>

                        <!-- Bottom Bar -->
                        <div class="pdfed-bottom-bar">
                            <div class="pdfed-page-nav">
                                <button class="pdfed-nav-btn" id="pdfedPrevPage" title="Previous page">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
                                </button>
                                <span class="pdfed-page-info" id="pdfedPageInfo">1 / 1</span>
                                <button class="pdfed-nav-btn" id="pdfedNextPage" title="Next page">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                                </button>
                            </div>
                            <div class="pdfed-save-wrap">
                                <button class="btn-success pdfed-save-btn" id="pdfedSaveBtn">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    Save &amp; Download PDF
                                </button>
                                <button class="btn-secondary" id="pdfedNewBtn">Edit another PDF</button>
                            </div>
                        </div>
                    </div>

                    <!-- Signature Modal -->
                    <div class="pdfed-modal-overlay" id="pdfedSignModal" style="display:none">
                        <div class="pdfed-modal">
                            <div class="pdfed-modal-header">
                                <h3>Add Your Signature</h3>
                                <button class="pdfed-modal-close" id="pdfedSignClose">&times;</button>
                            </div>
                            <div class="pdfed-sign-tabs">
                                <button class="pdfed-sign-tab active" data-tab="draw">✏️ Draw</button>
                                <button class="pdfed-sign-tab" data-tab="type">⌨️ Type</button>
                            </div>
                            <div class="pdfed-sign-body">
                                <div class="pdfed-sign-panel active" id="pdfedSignDraw">
                                    <canvas id="pdfedSignCanvas" width="460" height="180"></canvas>
                                    <button class="btn-secondary pdfed-sign-clear" id="pdfedSignClear">Clear</button>
                                </div>
                                <div class="pdfed-sign-panel" id="pdfedSignType">
                                    <input type="text" id="pdfedSignText" class="pdfed-sign-input" placeholder="Type your name" maxlength="40">
                                    <div class="pdfed-sign-fonts" id="pdfedSignFonts">
                                        <button class="pdfed-sign-font active" data-font="'Dancing Script', cursive" style="font-family:'Dancing Script',cursive">Preview</button>
                                        <button class="pdfed-sign-font" data-font="'Caveat', cursive" style="font-family:'Caveat',cursive">Preview</button>
                                        <button class="pdfed-sign-font" data-font="'Satisfy', cursive" style="font-family:'Satisfy',cursive">Preview</button>
                                    </div>
                                </div>
                            </div>
                            <div class="pdfed-modal-footer">
                                <button class="btn-secondary" id="pdfedSignCancel">Cancel</button>
                                <button class="btn-primary" id="pdfedSignApply">Add Signature</button>
                            </div>
                        </div>
                    </div>

                    <!-- Image input (hidden) -->
                    <input type="file" id="pdfedImageInput" accept="image/*" style="display:none">
                </div>
            `;
        },

        init() {
            setupDropZone();
            setupToolbar();
            setupBottomBar();
            setupSignatureModal();
            setupKeyboard();
        },

        destroy() {
            if (fabricCanvas) { fabricCanvas.dispose(); fabricCanvas = null; }
            pdfDoc = null; pdfBytes = null;
            pageAnnotations = {}; pageBackgrounds = {}; pageDimensions = {};
            pageTextItems = {}; textOverlayVisible = false;
            undoStack = []; redoStack = [];
            currentPage = 1; totalPages = 0;
            const overlay = document.getElementById('pdfedTextOverlay');
            if (overlay) overlay.remove();
        }
    });

    /* ========================================
       SCREEN SWITCHING
       ======================================== */
    function showScreen(id) {
        ['pdfedUpload', 'pdfedLoading', 'pdfedEditor'].forEach(s => {
            const el = document.getElementById(s);
            if (el) el.style.display = s === id ? '' : 'none';
        });
    }

    function updateLoading(title, sub) {
        const t = document.getElementById('pdfedLoadTitle');
        const s = document.getElementById('pdfedLoadSub');
        if (t) t.textContent = title;
        if (s) s.textContent = sub;
    }

    /* ========================================
       DROP ZONE
       ======================================== */
    function setupDropZone() {
        const zone = document.getElementById('pdfedDropZone');
        const input = document.getElementById('pdfedFileInput');
        if (!zone || !input) return;

        zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', e => {
            e.preventDefault(); zone.classList.remove('drag-over');
            const f = e.dataTransfer.files[0];
            if (f && f.type === 'application/pdf') loadPdf(f);
            else alert('Please drop a PDF file.');
        });
        zone.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') input.click(); });
        input.addEventListener('change', () => { if (input.files[0]) loadPdf(input.files[0]); });
    }

    /* ========================================
       LIBRARY LOADING
       ======================================== */
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s = document.createElement('script');
            s.src = src; s.onload = resolve;
            s.onerror = () => reject(new Error('Failed to load: ' + src));
            document.head.appendChild(s);
        });
    }

    function loadStylesheet(href) {
        if (document.querySelector(`link[href="${href}"]`)) return;
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = href;
        document.head.appendChild(l);
    }

    async function ensureLibraries() {
        if (!pdfLib) {
            await loadScript('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js');
            pdfLib = window.PDFLib;
        }
        if (!pdfjsLib) {
            await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
            pdfjsLib = window.pdfjsLib;
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        }
        if (!window.fabric) {
            await loadScript('https://cdn.jsdelivr.net/npm/fabric@5.3.0/dist/fabric.min.js');
        }
        // Google Fonts for signatures
        loadStylesheet('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Caveat:wght@700&family=Satisfy&display=swap');
    }

    /* ========================================
       PDF LOADING
       ======================================== */
    async function loadPdf(file) {
        if (file.size > 50 * 1024 * 1024) { alert('File too large. Max 50MB.'); return; }

        showScreen('pdfedLoading');
        updateLoading('Loading libraries...', 'Setting up editor engine');

        try {
            await ensureLibraries();

            updateLoading('Reading PDF...', 'Parsing pages');
            pdfBytes = await file.arrayBuffer();
            pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
            totalPages = pdfDoc.numPages;
            currentPage = 1;
            pageAnnotations = {};
            pageBackgrounds = {};
            pageDimensions = {};
            undoStack = [];
            redoStack = [];

            updateLoading('Rendering page...', 'Preparing canvas');
            await renderCurrentPage();

            showScreen('pdfedEditor');
            updatePageInfo();
        } catch (err) {
            console.error('PDF load error:', err);
            alert('Could not read this PDF. It may be corrupted or password-protected.');
            showScreen('pdfedUpload');
        }
    }

    /* ========================================
       FONT RESOLUTION — map PDF internal font names to CSS web fonts
       ======================================== */

    // Map common PDF base-14 and popular font names to web-safe CSS families
    const PDF_FONT_MAP = {
        'arial':            'Arial, Helvetica, sans-serif',
        'helvetica':        'Helvetica, Arial, sans-serif',
        'timesnewroman':    'Times New Roman, Times, serif',
        'times':            'Times New Roman, Times, serif',
        'courier':          'Courier New, Courier, monospace',
        'couriernew':       'Courier New, Courier, monospace',
        'georgia':          'Georgia, Times New Roman, serif',
        'verdana':          'Verdana, Geneva, sans-serif',
        'tahoma':           'Tahoma, Geneva, sans-serif',
        'trebuchetms':      'Trebuchet MS, sans-serif',
        'palatino':         'Palatino Linotype, Book Antiqua, Palatino, serif',
        'garamond':         'Garamond, Georgia, serif',
        'bookman':          'Bookman Old Style, serif',
        'comicsansms':      'Comic Sans MS, cursive',
        'impact':           'Impact, Charcoal, sans-serif',
        'lucidaconsole':    'Lucida Console, Monaco, monospace',
        'lucidasans':       'Lucida Sans Unicode, Lucida Grande, sans-serif',
        'symbol':           'Symbol, sans-serif',
        'zapfdingbats':     'ZapfDingbats, sans-serif',
        'calibri':          'Calibri, Arial, sans-serif',
        'cambria':          'Cambria, Georgia, serif',
        'candara':          'Candara, sans-serif',
        'consolas':         'Consolas, Courier New, monospace',
        'constantia':       'Constantia, Georgia, serif',
        'corbel':           'Corbel, sans-serif',
        'myriadpro':        'Myriad Pro, Arial, sans-serif',
        'minionpro':        'Minion Pro, Times New Roman, serif',
        'segoeui':          'Segoe UI, Tahoma, sans-serif',
        'opensans':         'Open Sans, Arial, sans-serif',
        'roboto':           'Roboto, Arial, sans-serif',
        'lato':             'Lato, Arial, sans-serif',
        'montserrat':       'Montserrat, Arial, sans-serif',
        'sourcesanspro':    'Source Sans Pro, Arial, sans-serif',
        'noto':             'Noto Sans, Arial, sans-serif',
        'notosans':         'Noto Sans, Arial, sans-serif',
    };

    // Generic family fallbacks from pdf.js textContent.styles
    const GENERIC_FAMILY_MAP = {
        'sans-serif': 'Arial, Helvetica, sans-serif',
        'serif':      'Times New Roman, Times, serif',
        'monospace':  'Courier New, Courier, monospace',
        'cursive':    'Comic Sans MS, cursive',
        'fantasy':    'Impact, fantasy',
    };

    /**
     * Resolve a PDF internal font name to usable CSS font-family, weight, and style.
     * @param {string} rawName - e.g. "g_d0_f1", "ArialMT", "TimesNewRomanPS-BoldItalicMT"
     * @param {Object} styles - textContent.styles from pdf.js (maps fontName → {fontFamily, ascent, descent})
     * @returns {{ fontFamily: string, fontWeight: string, fontStyle: string }}
     */
    function resolvePdfFont(rawName, styles) {
        let fontFamily = 'Arial, sans-serif';
        let fontWeight = 'normal';
        let fontStyle = 'normal';

        if (!rawName) return { fontFamily, fontWeight, fontStyle };

        const nameUpper = rawName.toUpperCase();

        // 1. Detect bold / italic from the raw font name
        if (nameUpper.includes('BOLD') || nameUpper.includes('-BD') || nameUpper.includes('_BD')) {
            fontWeight = 'bold';
        }
        if (nameUpper.includes('ITALIC') || nameUpper.includes('OBLIQUE') ||
            nameUpper.includes('-IT') || nameUpper.includes('_IT')) {
            fontStyle = 'italic';
        }
        // Handle common shorthand like "BI" at end: "ArialMT-BI", "TimesBI"
        if (/[-_](BI|BOLDIT|BOLDITALIC|BOLDOBLIQUE)$/i.test(rawName) ||
            /[-_](DEMIBOLDIT|SEMIBOLD(IT|ITALIC)?)$/i.test(rawName)) {
            fontWeight = 'bold';
            fontStyle = 'italic';
        }

        // 2. Try to resolve from pdf.js styles metadata
        const styleInfo = styles && styles[rawName];
        if (styleInfo && styleInfo.fontFamily) {
            const generic = styleInfo.fontFamily.toLowerCase().trim();
            if (GENERIC_FAMILY_MAP[generic]) {
                // If it's a generic family, try to find a better match from the raw name first
                const mapped = matchFontFromName(rawName);
                fontFamily = mapped || GENERIC_FAMILY_MAP[generic];
            } else {
                // pdf.js gave us an actual family name — use it
                fontFamily = styleInfo.fontFamily + ', sans-serif';
            }
            return { fontFamily, fontWeight, fontStyle };
        }

        // 3. Fallback: try to match from the raw font name itself
        const mapped = matchFontFromName(rawName);
        if (mapped) {
            fontFamily = mapped;
        }

        return { fontFamily, fontWeight, fontStyle };
    }

    /**
     * Attempt to match a raw PDF font name against known font name patterns.
     * Strips suffixes like MT, PS, -Regular, -Bold, etc. and matches against PDF_FONT_MAP.
     * @param {string} rawName
     * @returns {string|null} CSS font-family string or null if no match
     */
    function matchFontFromName(rawName) {
        // Strip common PDF font name noise: prefixes like "ABCDEF+" and suffixes
        let clean = rawName
            .replace(/^[A-Z]{6}\+/, '')                    // subset prefix "ABCDEF+"
            .replace(/[-_]?(Regular|Normal|Roman|Book|Medium|Light|Thin|ExtraLight|SemiBold|DemiBold|Heavy|Black|Ultra|Condensed|Narrow|Expanded|Extended|Bold|Italic|Oblique|BoldItalic|BoldOblique|It|Bd|BI|MT|PS|PSMT|LT|EF)$/gi, '')
            .replace(/[-_]?(Regular|Normal|Roman|Book|Medium|Light|Bold|Italic|Oblique|BI|MT|PS)$/gi, '') // second pass
            .replace(/[\s\-_]/g, '')
            .toLowerCase();

        // Direct lookup
        if (PDF_FONT_MAP[clean]) {
            return PDF_FONT_MAP[clean];
        }

        // Partial matching: check if any known key is a prefix of the cleaned name
        for (const [key, css] of Object.entries(PDF_FONT_MAP)) {
            if (clean.startsWith(key) || key.startsWith(clean)) {
                return css;
            }
        }

        return null;
    }

    /* ========================================
       PAGE RENDERING
       ======================================== */
    async function renderCurrentPage() {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: DISPLAY_SCALE });
        const w = viewport.width;
        const h = viewport.height;
        pageDimensions[currentPage] = { w, h };

        // Render PDF page to offscreen canvas → dataURL
        if (!pageBackgrounds[currentPage]) {
            const offCanvas = document.createElement('canvas');
            offCanvas.width = w;
            offCanvas.height = h;
            const ctx = offCanvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            pageBackgrounds[currentPage] = offCanvas.toDataURL('image/png');
        }

        // Extract text content for Edit Text tool
        if (!pageTextItems[currentPage]) {
            try {
                const textContent = await page.getTextContent();
                const items = [];
                for (const item of textContent.items) {
                    if (!item.str || !item.str.trim()) continue;
                    const tx = item.transform;
                    // transform: [scaleX, skewY, skewX, scaleY, translateX, translateY]
                    const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]) * DISPLAY_SCALE;
                    const x = tx[4] * DISPLAY_SCALE;
                    const y = h - (tx[5] * DISPLAY_SCALE) - fontSize; // PDF Y is bottom-up
                    const textWidth = item.width * DISPLAY_SCALE;
                    const textHeight = item.height * DISPLAY_SCALE;

                    // Resolve font family, weight, and style from PDF font metadata
                    const resolved = resolvePdfFont(item.fontName, textContent.styles);

                    items.push({
                        str: item.str,
                        x: x,
                        y: y,
                        w: textWidth,
                        h: Math.max(textHeight, fontSize * 1.2),
                        fontSize: Math.round(fontSize),
                        fontFamily: resolved.fontFamily,
                        fontWeight: resolved.fontWeight,
                        fontStyle: resolved.fontStyle,
                        rawFontName: item.fontName || '',
                    });
                }
                pageTextItems[currentPage] = items;
            } catch (e) {
                console.warn('Could not extract text:', e);
                pageTextItems[currentPage] = [];
            }
        }

        // Setup fabric canvas
        const canvasEl = document.getElementById('pdfedCanvas');
        if (!canvasEl) return;

        if (fabricCanvas) {
            // Save current page annotations before switching
            // (already saved in switchPage)
            fabricCanvas.dispose();
        }

        fabricCanvas = new fabric.Canvas('pdfedCanvas', {
            width: w,
            height: h,
            backgroundColor: '#fff',
            selection: currentTool === 'select',
        });

        // Set PDF page as background
        await new Promise(resolve => {
            fabricCanvas.setBackgroundImage(pageBackgrounds[currentPage], () => {
                fabricCanvas.renderAll();
                resolve();
            }, { scaleX: 1, scaleY: 1 });
        });

        // Restore annotations for this page
        if (pageAnnotations[currentPage]) {
            suppressHistory = true;
            await new Promise(resolve => {
                fabricCanvas.loadFromJSON(pageAnnotations[currentPage], () => {
                    fabricCanvas.renderAll();
                    suppressHistory = false;
                    resolve();
                });
            });
            // Re-set background (loadFromJSON may overwrite)
            await new Promise(resolve => {
                fabricCanvas.setBackgroundImage(pageBackgrounds[currentPage], () => {
                    fabricCanvas.renderAll();
                    resolve();
                }, { scaleX: 1, scaleY: 1 });
            });
        }

        // Attach canvas events
        attachCanvasEvents();
        applyToolMode();
        saveHistoryState();
    }

    /* ========================================
       CANVAS EVENTS
       ======================================== */
    function attachCanvasEvents() {
        if (!fabricCanvas) return;

        fabricCanvas.on('object:added', () => { if (!suppressHistory) saveHistoryState(); });
        fabricCanvas.on('object:modified', () => { if (!suppressHistory) saveHistoryState(); });
        fabricCanvas.on('object:removed', () => { if (!suppressHistory) saveHistoryState(); });

        fabricCanvas.on('mouse:down', handleMouseDown);
        fabricCanvas.on('mouse:move', handleMouseMove);
        fabricCanvas.on('mouse:up', handleMouseUp);

        // When an edited text object is selected, populate the font controls
        fabricCanvas.on('selection:created', onObjectSelected);
        fabricCanvas.on('selection:updated', onObjectSelected);
        fabricCanvas.on('selection:cleared', onSelectionCleared);
    }

    function onObjectSelected(e) {
        if (currentTool !== 'edittext') return;
        const obj = e.selected?.[0] || fabricCanvas?.getActiveObject();
        if (obj && (obj.type === 'i-text' || obj.type === 'textbox')) {
            populateEditTextControls(obj);
        }
    }

    function onSelectionCleared() {
        if (currentTool !== 'edittext') return;
        // Hide font controls, show hint again
        const controls = document.querySelectorAll('.pdfed-edittext-controls');
        controls.forEach(el => el.style.display = 'none');
        const hint = document.querySelector('.pdfed-prop-hint-inline');
        if (hint) hint.style.display = '';
    }

    /**
     * Show the Edit Text font controls and populate them from the given Fabric text object.
     */
    function populateEditTextControls(textObj) {
        // Show the controls, hide the hint
        const controls = document.querySelectorAll('.pdfed-edittext-controls');
        controls.forEach(el => el.style.display = '');
        const hint = document.querySelector('.pdfed-prop-hint-inline');
        if (hint) hint.style.display = 'none';

        // Populate font dropdown — try to match the current fontFamily
        const fontSelect = document.getElementById('pdfedEditFont');
        if (fontSelect) {
            const objFamily = (textObj.fontFamily || '').toLowerCase();
            let matched = false;
            for (const opt of fontSelect.options) {
                if (opt.value.toLowerCase() === objFamily ||
                    objFamily.includes(opt.textContent.toLowerCase()) ||
                    opt.value.toLowerCase().includes(objFamily.split(',')[0].trim())) {
                    opt.selected = true;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                // Add a custom option for this font so it appears in the dropdown
                const customOpt = document.createElement('option');
                const displayName = textObj.fontFamily.split(',')[0].trim();
                customOpt.value = textObj.fontFamily;
                customOpt.textContent = displayName;
                customOpt.selected = true;
                fontSelect.insertBefore(customOpt, fontSelect.firstChild);
            }
        }

        // Populate size
        const sizeInput = document.getElementById('pdfedEditSize');
        if (sizeInput) sizeInput.value = Math.round(textObj.fontSize || 16);

        // Populate color
        const colorInput = document.getElementById('pdfedEditColor');
        if (colorInput) {
            const fill = textObj.fill || '#000000';
            // Convert named colors or rgb to hex if needed
            colorInput.value = fill.startsWith('#') ? fill : '#000000';
        }

        // Populate bold/italic toggles
        const boldBtn = document.getElementById('pdfedEditBold');
        if (boldBtn) boldBtn.classList.toggle('active', textObj.fontWeight === 'bold');

        const italicBtn = document.getElementById('pdfedEditItalic');
        if (italicBtn) italicBtn.classList.toggle('active', textObj.fontStyle === 'italic');
    }

    /* ---------- mouse handlers for shape / highlight / whiteout drawing ---------- */
    function handleMouseDown(opt) {
        if (currentTool === 'text' && !opt.target) {
            addTextAtPoint(opt);
            return;
        }

        if (currentTool === 'edittext' && !opt.target) {
            handleEditTextClick(opt);
            return;
        }

        const drawTools = ['shapes', 'highlight', 'whiteout'];
        if (!drawTools.includes(currentTool)) return;

        const pointer = fabricCanvas.getPointer(opt.e);
        shapeStart = { x: pointer.x, y: pointer.y };
        isDrawingShape = true;

        if (currentTool === 'shapes') {
            activeShape = createShape(props.shapeType, pointer);
        } else if (currentTool === 'highlight') {
            activeShape = new fabric.Rect({
                left: pointer.x, top: pointer.y, width: 1, height: 1,
                fill: props.highlightColor, opacity: props.highlightOpacity,
                stroke: '', strokeWidth: 0, selectable: true,
            });
        } else if (currentTool === 'whiteout') {
            activeShape = new fabric.Rect({
                left: pointer.x, top: pointer.y, width: 1, height: 1,
                fill: '#ffffff', opacity: 1,
                stroke: '', strokeWidth: 0, selectable: true,
            });
        }

        if (activeShape) {
            suppressHistory = true;
            fabricCanvas.add(activeShape);
            fabricCanvas.renderAll();
        }
    }

    function handleMouseMove(opt) {
        if (!isDrawingShape || !activeShape || !shapeStart) return;
        const pointer = fabricCanvas.getPointer(opt.e);
        const dx = pointer.x - shapeStart.x;
        const dy = pointer.y - shapeStart.y;

        if (activeShape.type === 'line' || activeShape.shapeId === 'arrow') {
            activeShape.set({ x2: pointer.x, y2: pointer.y });
            // Update arrowhead if arrow
            if (activeShape.shapeId === 'arrow' && activeShape._arrowHead) {
                updateArrowHead(activeShape, pointer);
            }
        } else if (activeShape.type === 'circle' || activeShape.type === 'ellipse') {
            const radius = Math.sqrt(dx * dx + dy * dy) / 2;
            activeShape.set({
                rx: Math.abs(dx) / 2,
                ry: Math.abs(dy) / 2,
                left: Math.min(shapeStart.x, pointer.x),
                top: Math.min(shapeStart.y, pointer.y),
            });
        } else {
            // Rect / highlight / whiteout
            activeShape.set({
                left: Math.min(shapeStart.x, pointer.x),
                top: Math.min(shapeStart.y, pointer.y),
                width: Math.abs(dx),
                height: Math.abs(dy),
            });
        }
        fabricCanvas.renderAll();
    }

    function handleMouseUp() {
        if (!isDrawingShape) return;
        isDrawingShape = false;

        // Remove if too small (accidental click)
        if (activeShape) {
            const minSize = 5;
            if (activeShape.type === 'line' || activeShape.shapeId === 'arrow') {
                const dx = (activeShape.x2 || 0) - (activeShape.x1 || 0);
                const dy = (activeShape.y2 || 0) - (activeShape.y1 || 0);
                if (Math.sqrt(dx * dx + dy * dy) < minSize) {
                    fabricCanvas.remove(activeShape);
                }
            } else {
                if ((activeShape.width || 0) < minSize && (activeShape.height || 0) < minSize) {
                    fabricCanvas.remove(activeShape);
                }
            }
        }

        suppressHistory = false;
        saveHistoryState();
        activeShape = null;
        shapeStart = null;
    }

    /* ---------- create shape ---------- */
    function createShape(type, pointer) {
        const common = { selectable: true };
        switch (type) {
            case 'rect':
                return new fabric.Rect({
                    ...common, left: pointer.x, top: pointer.y, width: 1, height: 1,
                    fill: props.shapeFill || 'transparent',
                    stroke: props.shapeStroke, strokeWidth: props.shapeStrokeWidth,
                });
            case 'circle':
                return new fabric.Ellipse({
                    ...common, left: pointer.x, top: pointer.y, rx: 1, ry: 1,
                    fill: props.shapeFill || 'transparent',
                    stroke: props.shapeStroke, strokeWidth: props.shapeStrokeWidth,
                });
            case 'line':
                return new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
                    ...common, stroke: props.shapeStroke, strokeWidth: props.shapeStrokeWidth,
                });
            case 'arrow': {
                const line = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
                    ...common, stroke: props.shapeStroke, strokeWidth: props.shapeStrokeWidth,
                });
                line.shapeId = 'arrow';
                return line;
            }
            default:
                return null;
        }
    }

    function updateArrowHead(line, pointer) {
        // Arrowhead is drawn at export time — we just keep the line for now
    }

    /* ---------- add text at click ---------- */
    function addTextAtPoint(opt) {
        const pointer = fabricCanvas.getPointer(opt.e);
        const text = new fabric.IText('Edit me', {
            left: pointer.x,
            top: pointer.y,
            fontSize: props.fontSize,
            fontFamily: props.fontFamily,
            fill: props.fontColor,
            fontWeight: props.fontBold ? 'bold' : 'normal',
            fontStyle: props.fontItalic ? 'italic' : 'normal',
            editable: true,
            selectable: true,
        });
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        fabricCanvas.renderAll();
    }

    /* ========================================
       EDIT EXISTING TEXT
       ======================================== */
    function handleEditTextClick(opt) {
        if (!fabricCanvas) return;
        const pointer = fabricCanvas.getPointer(opt.e);
        const items = pageTextItems[currentPage] || [];

        // Find which text item was clicked (with some padding tolerance)
        const PAD = 4;
        let clicked = null;
        for (const item of items) {
            if (pointer.x >= item.x - PAD && pointer.x <= item.x + item.w + PAD &&
                pointer.y >= item.y - PAD && pointer.y <= item.y + item.h + PAD) {
                clicked = item;
                break;
            }
        }

        if (!clicked) return;

        // Use only the clicked word/fragment — no merging across the line
        const blockX = clicked.x;
        const blockY = clicked.y;
        const blockW = clicked.w;
        const blockH = clicked.h;
        const blockFontSize = clicked.fontSize;
        const blockFontFamily = clicked.fontFamily;
        const blockFontWeight = clicked.fontWeight;
        const blockFontStyle = clicked.fontStyle;
        const mergedItems = [clicked];
        const mergedText = clicked.str;

        suppressHistory = true;

        // 1. Add white rectangle to cover original text
        const coverRect = new fabric.Rect({
            left: blockX - 2,
            top: blockY - 2,
            width: blockW + 4,
            height: blockH + 4,
            fill: '#ffffff',
            opacity: 1,
            stroke: '',
            strokeWidth: 0,
            selectable: false,
            evented: false,
            _isEditCover: true,
        });
        fabricCanvas.add(coverRect);

        // 2. Add editable IText on top — matching original font family, weight & style
        const editText = new fabric.IText(mergedText, {
            left: blockX,
            top: blockY,
            fontSize: blockFontSize,
            fontFamily: blockFontFamily,
            fontWeight: blockFontWeight,
            fontStyle: blockFontStyle,
            fill: '#000000',
            editable: true,
            selectable: true,
            _isEditedText: true,
            _coverRect: coverRect,
        });
        fabricCanvas.add(editText);

        // Remove these items from the detectable list so they can't be double-clicked
        pageTextItems[currentPage] = items.filter(it => !mergedItems.includes(it));

        suppressHistory = false;

        // Select and enter editing mode
        fabricCanvas.setActiveObject(editText);
        editText.enterEditing();
        editText.selectAll();
        fabricCanvas.renderAll();
        saveHistoryState();

        // Populate the font controls with the detected font properties
        populateEditTextControls(editText);
    }

    function showTextOverlay(show) {
        textOverlayVisible = show;
        const existing = document.getElementById('pdfedTextOverlay');
        if (existing) existing.remove();

        if (!show || !fabricCanvas) return;

        const items = pageTextItems[currentPage] || [];
        if (!items.length) return;

        const wrap = document.getElementById('pdfedCanvasWrap');
        if (!wrap) return;

        // Create overlay div inside the canvas wrap
        const canvasContainer = wrap.querySelector('.canvas-container');
        if (!canvasContainer) return;

        const overlay = document.createElement('div');
        overlay.id = 'pdfedTextOverlay';
        overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;';

        for (const item of items) {
            const highlight = document.createElement('div');
            highlight.style.cssText = `
                position:absolute;
                left:${item.x}px;top:${item.y}px;
                width:${item.w}px;height:${item.h}px;
                background:rgba(59,130,246,0.12);
                border:1px dashed rgba(59,130,246,0.5);
                border-radius:2px;
                pointer-events:none;
            `;
            overlay.appendChild(highlight);
        }

        canvasContainer.style.position = 'relative';
        canvasContainer.appendChild(overlay);
    }

    /* ========================================
       TOOLBAR SETUP
       ======================================== */
    function setupToolbar() {
        const toolsContainer = document.getElementById('pdfedTools');
        if (!toolsContainer) return;

        toolsContainer.addEventListener('click', e => {
            const btn = e.target.closest('.pdfed-tool-btn[data-tool]');
            if (!btn) return;
            const tool = btn.dataset.tool;

            // Handle sign → open modal
            if (tool === 'sign') { openSignatureModal(); return; }
            // Handle image → open file picker
            if (tool === 'image') { document.getElementById('pdfedImageInput')?.click(); return; }

            setActiveTool(tool);

            // Toggle shapes dropdown
            const dd = document.getElementById('pdfedShapesDropdown');
            if (dd) dd.style.display = tool === 'shapes' ? 'flex' : 'none';
        });

        // Shapes dropdown
        const shapesDD = document.getElementById('pdfedShapesDropdown');
        if (shapesDD) {
            shapesDD.addEventListener('click', e => {
                const opt = e.target.closest('.pdfed-shape-opt');
                if (!opt) return;
                shapesDD.querySelectorAll('.pdfed-shape-opt').forEach(b => b.classList.remove('active'));
                opt.classList.add('active');
                props.shapeType = opt.dataset.shape;
            });
        }

        // Delete button
        document.getElementById('pdfedDeleteBtn')?.addEventListener('click', deleteSelected);
        // Undo / Redo
        document.getElementById('pdfedUndoBtn')?.addEventListener('click', undo);
        document.getElementById('pdfedRedoBtn')?.addEventListener('click', redo);

        // Image file input
        document.getElementById('pdfedImageInput')?.addEventListener('change', handleImageUpload);
    }

    function setActiveTool(tool) {
        currentTool = tool;
        document.querySelectorAll('.pdfed-tool-btn[data-tool]').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === tool);
        });
        // Hide shapes dropdown if not shapes
        if (tool !== 'shapes') {
            const dd = document.getElementById('pdfedShapesDropdown');
            if (dd) dd.style.display = 'none';
        }
        applyToolMode();
        renderPropsBar();
    }

    function applyToolMode() {
        if (!fabricCanvas) return;

        // Reset drawing mode
        fabricCanvas.isDrawingMode = false;
        fabricCanvas.selection = false;
        fabricCanvas.defaultCursor = 'default';
        fabricCanvas.forEachObject(o => { o.selectable = false; o.evented = false; });

        // Hide text overlay unless in edittext mode
        if (currentTool !== 'edittext') showTextOverlay(false);

        switch (currentTool) {
            case 'select':
                fabricCanvas.selection = true;
                fabricCanvas.defaultCursor = 'default';
                fabricCanvas.forEachObject(o => { o.selectable = true; o.evented = true; });
                break;
            case 'edittext':
                fabricCanvas.defaultCursor = 'text';
                showTextOverlay(true);
                // Allow selecting already-edited text objects
                fabricCanvas.forEachObject(o => {
                    if (o.type === 'i-text' || o.type === 'textbox') {
                        o.selectable = true; o.evented = true;
                    }
                });
                break;
            case 'text':
                fabricCanvas.defaultCursor = 'text';
                fabricCanvas.forEachObject(o => {
                    if (o.type === 'i-text' || o.type === 'textbox') {
                        o.selectable = true; o.evented = true;
                    }
                });
                break;
            case 'eraser':
                fabricCanvas.isDrawingMode = true;
                fabricCanvas.freeDrawingBrush.color = '#ffffff';
                fabricCanvas.freeDrawingBrush.width = props.eraserWidth;
                fabricCanvas.defaultCursor = 'crosshair';
                break;
            case 'draw':
                fabricCanvas.isDrawingMode = true;
                fabricCanvas.freeDrawingBrush.color = props.drawColor;
                fabricCanvas.freeDrawingBrush.width = props.drawWidth;
                fabricCanvas.defaultCursor = 'crosshair';
                break;
            case 'highlight':
            case 'whiteout':
            case 'shapes':
                fabricCanvas.defaultCursor = 'crosshair';
                break;
            case 'image':
            case 'sign':
                break;
        }
    }

    /* ========================================
       PROPERTIES BAR
       ======================================== */
    function renderPropsBar() {
        const bar = document.getElementById('pdfedPropsBar');
        if (!bar) return;

        let html = '';
        switch (currentTool) {
            case 'text':
                html = `
                    <div class="pdfed-prop-group">
                        <label>Font</label>
                        <select id="pdfedPropFont" class="pdfed-prop-select">
                            <option value="Arial" ${props.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                            <option value="Helvetica" ${props.fontFamily === 'Helvetica' ? 'selected' : ''}>Helvetica</option>
                            <option value="Times New Roman" ${props.fontFamily === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                            <option value="Courier New" ${props.fontFamily === 'Courier New' ? 'selected' : ''}>Courier New</option>
                            <option value="Georgia" ${props.fontFamily === 'Georgia' ? 'selected' : ''}>Georgia</option>
                            <option value="Verdana" ${props.fontFamily === 'Verdana' ? 'selected' : ''}>Verdana</option>
                        </select>
                    </div>
                    <div class="pdfed-prop-group">
                        <label>Size</label>
                        <input type="number" id="pdfedPropSize" class="pdfed-prop-input-sm" value="${props.fontSize}" min="8" max="120">
                    </div>
                    <div class="pdfed-prop-group">
                        <label>Color</label>
                        <input type="color" id="pdfedPropColor" class="pdfed-prop-color" value="${props.fontColor}">
                    </div>
                    <div class="pdfed-prop-group pdfed-prop-toggles">
                        <button class="pdfed-prop-toggle ${props.fontBold ? 'active' : ''}" id="pdfedPropBold" title="Bold"><strong>B</strong></button>
                        <button class="pdfed-prop-toggle ${props.fontItalic ? 'active' : ''}" id="pdfedPropItalic" title="Italic"><em>I</em></button>
                    </div>
                `;
                break;
            case 'draw':
                html = `
                    <div class="pdfed-prop-group">
                        <label>Color</label>
                        <input type="color" id="pdfedPropDrawColor" class="pdfed-prop-color" value="${props.drawColor}">
                    </div>
                    <div class="pdfed-prop-group">
                        <label>Width</label>
                        <input type="range" id="pdfedPropDrawWidth" class="pdfed-prop-range" min="1" max="20" value="${props.drawWidth}">
                        <span class="pdfed-prop-val" id="pdfedDrawWidthVal">${props.drawWidth}px</span>
                    </div>
                `;
                break;
            case 'shapes':
                html = `
                    <div class="pdfed-prop-group">
                        <label>Stroke</label>
                        <input type="color" id="pdfedPropShapeStroke" class="pdfed-prop-color" value="${props.shapeStroke}">
                    </div>
                    <div class="pdfed-prop-group">
                        <label>Fill</label>
                        <input type="color" id="pdfedPropShapeFill" class="pdfed-prop-color" value="${props.shapeFill || '#ffffff'}">
                        <button class="pdfed-prop-toggle ${!props.shapeFill ? 'active' : ''}" id="pdfedPropNoFill" title="No fill">∅</button>
                    </div>
                    <div class="pdfed-prop-group">
                        <label>Width</label>
                        <input type="range" id="pdfedPropShapeWidth" class="pdfed-prop-range" min="1" max="10" value="${props.shapeStrokeWidth}">
                        <span class="pdfed-prop-val">${props.shapeStrokeWidth}px</span>
                    </div>
                `;
                break;
            case 'highlight':
                html = `
                    <div class="pdfed-prop-group">
                        <label>Color</label>
                        <input type="color" id="pdfedPropHighColor" class="pdfed-prop-color" value="${props.highlightColor}">
                    </div>
                    <div class="pdfed-prop-group">
                        <label>Opacity</label>
                        <input type="range" id="pdfedPropHighOpacity" class="pdfed-prop-range" min="10" max="70" value="${Math.round(props.highlightOpacity * 100)}">
                        <span class="pdfed-prop-val">${Math.round(props.highlightOpacity * 100)}%</span>
                    </div>
                `;
                break;
            case 'eraser':
                html = `
                    <div class="pdfed-prop-group">
                        <label>Size</label>
                        <input type="range" id="pdfedPropEraserWidth" class="pdfed-prop-range" min="5" max="80" value="${props.eraserWidth}">
                        <span class="pdfed-prop-val" id="pdfedEraserWidthVal">${props.eraserWidth}px</span>
                    </div>
                    <span class="pdfed-prop-hint">Paint over content to erase it</span>
                `;
                break;
            case 'edittext':
                html = `
                    <span class="pdfed-prop-hint pdfed-prop-hint-inline">💡 Click <strong>highlighted text</strong> to edit</span>
                    <div class="pdfed-prop-group pdfed-edittext-controls" id="pdfedEditTextControls" style="display:none;">
                        <label>Font</label>
                        <select id="pdfedEditFont" class="pdfed-prop-select">
                            <option value="Arial, Helvetica, sans-serif">Arial</option>
                            <option value="Helvetica, Arial, sans-serif">Helvetica</option>
                            <option value="Times New Roman, Times, serif">Times New Roman</option>
                            <option value="Courier New, Courier, monospace">Courier New</option>
                            <option value="Georgia, Times New Roman, serif">Georgia</option>
                            <option value="Verdana, Geneva, sans-serif">Verdana</option>
                            <option value="Calibri, Arial, sans-serif">Calibri</option>
                            <option value="Cambria, Georgia, serif">Cambria</option>
                            <option value="Tahoma, Geneva, sans-serif">Tahoma</option>
                            <option value="Trebuchet MS, sans-serif">Trebuchet MS</option>
                            <option value="Palatino Linotype, Book Antiqua, Palatino, serif">Palatino</option>
                            <option value="Garamond, Georgia, serif">Garamond</option>
                            <option value="Consolas, Courier New, monospace">Consolas</option>
                            <option value="Segoe UI, Tahoma, sans-serif">Segoe UI</option>
                            <option value="Roboto, Arial, sans-serif">Roboto</option>
                            <option value="Open Sans, Arial, sans-serif">Open Sans</option>
                        </select>
                    </div>
                    <div class="pdfed-prop-group pdfed-edittext-controls" style="display:none;">
                        <label>Size</label>
                        <input type="number" id="pdfedEditSize" class="pdfed-prop-input-sm" value="16" min="6" max="200">
                    </div>
                    <div class="pdfed-prop-group pdfed-edittext-controls" style="display:none;">
                        <label>Color</label>
                        <input type="color" id="pdfedEditColor" class="pdfed-prop-color" value="#000000">
                    </div>
                    <div class="pdfed-prop-group pdfed-prop-toggles pdfed-edittext-controls" style="display:none;">
                        <button class="pdfed-prop-toggle" id="pdfedEditBold" title="Bold"><strong>B</strong></button>
                        <button class="pdfed-prop-toggle" id="pdfedEditItalic" title="Italic"><em>I</em></button>
                    </div>
                `;
                break;
            case 'select':
                html = `<span class="pdfed-prop-hint">Click to select objects • Drag to move • Corners to resize</span>`;
                break;
            case 'whiteout':
                html = `<span class="pdfed-prop-hint">Click and drag to cover content with a white rectangle</span>`;
                break;
            default:
                html = '';
        }
        bar.innerHTML = html;
        bar.style.display = html ? 'flex' : 'none';
        attachPropsListeners();
    }

    function attachPropsListeners() {
        // Text props
        document.getElementById('pdfedPropFont')?.addEventListener('change', e => {
            props.fontFamily = e.target.value;
            updateSelectedText({ fontFamily: props.fontFamily });
        });
        document.getElementById('pdfedPropSize')?.addEventListener('input', e => {
            props.fontSize = parseInt(e.target.value) || 18;
            updateSelectedText({ fontSize: props.fontSize });
        });
        document.getElementById('pdfedPropColor')?.addEventListener('input', e => {
            props.fontColor = e.target.value;
            updateSelectedText({ fill: props.fontColor });
        });
        document.getElementById('pdfedPropBold')?.addEventListener('click', e => {
            props.fontBold = !props.fontBold;
            e.currentTarget.classList.toggle('active', props.fontBold);
            updateSelectedText({ fontWeight: props.fontBold ? 'bold' : 'normal' });
        });
        document.getElementById('pdfedPropItalic')?.addEventListener('click', e => {
            props.fontItalic = !props.fontItalic;
            e.currentTarget.classList.toggle('active', props.fontItalic);
            updateSelectedText({ fontStyle: props.fontItalic ? 'italic' : 'normal' });
        });

        // Draw props
        document.getElementById('pdfedPropDrawColor')?.addEventListener('input', e => {
            props.drawColor = e.target.value;
            if (fabricCanvas) fabricCanvas.freeDrawingBrush.color = props.drawColor;
        });
        document.getElementById('pdfedPropDrawWidth')?.addEventListener('input', e => {
            props.drawWidth = parseInt(e.target.value) || 3;
            if (fabricCanvas) fabricCanvas.freeDrawingBrush.width = props.drawWidth;
            const val = document.getElementById('pdfedDrawWidthVal');
            if (val) val.textContent = props.drawWidth + 'px';
        });

        // Shape props
        document.getElementById('pdfedPropShapeStroke')?.addEventListener('input', e => {
            props.shapeStroke = e.target.value;
        });
        document.getElementById('pdfedPropShapeFill')?.addEventListener('input', e => {
            props.shapeFill = e.target.value;
            const noFillBtn = document.getElementById('pdfedPropNoFill');
            if (noFillBtn) noFillBtn.classList.remove('active');
        });
        document.getElementById('pdfedPropNoFill')?.addEventListener('click', e => {
            props.shapeFill = '';
            e.currentTarget.classList.add('active');
        });
        document.getElementById('pdfedPropShapeWidth')?.addEventListener('input', e => {
            props.shapeStrokeWidth = parseInt(e.target.value) || 2;
        });

        // Highlight props
        document.getElementById('pdfedPropHighColor')?.addEventListener('input', e => {
            props.highlightColor = e.target.value;
        });
        document.getElementById('pdfedPropHighOpacity')?.addEventListener('input', e => {
            props.highlightOpacity = parseInt(e.target.value) / 100;
            const val = e.target.nextElementSibling;
            if (val) val.textContent = e.target.value + '%';
        });

        // Eraser props
        document.getElementById('pdfedPropEraserWidth')?.addEventListener('input', e => {
            props.eraserWidth = parseInt(e.target.value) || 20;
            if (fabricCanvas && fabricCanvas.isDrawingMode) {
                fabricCanvas.freeDrawingBrush.width = props.eraserWidth;
            }
            const val = document.getElementById('pdfedEraserWidthVal');
            if (val) val.textContent = props.eraserWidth + 'px';
        });

        // Edit Text font controls — update the active edited text object
        document.getElementById('pdfedEditFont')?.addEventListener('change', e => {
            updateSelectedText({ fontFamily: e.target.value });
        });
        document.getElementById('pdfedEditSize')?.addEventListener('input', e => {
            const size = parseInt(e.target.value) || 16;
            updateSelectedText({ fontSize: size });
        });
        document.getElementById('pdfedEditColor')?.addEventListener('input', e => {
            updateSelectedText({ fill: e.target.value });
        });
        document.getElementById('pdfedEditBold')?.addEventListener('click', e => {
            const obj = fabricCanvas?.getActiveObject();
            if (!obj) return;
            const isBold = obj.fontWeight === 'bold';
            const newWeight = isBold ? 'normal' : 'bold';
            e.currentTarget.classList.toggle('active', !isBold);
            updateSelectedText({ fontWeight: newWeight });
        });
        document.getElementById('pdfedEditItalic')?.addEventListener('click', e => {
            const obj = fabricCanvas?.getActiveObject();
            if (!obj) return;
            const isItalic = obj.fontStyle === 'italic';
            const newStyle = isItalic ? 'normal' : 'italic';
            e.currentTarget.classList.toggle('active', !isItalic);
            updateSelectedText({ fontStyle: newStyle });
        });
    }

    function updateSelectedText(changes) {
        if (!fabricCanvas) return;
        const obj = fabricCanvas.getActiveObject();
        if (obj && (obj.type === 'i-text' || obj.type === 'textbox')) {
            obj.set(changes);
            fabricCanvas.renderAll();
        }
    }

    /* ========================================
       IMAGE UPLOAD
       ======================================== */
    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (ev) {
            fabric.Image.fromURL(ev.target.result, img => {
                // Scale down if too large
                const maxW = fabricCanvas.width * 0.5;
                const maxH = fabricCanvas.height * 0.5;
                if (img.width > maxW || img.height > maxH) {
                    const scale = Math.min(maxW / img.width, maxH / img.height);
                    img.scale(scale);
                }
                img.set({
                    left: fabricCanvas.width / 2 - (img.getScaledWidth() / 2),
                    top: fabricCanvas.height / 2 - (img.getScaledHeight() / 2),
                    selectable: true,
                });
                fabricCanvas.add(img);
                fabricCanvas.setActiveObject(img);
                fabricCanvas.renderAll();
                setActiveTool('select');
            });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    /* ========================================
       SIGNATURE MODAL
       ======================================== */
    let signFabric = null;
    let signFont = "'Dancing Script', cursive";

    function setupSignatureModal() {
        document.getElementById('pdfedSignClose')?.addEventListener('click', closeSignatureModal);
        document.getElementById('pdfedSignCancel')?.addEventListener('click', closeSignatureModal);
        document.getElementById('pdfedSignApply')?.addEventListener('click', applySignature);
        document.getElementById('pdfedSignClear')?.addEventListener('click', () => {
            if (signFabric) { signFabric.clear(); signFabric.backgroundColor = '#fff'; signFabric.renderAll(); }
        });

        // Tab switching
        document.querySelectorAll('.pdfed-sign-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.pdfed-sign-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.pdfed-sign-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const panel = document.getElementById(tab.dataset.tab === 'draw' ? 'pdfedSignDraw' : 'pdfedSignType');
                if (panel) panel.classList.add('active');
            });
        });

        // Font selection
        document.querySelectorAll('.pdfed-sign-font').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pdfed-sign-font').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                signFont = btn.dataset.font;
                updateSignPreview();
            });
        });

        document.getElementById('pdfedSignText')?.addEventListener('input', updateSignPreview);

        // Close on overlay click
        document.getElementById('pdfedSignModal')?.addEventListener('click', e => {
            if (e.target.id === 'pdfedSignModal') closeSignatureModal();
        });
    }

    function openSignatureModal() {
        const modal = document.getElementById('pdfedSignModal');
        if (!modal) return;
        modal.style.display = 'flex';

        // Init signature canvas
        setTimeout(() => {
            if (!signFabric) {
                signFabric = new fabric.Canvas('pdfedSignCanvas', {
                    isDrawingMode: true,
                    backgroundColor: '#fff',
                    width: 460,
                    height: 180,
                });
                signFabric.freeDrawingBrush.color = '#1a1a2e';
                signFabric.freeDrawingBrush.width = 2.5;
            } else {
                signFabric.clear();
                signFabric.backgroundColor = '#fff';
                signFabric.renderAll();
            }
        }, 50);
    }

    function closeSignatureModal() {
        const modal = document.getElementById('pdfedSignModal');
        if (modal) modal.style.display = 'none';
    }

    function updateSignPreview() {
        const input = document.getElementById('pdfedSignText');
        const fonts = document.querySelectorAll('.pdfed-sign-font');
        if (!input) return;
        fonts.forEach(f => {
            f.textContent = input.value || 'Preview';
        });
    }

    function applySignature() {
        const activeTab = document.querySelector('.pdfed-sign-tab.active');
        const isDrawTab = activeTab?.dataset.tab === 'draw';

        if (isDrawTab) {
            // Get drawn signature as image
            if (!signFabric || signFabric.getObjects().length === 0) {
                alert('Please draw your signature first.');
                return;
            }
            const dataURL = signFabric.toDataURL({ format: 'png', multiplier: 2 });
            placeSignatureImage(dataURL);
        } else {
            // Typed signature
            const text = document.getElementById('pdfedSignText')?.value?.trim();
            if (!text) { alert('Please type your name.'); return; }
            const sigText = new fabric.IText(text, {
                left: fabricCanvas.width / 2 - 100,
                top: fabricCanvas.height / 2,
                fontSize: 36,
                fontFamily: signFont,
                fill: '#1a1a2e',
                editable: false,
                selectable: true,
            });
            fabricCanvas.add(sigText);
            fabricCanvas.setActiveObject(sigText);
            fabricCanvas.renderAll();
        }

        closeSignatureModal();
        setActiveTool('select');
    }

    function placeSignatureImage(dataURL) {
        fabric.Image.fromURL(dataURL, img => {
            const maxW = fabricCanvas.width * 0.35;
            if (img.width > maxW) img.scale(maxW / img.width);
            img.set({
                left: fabricCanvas.width / 2 - (img.getScaledWidth() / 2),
                top: fabricCanvas.height * 0.7,
                selectable: true,
            });
            fabricCanvas.add(img);
            fabricCanvas.setActiveObject(img);
            fabricCanvas.renderAll();
        });
    }

    /* ========================================
       UNDO / REDO
       ======================================== */
    function saveHistoryState() {
        if (suppressHistory || !fabricCanvas) return;
        const json = JSON.stringify(fabricCanvas.toJSON());
        // Avoid duplicates
        if (undoStack.length && undoStack[undoStack.length - 1] === json) return;
        undoStack.push(json);
        if (undoStack.length > 50) undoStack.shift();
        redoStack = [];
    }

    function undo() {
        if (undoStack.length <= 1 || !fabricCanvas) return;
        redoStack.push(undoStack.pop());
        const prevState = undoStack[undoStack.length - 1];
        restoreState(prevState);
    }

    function redo() {
        if (!redoStack.length || !fabricCanvas) return;
        const nextState = redoStack.pop();
        undoStack.push(nextState);
        restoreState(nextState);
    }

    function restoreState(jsonStr) {
        suppressHistory = true;
        fabricCanvas.loadFromJSON(jsonStr, () => {
            // Restore background
            fabricCanvas.setBackgroundImage(pageBackgrounds[currentPage], () => {
                fabricCanvas.renderAll();
                suppressHistory = false;
                applyToolMode();
            }, { scaleX: 1, scaleY: 1 });
        });
    }

    /* ========================================
       DELETE SELECTED
       ======================================== */
    function deleteSelected() {
        if (!fabricCanvas) return;
        const active = fabricCanvas.getActiveObjects();
        if (active.length) {
            active.forEach(obj => fabricCanvas.remove(obj));
            fabricCanvas.discardActiveObject();
            fabricCanvas.renderAll();
        }
    }

    /* ========================================
       PAGE NAVIGATION
       ======================================== */
    function setupBottomBar() {
        document.getElementById('pdfedPrevPage')?.addEventListener('click', () => switchPage(-1));
        document.getElementById('pdfedNextPage')?.addEventListener('click', () => switchPage(1));
        document.getElementById('pdfedSaveBtn')?.addEventListener('click', savePdf);
        document.getElementById('pdfedNewBtn')?.addEventListener('click', () => {
            if (fabricCanvas) { fabricCanvas.dispose(); fabricCanvas = null; }
            pdfDoc = null; pdfBytes = null;
            pageAnnotations = {}; pageBackgrounds = {}; pageDimensions = {};
            pageTextItems = {}; textOverlayVisible = false;
            undoStack = []; redoStack = [];
            const overlay = document.getElementById('pdfedTextOverlay');
            if (overlay) overlay.remove();
            showScreen('pdfedUpload');
        });
    }

    async function switchPage(delta) {
        const newPage = currentPage + delta;
        if (newPage < 1 || newPage > totalPages) return;

        // Save current page annotations
        if (fabricCanvas) {
            pageAnnotations[currentPage] = fabricCanvas.toJSON();
        }

        currentPage = newPage;
        undoStack = [];
        redoStack = [];
        await renderCurrentPage();
        updatePageInfo();
    }

    function updatePageInfo() {
        const el = document.getElementById('pdfedPageInfo');
        if (el) el.textContent = `${currentPage} / ${totalPages}`;
        const prev = document.getElementById('pdfedPrevPage');
        const next = document.getElementById('pdfedNextPage');
        if (prev) prev.disabled = currentPage <= 1;
        if (next) next.disabled = currentPage >= totalPages;
    }

    /* ========================================
       KEYBOARD SHORTCUTS
       ======================================== */
    function setupKeyboard() {
        document.addEventListener('keydown', e => {
            // Only if our editor is visible
            const editor = document.getElementById('pdfedEditor');
            if (!editor || editor.style.display === 'none') return;

            // Don't capture if typing in an input
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
            // Don't capture if editing text in fabric
            if (fabricCanvas?.getActiveObject()?.isEditing) return;

            const ctrl = e.ctrlKey || e.metaKey;

            if (ctrl && e.key === 'z') { e.preventDefault(); undo(); return; }
            if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); return; }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (fabricCanvas?.getActiveObject() && !fabricCanvas.getActiveObject().isEditing) {
                    e.preventDefault(); deleteSelected();
                }
                return;
            }

            // Tool shortcuts
            if (!ctrl && !e.altKey) {
                switch (e.key.toUpperCase()) {
                    case 'V': setActiveTool('select'); break;
                    case 'E': setActiveTool('edittext'); break;
                    case 'T': setActiveTool('text'); break;
                    case 'R': setActiveTool('eraser'); break;
                    case 'D': setActiveTool('draw'); break;
                    case 'H': setActiveTool('highlight'); break;
                    case 'S': setActiveTool('shapes'); break;
                    case 'W': setActiveTool('whiteout'); break;
                    case 'I': setActiveTool('image'); break;
                }
            }
        });
    }

    /* ========================================
       SAVE / EXPORT PDF
       ======================================== */
    /**
     * Check if a page has any real annotations (not just empty JSON).
     */
    function pageHasAnnotations(pageNum) {
        const annot = pageAnnotations[pageNum];
        if (!annot) return false;
        const objects = annot.objects || [];
        return objects.length > 0;
    }

    async function savePdf() {
        if (isSaving || !fabricCanvas || !pdfDoc) return;
        isSaving = true;

        const saveBtn = document.getElementById('pdfedSaveBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner"></span> Saving...';
        }

        try {
            // Save current page annotations
            pageAnnotations[currentPage] = fabricCanvas.toJSON();

            // Load original PDF bytes into pdf-lib to preserve quality
            const srcPdfDoc = await pdfLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
            const newPdfDoc = await pdfLib.PDFDocument.create();

            for (let p = 1; p <= totalPages; p++) {
                if (!pageHasAnnotations(p)) {
                    // No annotations — copy original page as-is (preserves vectors, text, quality)
                    const [copiedPage] = await newPdfDoc.copyPages(srcPdfDoc, [p - 1]);
                    newPdfDoc.addPage(copiedPage);
                } else {
                    // This page has annotations — we need to overlay them
                    // First copy the original page to preserve its content
                    const [copiedPage] = await newPdfDoc.copyPages(srcPdfDoc, [p - 1]);
                    newPdfDoc.addPage(copiedPage);
                    const targetPage = newPdfDoc.getPage(newPdfDoc.getPageCount() - 1);
                    const { width: pgW, height: pgH } = targetPage.getSize();

                    // Render annotations only (no background) at high resolution
                    const ANNOT_SCALE = 3; // 3x for crisp annotation rendering
                    const annotW = pgW * ANNOT_SCALE;
                    const annotH = pgH * ANNOT_SCALE;

                    const dim = pageDimensions[p] || { w: pgW * DISPLAY_SCALE, h: pgH * DISPLAY_SCALE };
                    const scaleRatio = annotW / dim.w;

                    // Create temp fabric canvas to render annotations on transparent bg
                    const tempCanvasEl = document.createElement('canvas');
                    tempCanvasEl.id = 'pdfed_temp_' + p;
                    tempCanvasEl.style.display = 'none';
                    document.body.appendChild(tempCanvasEl);

                    const tempFabric = new fabric.StaticCanvas(tempCanvasEl.id, {
                        width: annotW,
                        height: annotH,
                        backgroundColor: null,  // transparent
                    });

                    await new Promise(resolve => {
                        tempFabric.loadFromJSON(pageAnnotations[p], () => {
                            // Scale all objects to annotation resolution
                            tempFabric.getObjects().forEach(obj => {
                                obj.set({
                                    left: (obj.left || 0) * scaleRatio,
                                    top: (obj.top || 0) * scaleRatio,
                                    scaleX: (obj.scaleX || 1) * scaleRatio,
                                    scaleY: (obj.scaleY || 1) * scaleRatio,
                                });
                                if (obj.type === 'i-text' || obj.type === 'textbox') {
                                    obj.set({ fontSize: (obj.fontSize || 18) * scaleRatio });
                                    obj.set({
                                        scaleX: (obj.scaleX || scaleRatio) / scaleRatio,
                                        scaleY: (obj.scaleY || scaleRatio) / scaleRatio,
                                    });
                                }
                                if (obj.strokeWidth) {
                                    obj.set({ strokeWidth: obj.strokeWidth * scaleRatio });
                                }
                                obj.setCoords();
                            });
                            // Set transparent background
                            tempFabric.backgroundColor = null;
                            tempFabric.renderAll();
                            resolve();
                        });
                    });

                    // Get annotation overlay as PNG with transparency
                    const annotCanvas = tempFabric.toCanvasElement();
                    const annotDataUrl = annotCanvas.toDataURL('image/png');
                    const annotBytes = await fetch(annotDataUrl).then(r => r.arrayBuffer());
                    const annotImage = await newPdfDoc.embedPng(annotBytes);

                    // Draw annotation overlay on top of the original page content
                    targetPage.drawImage(annotImage, {
                        x: 0,
                        y: 0,
                        width: pgW,
                        height: pgH,
                    });

                    tempFabric.dispose();
                    tempCanvasEl.remove();
                }
            }

            const pdfBytesOut = await newPdfDoc.save();
            const blob = new Blob([pdfBytesOut], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'edited.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (err) {
            console.error('Save PDF error:', err);
            alert('Failed to save PDF: ' + err.message);
        }

        isSaving = false;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Save &amp; Download PDF
            `;
        }
    }

})();
