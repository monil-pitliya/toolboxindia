/* =============================================
   ToolBox India — Word to PDF Converter

   Converts Word (.docx) files to PDF.
   Parses the DOCX (ZIP with XML + media),
   renders pages to canvas via layout engine,
   and generates PDF with jsPDF.

   100% client-side. Zero server uploads.
   ============================================= */

(function () {
    'use strict';

    // ===== State =====
    let docxFile = null;
    let parsedDoc = null;       // { paragraphs[], images{}, pageW, pageH, ... }
    let renderedPages = [];     // data URL per page
    let pdfBlob = null;
    let isConverting = false;
    let JSZipLib = null;
    let jsPDFLib = null;

    // Constants
    const PT_PER_INCH = 72;
    const EMU_PER_INCH = 914400;
    const TWIP_PER_PT = 20;

    // Default page: A4
    const DEFAULT_PAGE = { w: 595.28, h: 841.89, mt: 72, mb: 72, ml: 72, mr: 72 };

    // ===== Register Tool =====
    ToolRegistry.register('word-to-pdf', {
        title: 'Word to PDF',
        description: 'Convert Word (.docx) documents to PDF — preserves text, formatting, images & tables.',
        category: 'Converter Tools',
        tags: ['word to pdf', 'docx to pdf', 'convert word to pdf', 'doc to pdf', 'word converter', 'document to pdf', 'docx converter'],

        render() {
            return `
                <div class="w2p-info-banner" id="w2pInfoBanner">
                    <span class="w2p-info-icon">📝</span>
                    <div>
                        <strong>100% Private</strong> — Your document is converted entirely in your browser. Nothing is uploaded anywhere.
                    </div>
                </div>

                <!-- Upload -->
                <div id="w2pUploadSection">
                    <div class="tool-workspace">
                        <div class="drop-zone" id="w2pDropZone">
                            <span class="drop-zone-icon">📝 → 📄</span>
                            <h3 class="drop-zone-title">Drop Word document here</h3>
                            <p class="drop-zone-subtitle">Convert your .docx file to a high-quality PDF document</p>
                            <button class="drop-zone-btn" onclick="document.getElementById('w2pFileInput').click()">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                Choose DOCX File
                            </button>
                            <input type="file" id="w2pFileInput" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
                            <p class="drop-zone-info">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                .docx files only &bull; Text, images &amp; formatting preserved
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Preview -->
                <div id="w2pPreviewSection" style="display:none;">
                    <div class="w2p-file-info">
                        <div class="w2p-file-card">
                            <div class="w2p-file-icon">📝</div>
                            <div class="w2p-file-details">
                                <span class="w2p-file-name" id="w2pFileName">document.docx</span>
                                <span class="w2p-file-meta" id="w2pFileMeta">3 pages • 245 KB</span>
                            </div>
                            <button class="w2p-change-btn" onclick="document.getElementById('w2pFileInput').click()">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                Change File
                            </button>
                        </div>
                    </div>

                    <!-- Settings -->
                    <div class="w2p-settings">
                        <div class="w2p-setting-row">
                            <div class="w2p-setting-group">
                                <label class="w2p-label">Page Size</label>
                                <div class="w2p-options" id="w2pPageSize">
                                    <button class="w2p-option active" data-value="a4">A4</button>
                                    <button class="w2p-option" data-value="letter">Letter</button>
                                    <button class="w2p-option" data-value="legal">Legal</button>
                                </div>
                            </div>
                            <div class="w2p-setting-group">
                                <label class="w2p-label">Quality</label>
                                <div class="w2p-options" id="w2pQuality">
                                    <button class="w2p-option" data-value="1">Standard</button>
                                    <button class="w2p-option active" data-value="2">High</button>
                                    <button class="w2p-option" data-value="3">Ultra</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Page Previews -->
                    <div class="w2p-pages-header">
                        <h3 id="w2pPageCount">0 pages</h3>
                    </div>
                    <div class="w2p-pages-grid" id="w2pPagesGrid"></div>

                    <!-- Convert -->
                    <div class="w2p-convert-area">
                        <button class="btn-primary w2p-convert-btn" id="w2pConvertBtn">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            Convert to PDF
                        </button>
                        <button class="btn-secondary" id="w2pClearBtn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                            Clear
                        </button>
                    </div>
                </div>

                <!-- Converting -->
                <div id="w2pConvertingSection" style="display:none;">
                    <div class="w2p-converting-card">
                        <div class="w2p-spinner"></div>
                        <h3>Converting to PDF...</h3>
                        <p id="w2pConvertStatus">Parsing document...</p>
                        <div class="w2p-progress-bar">
                            <div class="w2p-progress-fill" id="w2pProgressFill" style="width:0%"></div>
                        </div>
                        <span class="w2p-progress-text" id="w2pProgressText">0%</span>
                    </div>
                </div>

                <!-- Done -->
                <div id="w2pDoneSection" style="display:none;">
                    <div class="w2p-done-card">
                        <div class="w2p-done-icon">✅</div>
                        <h3>PDF Ready!</h3>
                        <p id="w2pDoneInfo">3 pages • 180 KB</p>
                        <div class="w2p-done-actions">
                            <button class="btn-success w2p-download-btn" id="w2pDownloadBtn">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                Download PDF
                            </button>
                            <button class="btn-secondary" id="w2pStartOver">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                                Convert Another
                            </button>
                        </div>
                        <div id="w2pChainActions"></div>
                    </div>
                </div>
            `;
        },

        init() {
            initW2P();
        },

        destroy() {
            docxFile = null;
            parsedDoc = null;
            renderedPages = [];
            pdfBlob = null;
            isConverting = false;
        }
    });

    // ===== Initialise =====
    function initW2P() {
        setTimeout(() => {
            const dropZone = document.getElementById('w2pDropZone');
            const fileInput = document.getElementById('w2pFileInput');
            if (!dropZone || !fileInput) return;

            dropZone.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length) handleDocxFile(e.target.files[0]);
            });

            ['dragenter', 'dragover'].forEach(ev => {
                dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
            });
            ['dragleave', 'drop'].forEach(ev => {
                dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
            });
            dropZone.addEventListener('drop', (e) => {
                const f = e.dataTransfer.files[0];
                if (f && (f.name.endsWith('.docx') || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
                    handleDocxFile(f);
                } else { alert('Please drop a .docx file'); }
            });

            document.querySelectorAll('.w2p-options').forEach(group => {
                group.addEventListener('click', (e) => {
                    const btn = e.target.closest('.w2p-option');
                    if (!btn) return;
                    group.querySelectorAll('.w2p-option').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });

            const convertBtn = document.getElementById('w2pConvertBtn');
            if (convertBtn) convertBtn.addEventListener('click', convertToPDF);

            const clearBtn = document.getElementById('w2pClearBtn');
            if (clearBtn) clearBtn.addEventListener('click', resetTool);

            const dlBtn = document.getElementById('w2pDownloadBtn');
            if (dlBtn) dlBtn.addEventListener('click', () => {
                if (pdfBlob) {
                    const name = (docxFile ? docxFile.name.replace(/\.docx$/i, '') : 'document') + '.pdf';
                    ToolUtils.downloadBlob(pdfBlob, name);
                }
            });

            const startOver = document.getElementById('w2pStartOver');
            if (startOver) startOver.addEventListener('click', resetTool);

            // ToolChain: consume a pending chained file (e.g. from another tool)
            if (window.ToolChain && ToolChain.hasPending()) {
                const chained = ToolChain.consumePending();
                if (chained && chained.blob) {
                    ToolChain.injectBackBanner(document.getElementById('toolContent'));
                    const file = ToolChain.blobToFile(chained.blob, chained.name || 'document.docx');
                    setTimeout(() => handleDocxFile(file), 100);
                }
            }
        }, 100);
    }

    // ===== Load Libraries =====
    function loadJSZip() {
        return new Promise((resolve, reject) => {
            if (window.JSZip) { JSZipLib = window.JSZip; return resolve(); }
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
            s.onload = () => { JSZipLib = window.JSZip; resolve(); };
            s.onerror = () => reject(new Error('Failed to load JSZip'));
            document.head.appendChild(s);
        });
    }

    function loadJsPDF() {
        return new Promise((resolve, reject) => {
            if (window.jspdf) { jsPDFLib = window.jspdf.jsPDF; return resolve(); }
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
            s.onload = () => { jsPDFLib = window.jspdf.jsPDF; resolve(); };
            s.onerror = () => reject(new Error('Failed to load jsPDF'));
            document.head.appendChild(s);
        });
    }

    // ===== Page sizes =====
    function getPageDimensions(key) {
        switch (key) {
            case 'letter': return { w: 612, h: 792 };
            case 'legal':  return { w: 612, h: 1008 };
            default:       return { w: 595.28, h: 841.89 }; // A4
        }
    }

    // ===== Handle DOCX =====
    async function handleDocxFile(file) {
        docxFile = file;
        parsedDoc = null;
        renderedPages = [];
        pdfBlob = null;

        showSection('converting');
        updateStatus('Loading libraries...');
        updateProgress(0);

        try {
            await loadJSZip();
            updateStatus('Parsing document...');
            updateProgress(5);

            const zip = await JSZipLib.loadAsync(file);

            // ----- Extract media -----
            const media = {};
            for (const path of Object.keys(zip.files)) {
                if (path.startsWith('word/media/')) {
                    const data = await zip.files[path].async('base64');
                    const ext = path.split('.').pop().toLowerCase();
                    const mime = ext === 'png' ? 'image/png' :
                                 ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                                 ext === 'gif' ? 'image/gif' :
                                 ext === 'bmp' ? 'image/bmp' :
                                 ext === 'svg' ? 'image/svg+xml' :
                                 ext === 'tiff' || ext === 'tif' ? 'image/tiff' :
                                 ext === 'emf' ? 'image/x-emf' :
                                 ext === 'wmf' ? 'image/x-wmf' :
                                 'image/png';
                    media[path] = `data:${mime};base64,${data}`;
                }
            }

            // ----- Parse relationships -----
            const rels = {};
            try {
                const relsXml = await zip.files['word/_rels/document.xml.rels'].async('text');
                const rDoc = new DOMParser().parseFromString(relsXml, 'application/xml');
                rDoc.querySelectorAll('Relationship').forEach(r => {
                    rels[r.getAttribute('Id')] = {
                        type: r.getAttribute('Type'),
                        target: r.getAttribute('Target')
                    };
                });
            } catch (e) { /* no rels */ }

            updateProgress(15);

            // ----- Parse styles.xml for default font / size -----
            let defaultFont = 'Calibri';
            let defaultSize = 11;
            try {
                const stylesXml = await zip.files['word/styles.xml'].async('text');
                const sDom = new DOMParser().parseFromString(stylesXml, 'application/xml');
                const docDefaults = sDom.querySelector('docDefaults');
                if (docDefaults) {
                    const rPr = docDefaults.querySelector('rPrDefault rPr');
                    if (rPr) {
                        const rFonts = rPr.querySelector('rFonts');
                        if (rFonts) defaultFont = rFonts.getAttribute('w:ascii') || rFonts.getAttribute('ascii') || defaultFont;
                        const sz = rPr.querySelector('sz');
                        if (sz) {
                            const v = parseInt(getWVal(sz));
                            if (v) defaultSize = v / 2;
                        }
                    }
                }
            } catch (e) { /* use defaults */ }

            // ----- Parse numbering.xml -----
            let numberingMap = {};
            try {
                const numXml = await zip.files['word/numbering.xml'].async('text');
                numberingMap = parseNumberingXml(numXml);
            } catch (e) { /* no numbering */ }

            // ----- Parse document.xml -----
            const docXml = await zip.files['word/document.xml'].async('text');
            const dom = new DOMParser().parseFromString(docXml, 'application/xml');

            // Page setup from sectPr
            let page = { ...DEFAULT_PAGE };
            const sectPr = dom.querySelector('body sectPr') || dom.querySelector('sectPr');
            if (sectPr) {
                const pgSz = sectPr.querySelector('pgSz');
                if (pgSz) {
                    const wVal = parseInt(getWVal2(pgSz, 'w'));
                    const hVal = parseInt(getWVal2(pgSz, 'h'));
                    if (wVal) page.w = wVal / TWIP_PER_PT;
                    if (hVal) page.h = hVal / TWIP_PER_PT;
                }
                const pgMar = sectPr.querySelector('pgMar');
                if (pgMar) {
                    const mt = parseInt(getWVal2(pgMar, 'top'));
                    const mb = parseInt(getWVal2(pgMar, 'bottom'));
                    const ml = parseInt(getWVal2(pgMar, 'left'));
                    const mr = parseInt(getWVal2(pgMar, 'right'));
                    if (mt) page.mt = mt / TWIP_PER_PT;
                    if (mb) page.mb = mb / TWIP_PER_PT;
                    if (ml) page.ml = ml / TWIP_PER_PT;
                    if (mr) page.mr = mr / TWIP_PER_PT;
                }
            }

            updateProgress(25);
            updateStatus('Extracting content...');

            // ----- Parse body content -----
            const body = dom.querySelector('body');
            const paragraphs = [];
            const listCounters = {};

            for (const child of body.children) {
                const tag = child.localName || child.tagName.split(':').pop();
                if (tag === 'p') {
                    paragraphs.push(parseParagraph(child, rels, media, defaultFont, defaultSize, numberingMap, listCounters));
                } else if (tag === 'tbl') {
                    paragraphs.push(parseTable(child, rels, media, defaultFont, defaultSize));
                } else if (tag === 'sectPr') {
                    // section break — skip
                }
            }

            updateProgress(40);
            updateStatus('Rendering preview...');

            parsedDoc = { paragraphs, images: media, page, defaultFont, defaultSize };

            // Render preview pages
            renderedPages = await renderDocumentToPages(parsedDoc, 1);

            showSection('preview');
            renderPagePreviews();

        } catch (err) {
            console.error('DOCX parsing failed:', err);
            alert('Failed to parse this DOCX file. It may be corrupted or use an unsupported format.\n\nError: ' + err.message);
            resetTool();
        }
    }

    // ===== Attribute helpers (w:val) =====
    function getWVal(el) {
        return el.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'val')
            || el.getAttribute('w:val')
            || el.getAttribute('val')
            || '';
    }
    function getWVal2(el, attr) {
        return el.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', attr)
            || el.getAttribute('w:' + attr)
            || el.getAttribute(attr)
            || '';
    }

    // ===== Parse numbering.xml =====
    function parseNumberingXml(xml) {
        const dom = new DOMParser().parseFromString(xml, 'application/xml');
        const abstractNums = {};
        const numMap = {};

        dom.querySelectorAll('abstractNum').forEach(an => {
            const id = getWVal2(an, 'abstractNumId') || an.getAttribute('w:abstractNumId');
            const levels = {};
            an.querySelectorAll('lvl').forEach(lvl => {
                const ilvl = getWVal2(lvl, 'ilvl') || lvl.getAttribute('w:ilvl') || '0';
                const numFmt = lvl.querySelector('numFmt');
                const lvlText = lvl.querySelector('lvlText');
                levels[ilvl] = {
                    format: numFmt ? getWVal(numFmt) : 'bullet',
                    text: lvlText ? getWVal(lvlText) : '•'
                };
            });
            abstractNums[id] = levels;
        });

        dom.querySelectorAll('num').forEach(n => {
            const numId = getWVal2(n, 'numId') || n.getAttribute('w:numId');
            const abRef = n.querySelector('abstractNumId');
            if (abRef) {
                const abId = getWVal(abRef);
                numMap[numId] = abstractNums[abId] || {};
            }
        });

        return numMap;
    }

    // ===== Parse paragraph =====
    function parseParagraph(pEl, rels, media, defaultFont, defaultSize, numberingMap, listCounters) {
        const para = {
            type: 'paragraph',
            runs: [],
            align: 'left',
            indent: 0,
            spaceBefore: 0,
            spaceAfter: 8,
            lineSpacing: 1.15,
            bullet: null,
            heading: null,
            pageBreakBefore: false,
        };

        // Paragraph properties
        const pPr = pEl.querySelector(':scope > pPr');
        if (pPr) {
            // Alignment
            const jc = pPr.querySelector('jc');
            if (jc) {
                const v = getWVal(jc);
                if (v === 'center') para.align = 'center';
                else if (v === 'right' || v === 'end') para.align = 'right';
                else if (v === 'both') para.align = 'justify';
            }

            // Indentation
            const ind = pPr.querySelector('ind');
            if (ind) {
                const left = parseInt(getWVal2(ind, 'left') || getWVal2(ind, 'start') || '0');
                if (left) para.indent = left / TWIP_PER_PT;
            }

            // Spacing
            const spacing = pPr.querySelector('spacing');
            if (spacing) {
                const before = parseInt(getWVal2(spacing, 'before') || '0');
                const after = parseInt(getWVal2(spacing, 'after') || '0');
                const line = parseInt(getWVal2(spacing, 'line') || '0');
                if (before) para.spaceBefore = before / TWIP_PER_PT;
                if (after) para.spaceAfter = after / TWIP_PER_PT;
                if (line) para.lineSpacing = line / 240; // 240 twips = single spacing
            }

            // Heading style
            const pStyle = pPr.querySelector('pStyle');
            if (pStyle) {
                const styleId = getWVal(pStyle);
                if (/^Heading1|heading 1$/i.test(styleId)) para.heading = 1;
                else if (/^Heading2|heading 2$/i.test(styleId)) para.heading = 2;
                else if (/^Heading3|heading 3$/i.test(styleId)) para.heading = 3;
                else if (/^Heading4|heading 4$/i.test(styleId)) para.heading = 4;
                else if (/^Title$/i.test(styleId)) para.heading = 0; // Title
                else if (/^ListParagraph$/i.test(styleId)) {
                    // list paragraph — check numPr below
                }
            }

            // Numbering / bullet
            const numPr = pPr.querySelector('numPr');
            if (numPr) {
                const numId = numPr.querySelector('numId');
                const ilvl = numPr.querySelector('ilvl');
                const nId = numId ? getWVal(numId) : '0';
                const lvl = ilvl ? getWVal(ilvl) : '0';

                if (nId !== '0') {
                    const numDef = numberingMap[nId];
                    const lvlDef = numDef ? numDef[lvl] : null;

                    if (lvlDef && lvlDef.format !== 'bullet' && lvlDef.format !== 'none') {
                        // Numbered list
                        const key = nId + '_' + lvl;
                        listCounters[key] = (listCounters[key] || 0) + 1;
                        para.bullet = listCounters[key] + '.';
                    } else {
                        // Bullet list
                        const bullets = ['•', '◦', '▪', '–'];
                        para.bullet = bullets[Math.min(parseInt(lvl), bullets.length - 1)];
                    }

                    para.indent = Math.max(para.indent, 18 + parseInt(lvl) * 18);
                }
            }

            // Page break before
            const pgBr = pPr.querySelector('pageBreakBefore');
            if (pgBr) {
                const v = getWVal(pgBr);
                para.pageBreakBefore = v !== '0' && v !== 'false';
            }
        }

        // Apply heading styles
        if (para.heading !== null) {
            const headingSizes = [28, 24, 18, 15, 13];
            para._defaultFontSize = headingSizes[para.heading] || defaultSize;
            para._defaultBold = true;
            if (para.heading <= 1) para.spaceAfter = Math.max(para.spaceAfter, 12);
            if (para.heading <= 1) para.spaceBefore = Math.max(para.spaceBefore, 18);
        }

        // Parse runs
        for (const child of pEl.children) {
            const tag = child.localName || child.tagName.split(':').pop();

            if (tag === 'r') {
                const run = parseRun(child, rels, media, defaultFont, para._defaultFontSize || defaultSize, para._defaultBold || false);
                if (run) para.runs.push(run);
            } else if (tag === 'hyperlink') {
                // Process runs inside hyperlink
                for (const hChild of child.children) {
                    const ht = hChild.localName || hChild.tagName.split(':').pop();
                    if (ht === 'r') {
                        const run = parseRun(hChild, rels, media, defaultFont, para._defaultFontSize || defaultSize, false);
                        if (run) {
                            run.color = run.color || '#0563C1';
                            run.underline = true;
                            para.runs.push(run);
                        }
                    }
                }
            }
        }

        return para;
    }

    // ===== Parse a run =====
    function parseRun(rEl, rels, media, defaultFont, defaultSize, defaultBold) {
        const rPr = rEl.querySelector(':scope > rPr');

        let fontSize = defaultSize;
        let fontFamily = defaultFont;
        let bold = defaultBold || false;
        let italic = false;
        let underline = false;
        let strikethrough = false;
        let color = '#000000';
        let highlight = null;
        let superscript = false;
        let subscript = false;

        if (rPr) {
            const sz = rPr.querySelector('sz');
            if (sz) { const v = parseInt(getWVal(sz)); if (v) fontSize = v / 2; }

            const rFonts = rPr.querySelector('rFonts');
            if (rFonts) {
                fontFamily = rFonts.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'ascii')
                    || rFonts.getAttribute('w:ascii')
                    || rFonts.getAttribute('ascii')
                    || fontFamily;
            }

            const b = rPr.querySelector('b');
            if (b) { const v = getWVal(b); bold = v !== '0' && v !== 'false'; }

            const i = rPr.querySelector('i');
            if (i) { const v = getWVal(i); italic = v !== '0' && v !== 'false'; }

            const u = rPr.querySelector('u');
            if (u) { const v = getWVal(u); underline = v && v !== 'none'; }

            const strike = rPr.querySelector('strike');
            if (strike) { const v = getWVal(strike); strikethrough = v !== '0' && v !== 'false'; }

            const clr = rPr.querySelector('color');
            if (clr) {
                const v = getWVal(clr);
                if (v && v !== 'auto') color = '#' + v;
            }

            const hl = rPr.querySelector('highlight');
            if (hl) highlight = wordHighlightToHex(getWVal(hl));

            const vertAlign = rPr.querySelector('vertAlign');
            if (vertAlign) {
                const v = getWVal(vertAlign);
                if (v === 'superscript') superscript = true;
                if (v === 'subscript') subscript = true;
            }
        }

        // Check for image (drawing / picture)
        const drawing = rEl.querySelector('drawing');
        if (drawing) {
            return parseDrawing(drawing, rels, media);
        }

        // Check for legacy VML images (pict)
        const pict = rEl.querySelector('pict');
        if (pict) {
            // Skip VML for now
            return null;
        }

        // Text
        const t = rEl.querySelector('t');
        const br = rEl.querySelector('br');

        if (br) {
            const brType = getWVal2(br, 'type');
            if (brType === 'page') {
                return { type: 'pagebreak' };
            }
            return { type: 'text', text: '\n', fontSize, fontFamily, bold, italic, underline, strikethrough, color, highlight, superscript, subscript };
        }

        if (!t) return null;

        return {
            type: 'text',
            text: t.textContent,
            fontSize,
            fontFamily: sanitizeFont(fontFamily),
            bold,
            italic,
            underline,
            strikethrough,
            color,
            highlight,
            superscript,
            subscript
        };
    }

    // ===== Parse drawing (image) =====
    function parseDrawing(drawing, rels, media) {
        // inline or anchor
        const inline = drawing.querySelector('inline') || drawing.querySelector('anchor');
        if (!inline) return null;

        const ext = inline.querySelector('extent');
        let widthEmu = ext ? parseInt(ext.getAttribute('cx') || '0') : 0;
        let heightEmu = ext ? parseInt(ext.getAttribute('cy') || '0') : 0;

        // Find blip
        const blip = inline.querySelector('blip');
        if (!blip) return null;

        const rEmbed = blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed')
                     || blip.getAttribute('r:embed');
        if (!rEmbed) return null;

        const rel = rels[rEmbed];
        if (!rel) return null;

        let mediaPath = rel.target;
        if (!mediaPath.startsWith('word/')) mediaPath = 'word/' + mediaPath;

        const dataUrl = media[mediaPath];
        if (!dataUrl) return null;

        return {
            type: 'image',
            dataUrl,
            widthPt: widthEmu * PT_PER_INCH / EMU_PER_INCH,
            heightPt: heightEmu * PT_PER_INCH / EMU_PER_INCH,
        };
    }

    // ===== Parse table =====
    function parseTable(tblEl, rels, media, defaultFont, defaultSize) {
        const table = { type: 'table', rows: [], colWidths: [] };

        // Column widths from tblGrid
        const tblGrid = tblEl.querySelector('tblGrid');
        if (tblGrid) {
            tblGrid.querySelectorAll('gridCol').forEach(gc => {
                const w = parseInt(getWVal2(gc, 'w') || '0');
                table.colWidths.push(w / TWIP_PER_PT);
            });
        }

        // Rows
        tblEl.querySelectorAll(':scope > tr').forEach(tr => {
            const row = { cells: [], height: 0 };
            const trPr = tr.querySelector('trPr');
            if (trPr) {
                const trH = trPr.querySelector('trHeight');
                if (trH) row.height = parseInt(getWVal(trH) || '0') / TWIP_PER_PT;
            }

            tr.querySelectorAll(':scope > tc').forEach(tc => {
                const cell = { paragraphs: [], fill: null, width: 0 };

                const tcPr = tc.querySelector('tcPr');
                if (tcPr) {
                    const tcW = tcPr.querySelector('tcW');
                    if (tcW) cell.width = parseInt(getWVal(tcW) || '0') / TWIP_PER_PT;

                    const shd = tcPr.querySelector('shd');
                    if (shd) {
                        const fill = getWVal2(shd, 'fill');
                        if (fill && fill !== 'auto') cell.fill = '#' + fill;
                    }
                }

                tc.querySelectorAll(':scope > p').forEach(p => {
                    cell.paragraphs.push(parseParagraph(p, rels, media, defaultFont, defaultSize, {}, {}));
                });

                row.cells.push(cell);
            });

            table.rows.push(row);
        });

        return table;
    }

    // ===== Render document into page images =====
    async function renderDocumentToPages(doc, scale) {
        const page = doc.page;
        const contentW = page.w - page.ml - page.mr;
        const contentH = page.h - page.mt - page.mb;
        const pages = [];

        // Layout: simple top-down flow
        let curY = 0;
        let pageElements = []; // { type, ... }

        function newPage() {
            pages.push(pageElements);
            pageElements = [];
            curY = 0;
        }

        for (const item of doc.paragraphs) {
            if (item.type === 'paragraph') {
                // Page break before?
                if (item.pageBreakBefore && pageElements.length > 0) {
                    newPage();
                }

                curY += item.spaceBefore;

                // Check for page break runs
                let hasPageBreak = false;
                const textRuns = [];
                for (const run of item.runs) {
                    if (run && run.type === 'pagebreak') {
                        hasPageBreak = true;
                        break;
                    }
                    if (run) textRuns.push(run);
                }

                // Estimate height (simple: count lines based on text length & font size)
                const estHeight = estimateParaHeight(item, textRuns, contentW);

                if (curY + estHeight > contentH && pageElements.length > 0) {
                    newPage();
                    curY += item.spaceBefore;
                }

                pageElements.push({ ...item, _y: curY, _runs: textRuns });
                curY += estHeight + item.spaceAfter;

                if (hasPageBreak) {
                    newPage();
                }

            } else if (item.type === 'table') {
                const estH = estimateTableHeight(item);
                if (curY + estH > contentH && pageElements.length > 0) {
                    newPage();
                }
                pageElements.push({ ...item, _y: curY });
                curY += estH + 8;
            }
        }

        // Push last page
        if (pageElements.length > 0) {
            pages.push(pageElements);
        }

        // If empty doc, still create one page
        if (pages.length === 0) pages.push([]);

        // Render each page to canvas
        const renderedUrls = [];
        for (let pi = 0; pi < pages.length; pi++) {
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(page.w * scale);
            canvas.height = Math.round(page.h * scale);
            const ctx = canvas.getContext('2d');
            ctx.scale(scale, scale);

            // White background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, page.w, page.h);

            // Render elements
            const elems = pages[pi];
            for (const elem of elems) {
                ctx.save();
                if (elem.type === 'paragraph') {
                    await renderParagraph(ctx, elem, page.ml, page.mt + elem._y, contentW);
                } else if (elem.type === 'table') {
                    await renderTable(ctx, elem, page.ml, page.mt + elem._y, contentW);
                }
                ctx.restore();
            }

            renderedUrls.push(canvas.toDataURL('image/jpeg', 0.92));
        }

        return renderedUrls;
    }

    // ===== Estimate paragraph height =====
    function estimateParaHeight(para, runs, maxW) {
        const fontSize = getFontSize(para, runs);
        const lineH = fontSize * (para.lineSpacing || 1.15) * 1.2;

        // Calc text width to estimate lines
        let totalChars = 0;
        let hasImage = false;
        let imgH = 0;
        for (const r of runs) {
            if (!r) continue;
            if (r.type === 'image') { hasImage = true; imgH = Math.max(imgH, r.heightPt || 100); }
            else if (r.type === 'text') totalChars += (r.text || '').length;
        }

        if (hasImage) return imgH + 4;

        const avgCharWidth = fontSize * 0.55;
        const availW = maxW - (para.indent || 0) - (para.bullet ? 12 : 0);
        const charsPerLine = Math.max(1, Math.floor(availW / avgCharWidth));
        const numLines = Math.max(1, Math.ceil(totalChars / charsPerLine));

        return numLines * lineH;
    }

    function estimateTableHeight(table) {
        let h = 0;
        for (const row of table.rows) {
            h += Math.max(row.height || 24, 24);
        }
        return h;
    }

    function getFontSize(para, runs) {
        if (para._defaultFontSize) return para._defaultFontSize;
        for (const r of runs) {
            if (r && r.fontSize) return r.fontSize;
        }
        return 11;
    }

    // ===== Render paragraph on canvas =====
    async function renderParagraph(ctx, para, x, y, maxW) {
        const indent = para.indent || 0;
        const bulletPrefix = para.bullet || '';
        let curX = x + indent;
        let curY = y;
        const contentW = maxW - indent;
        const runs = para._runs || para.runs || [];

        // Draw bullet
        if (bulletPrefix) {
            const fs = getFontSize(para, runs);
            ctx.font = `${fs}pt sans-serif`;
            ctx.fillStyle = '#000000';
            ctx.textBaseline = 'top';
            ctx.fillText(bulletPrefix, x + indent - 14, curY);
        }

        // Process runs
        for (const run of runs) {
            if (!run) continue;

            if (run.type === 'image') {
                await renderImage(ctx, run, curX, curY, contentW);
                return;
            }

            if (run.type !== 'text') continue;

            const text = run.text || '';
            if (!text) continue;

            const fontSize = run.fontSize || 11;
            const weight = run.bold ? 'bold' : 'normal';
            const style = run.italic ? 'italic' : 'normal';
            ctx.font = `${style} ${weight} ${fontSize}pt ${run.fontFamily || 'sans-serif'}`;
            ctx.fillStyle = run.color || '#000000';
            ctx.textBaseline = 'top';

            const lineH = fontSize * (para.lineSpacing || 1.15) * 1.2;

            // Highlight
            if (run.highlight) {
                const tw = ctx.measureText(text).width;
                ctx.fillStyle = run.highlight;
                ctx.fillRect(curX, curY, tw, lineH);
                ctx.fillStyle = run.color || '#000000';
            }

            // Word-wrap rendering
            const words = text.split(/(\s+)/);
            for (const word of words) {
                if (!word) continue;
                const ww = ctx.measureText(word).width;
                if (curX + ww > x + maxW && curX > x + indent) {
                    curX = x + indent;
                    curY += lineH;
                }
                ctx.fillText(word, curX, curY);

                // Underline
                if (run.underline) {
                    ctx.beginPath();
                    ctx.moveTo(curX, curY + fontSize + 2);
                    ctx.lineTo(curX + ww, curY + fontSize + 2);
                    ctx.strokeStyle = run.color || '#000000';
                    ctx.lineWidth = Math.max(0.5, fontSize / 20);
                    ctx.stroke();
                }

                // Strikethrough
                if (run.strikethrough) {
                    ctx.beginPath();
                    const midY = curY + fontSize * 0.5;
                    ctx.moveTo(curX, midY);
                    ctx.lineTo(curX + ww, midY);
                    ctx.strokeStyle = run.color || '#000000';
                    ctx.lineWidth = Math.max(0.5, fontSize / 20);
                    ctx.stroke();
                }

                curX += ww;
            }
        }
    }

    // ===== Render image =====
    function renderImage(ctx, run, x, y, maxW) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                let w = run.widthPt || img.naturalWidth;
                let h = run.heightPt || img.naturalHeight;
                // Scale down to fit
                if (w > maxW) {
                    const ratio = maxW / w;
                    w = maxW;
                    h *= ratio;
                }
                ctx.drawImage(img, x, y, w, h);
                resolve();
            };
            img.onerror = () => resolve();
            img.src = run.dataUrl;
        });
    }

    // ===== Render table =====
    async function renderTable(ctx, table, x, y, maxW) {
        const colWidths = table.colWidths.length > 0
            ? table.colWidths
            : table.rows[0]?.cells.map(() => maxW / (table.rows[0]?.cells.length || 1)) || [maxW];

        const totalTblW = colWidths.reduce((s, w) => s + w, 0) || maxW;
        const scaleFactor = totalTblW > maxW ? maxW / totalTblW : 1;
        const scaledCols = colWidths.map(w => w * scaleFactor);

        let curY = y;

        for (const row of table.rows) {
            const rowH = Math.max(row.height || 24, 24);
            let curX = x;

            for (let ci = 0; ci < row.cells.length && ci < scaledCols.length; ci++) {
                const cell = row.cells[ci];
                const cw = scaledCols[ci];

                // Cell background
                if (cell.fill) {
                    ctx.fillStyle = cell.fill;
                    ctx.fillRect(curX, curY, cw, rowH);
                }

                // Cell border
                ctx.strokeStyle = '#c0c0c0';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(curX, curY, cw, rowH);

                // Cell text
                let textY = curY + 4;
                for (const para of cell.paragraphs) {
                    const runs = para.runs || [];
                    for (const run of runs) {
                        if (!run || run.type !== 'text') continue;
                        const fontSize = run.fontSize || 9;
                        const weight = run.bold ? 'bold' : 'normal';
                        const style = run.italic ? 'italic' : 'normal';
                        ctx.font = `${style} ${weight} ${fontSize}pt ${run.fontFamily || 'sans-serif'}`;
                        ctx.fillStyle = run.color || '#000000';
                        ctx.textBaseline = 'top';
                        ctx.fillText(run.text, curX + 4, textY, cw - 8);
                        textY += fontSize * 1.3;
                    }
                }

                curX += cw;
            }

            curY += rowH;
        }
    }

    // ===== Convert to PDF =====
    async function convertToPDF() {
        if (isConverting || !parsedDoc) return;
        isConverting = true;

        showSection('converting');
        updateStatus('Loading PDF library...');
        updateProgress(0);

        try {
            await loadJsPDF();
            updateProgress(5);

            const qualityEl = document.querySelector('#w2pQuality .w2p-option.active');
            const scale = parseInt(qualityEl?.dataset.value || '2');

            const pageSizeEl = document.querySelector('#w2pPageSize .w2p-option.active');
            const pageSizeKey = pageSizeEl?.dataset.value || 'a4';
            const dims = getPageDimensions(pageSizeKey);

            // Overwrite page size if user selected
            const docCopy = { ...parsedDoc, page: { ...parsedDoc.page, w: dims.w, h: dims.h } };

            updateStatus('Rendering pages...');
            updateProgress(10);

            const pageUrls = await renderDocumentToPages(docCopy, scale);

            updateProgress(70);
            updateStatus('Building PDF...');

            const doc = new jsPDFLib({
                orientation: dims.w > dims.h ? 'landscape' : 'portrait',
                unit: 'pt',
                format: [dims.w, dims.h]
            });

            for (let i = 0; i < pageUrls.length; i++) {
                updateProgress(70 + Math.round((i / pageUrls.length) * 25));
                if (i > 0) doc.addPage([dims.w, dims.h], dims.w > dims.h ? 'landscape' : 'portrait');
                doc.addImage(pageUrls[i], 'JPEG', 0, 0, dims.w, dims.h, undefined, 'FAST');
            }

            updateProgress(98);
            pdfBlob = doc.output('blob');

            showSection('done');
            const infoEl = document.getElementById('w2pDoneInfo');
            if (infoEl) infoEl.textContent = `${pageUrls.length} page${pageUrls.length !== 1 ? 's' : ''} • ${ToolUtils.formatBytes(pdfBlob.size)}`;

            // ToolChain: inject "Use this in another tool" action bar
            if (window.ToolChain && pdfBlob) {
                const name = (docxFile ? docxFile.name.replace(/\.docx$/i, '') : 'document') + '.pdf';
                const chainContainer = document.getElementById('w2pChainActions');
                if (chainContainer) {
                    ToolChain.inject(chainContainer, pdfBlob, name, 'word-to-pdf');
                }
            }

        } catch (err) {
            console.error('Conversion failed:', err);
            alert('Failed to create PDF.\n\nError: ' + err.message);
            showSection('preview');
        }

        isConverting = false;
    }

    // ===== Render page previews =====
    function renderPagePreviews() {
        const grid = document.getElementById('w2pPagesGrid');
        const countEl = document.getElementById('w2pPageCount');
        if (!grid) return;

        countEl.textContent = `${renderedPages.length} page${renderedPages.length !== 1 ? 's' : ''}`;

        const nameEl = document.getElementById('w2pFileName');
        const metaEl = document.getElementById('w2pFileMeta');
        if (nameEl) nameEl.textContent = docxFile.name;
        if (metaEl) metaEl.textContent = `${renderedPages.length} pages • ${ToolUtils.formatBytes(docxFile.size)}`;

        grid.innerHTML = renderedPages.map((url, i) => `
            <div class="w2p-page-thumb">
                <div class="w2p-page-number">${i + 1}</div>
                <div class="w2p-page-img-wrap">
                    <img src="${url}" alt="Page ${i + 1}">
                </div>
            </div>
        `).join('');
    }

    // ===== Helpers =====
    function sanitizeFont(font) {
        const map = {
            'calibri': '"Calibri", Arial, sans-serif',
            'arial': 'Arial, Helvetica, sans-serif',
            'times new roman': '"Times New Roman", serif',
            'courier new': '"Courier New", monospace',
            'verdana': 'Verdana, Geneva, sans-serif',
            'georgia': 'Georgia, serif',
            'tahoma': 'Tahoma, Geneva, sans-serif',
            'cambria': 'Cambria, Georgia, serif',
            'segoe ui': '"Segoe UI", Arial, sans-serif',
            'trebuchet ms': '"Trebuchet MS", sans-serif',
            'comic sans ms': '"Comic Sans MS", cursive',
            'consolas': 'Consolas, monospace',
            'impact': 'Impact, sans-serif',
            'garamond': 'Garamond, serif',
            'palatino linotype': '"Palatino Linotype", Palatino, serif',
            'book antiqua': '"Book Antiqua", Palatino, serif',
            'century gothic': '"Century Gothic", sans-serif',
            'aptos': '"Calibri", Arial, sans-serif',
        };
        const lower = font.toLowerCase().replace(/['"]/g, '');
        return map[lower] || `"${font}", sans-serif`;
    }

    function wordHighlightToHex(val) {
        const map = {
            'yellow': '#FFFF00', 'green': '#00FF00', 'cyan': '#00FFFF',
            'magenta': '#FF00FF', 'blue': '#0000FF', 'red': '#FF0000',
            'darkBlue': '#00008B', 'darkCyan': '#008B8B', 'darkGreen': '#006400',
            'darkMagenta': '#8B008B', 'darkRed': '#8B0000', 'darkYellow': '#808000',
            'darkGray': '#A9A9A9', 'lightGray': '#D3D3D3', 'black': '#000000',
            'white': '#FFFFFF',
        };
        return map[val] || '#FFFF00';
    }

    // ===== UI Helpers =====
    function showSection(section) {
        const banner = document.getElementById('w2pInfoBanner');
        const upload = document.getElementById('w2pUploadSection');
        const preview = document.getElementById('w2pPreviewSection');
        const converting = document.getElementById('w2pConvertingSection');
        const done = document.getElementById('w2pDoneSection');

        if (banner) banner.style.display = (section === 'upload' || section === 'preview') ? 'flex' : 'none';
        if (upload) upload.style.display = section === 'upload' ? 'block' : 'none';
        if (preview) preview.style.display = section === 'preview' ? 'block' : 'none';
        if (converting) converting.style.display = section === 'converting' ? 'block' : 'none';
        if (done) done.style.display = section === 'done' ? 'block' : 'none';
    }

    function updateStatus(text) {
        const el = document.getElementById('w2pConvertStatus');
        if (el) el.textContent = text;
    }

    function updateProgress(pct) {
        const fill = document.getElementById('w2pProgressFill');
        const text = document.getElementById('w2pProgressText');
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = Math.round(pct) + '%';
    }

    function resetTool() {
        docxFile = null;
        parsedDoc = null;
        renderedPages = [];
        pdfBlob = null;
        isConverting = false;
        showSection('upload');
        const fi = document.getElementById('w2pFileInput');
        if (fi) fi.value = '';
    }

})();
