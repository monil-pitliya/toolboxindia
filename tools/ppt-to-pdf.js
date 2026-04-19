/* =============================================
   Free Toolbox — PPT to PDF Converter

   Converts PowerPoint (.pptx) files to PDF.
   Parses the PPTX (ZIP containing XML + media),
   renders each slide to canvas, and generates PDF.

   100% client-side. Zero server uploads.
   ============================================= */

(function () {
    'use strict';

    // ===== State =====
    let pptxFile = null;
    let slides = [];           // { width, height, canvas, elements[] }
    let slideImages = [];       // data URLs of rendered slides
    let isConverting = false;
    let JSZipLib = null;
    let jsPDFLib = null;

    // EMU to points (1 inch = 914400 EMU, 1 inch = 72 pt)
    const EMU_TO_PT = 72 / 914400;
    // Default slide size (10" x 7.5" in EMU)
    const DEFAULT_SLIDE_W = 9144000;
    const DEFAULT_SLIDE_H = 6858000;

    // ===== Register Tool =====
    ToolRegistry.register('ppt-to-pdf', {
        title: 'PPT to PDF',
        description: 'Convert PowerPoint (.pptx) presentations to PDF — preserves slides, text, images & shapes.',
        category: 'Converter Tools',
        tags: ['ppt to pdf', 'pptx to pdf', 'powerpoint to pdf', 'convert ppt', 'presentation to pdf', 'slides to pdf', 'pptx converter', 'powerpoint converter'],

        render() {
            return `
                <!-- Info Banner -->
                <div class="p2p-info-banner" id="p2pInfoBanner">
                    <span class="p2p-info-icon">📊</span>
                    <div>
                        <strong>100% Private</strong> — Your presentation is converted entirely in your browser. Nothing is uploaded anywhere.
                    </div>
                </div>

                <!-- Upload Section -->
                <div id="p2pUploadSection">
                    <div class="tool-workspace">
                        <div class="drop-zone" id="p2pDropZone">
                            <span class="drop-zone-icon">📊 → 📄</span>
                            <h3 class="drop-zone-title">Drop PowerPoint file here</h3>
                            <p class="drop-zone-subtitle">Convert your .pptx presentation to a high-quality PDF document</p>
                            <button class="drop-zone-btn" onclick="document.getElementById('p2pFileInput').click()">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                Choose PPTX File
                            </button>
                            <input type="file" id="p2pFileInput" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation">
                            <p class="drop-zone-info">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                .pptx files only &bull; Max ~50 slides recommended &bull; Images & text preserved
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Preview Section -->
                <div id="p2pPreviewSection" style="display:none;">
                    <div class="p2p-file-info">
                        <div class="p2p-file-card">
                            <div class="p2p-file-icon">📊</div>
                            <div class="p2p-file-details">
                                <span class="p2p-file-name" id="p2pFileName">presentation.pptx</span>
                                <span class="p2p-file-meta" id="p2pFileMeta">12 slides • 3.2 MB</span>
                            </div>
                            <button class="p2p-change-btn" onclick="document.getElementById('p2pFileInput').click()">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                Change File
                            </button>
                        </div>
                    </div>

                    <!-- Settings -->
                    <div class="p2p-settings">
                        <div class="p2p-setting-group">
                            <label class="p2p-label">Quality</label>
                            <div class="p2p-options" id="p2pQuality">
                                <button class="p2p-option" data-value="1">Standard <span class="p2p-option-hint">Smaller file</span></button>
                                <button class="p2p-option active" data-value="2">High <span class="p2p-option-hint">Recommended</span></button>
                                <button class="p2p-option" data-value="3">Ultra <span class="p2p-option-hint">Best quality</span></button>
                            </div>
                        </div>
                    </div>

                    <!-- Slide Previews -->
                    <div class="p2p-slides-header">
                        <h3 id="p2pSlideCount">0 slides</h3>
                    </div>
                    <div class="p2p-slides-grid" id="p2pSlidesGrid">
                        <!-- Slide thumbnails injected here -->
                    </div>

                    <!-- Convert Button -->
                    <div class="p2p-convert-area">
                        <button class="btn-primary p2p-convert-btn" id="p2pConvertBtn">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            Convert to PDF
                        </button>
                        <button class="btn-secondary" id="p2pClearBtn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                            Clear
                        </button>
                    </div>
                </div>

                <!-- Converting Section -->
                <div id="p2pConvertingSection" style="display:none;">
                    <div class="p2p-converting-card">
                        <div class="p2p-spinner"></div>
                        <h3>Converting to PDF...</h3>
                        <p id="p2pConvertStatus">Parsing presentation...</p>
                        <div class="p2p-progress-bar">
                            <div class="p2p-progress-fill" id="p2pProgressFill" style="width:0%"></div>
                        </div>
                        <span class="p2p-progress-text" id="p2pProgressText">0%</span>
                    </div>
                </div>

                <!-- Done Section -->
                <div id="p2pDoneSection" style="display:none;">
                    <div class="p2p-done-card">
                        <div class="p2p-done-icon">✅</div>
                        <h3>PDF Ready!</h3>
                        <p id="p2pDoneInfo">12 slides • 1.8 MB</p>
                        <div class="p2p-done-actions">
                            <button class="btn-success p2p-download-btn" id="p2pDownloadBtn">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                Download PDF
                            </button>
                            <button class="btn-secondary" id="p2pStartOver">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                                Convert Another
                            </button>
                        </div>
                        <div id="p2pChainActions"></div>
                    </div>
                </div>

                <!-- Hidden canvas for rendering -->
                <canvas id="p2pRenderCanvas" style="display:none;"></canvas>
            `;
        },

        init() {
            initP2P();
        },

        destroy() {
            pptxFile = null;
            slides = [];
            slideImages = [];
            isConverting = false;
        }
    });

    // ===== Initialize =====
    function initP2P() {
        setTimeout(() => {
            const dropZone = document.getElementById('p2pDropZone');
            const fileInput = document.getElementById('p2pFileInput');
            if (!dropZone || !fileInput) return;

            // Drop zone click
            dropZone.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') fileInput.click();
            });

            // File input change
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length) handlePPTXFile(e.target.files[0]);
            });

            // Drag & drop
            ['dragenter', 'dragover'].forEach(evt => {
                dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
            });
            ['dragleave', 'drop'].forEach(evt => {
                dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
            });
            dropZone.addEventListener('drop', (e) => {
                const file = e.dataTransfer.files[0];
                if (file && (file.name.endsWith('.pptx') || file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation')) {
                    handlePPTXFile(file);
                } else {
                    alert('Please drop a .pptx file');
                }
            });

            // Option buttons
            document.querySelectorAll('.p2p-options').forEach(group => {
                group.addEventListener('click', (e) => {
                    const btn = e.target.closest('.p2p-option');
                    if (!btn) return;
                    group.querySelectorAll('.p2p-option').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });

            // Convert button
            const convertBtn = document.getElementById('p2pConvertBtn');
            if (convertBtn) convertBtn.addEventListener('click', convertToPDF);

            // Clear button
            const clearBtn = document.getElementById('p2pClearBtn');
            if (clearBtn) clearBtn.addEventListener('click', resetTool);

            // Download button
            const dlBtn = document.getElementById('p2pDownloadBtn');
            if (dlBtn) dlBtn.addEventListener('click', () => {
                if (dlBtn._pdfBlob) {
                    const name = (pptxFile ? pptxFile.name.replace(/\.pptx$/i, '') : 'presentation') + '.pdf';
                    ToolUtils.downloadBlob(dlBtn._pdfBlob, name);
                }
            });

            // Start Over
            const startOver = document.getElementById('p2pStartOver');
            if (startOver) startOver.addEventListener('click', resetTool);

            // Cross-tool chaining: consume pending file from another tool
            if (window.ToolChain && ToolChain.hasPending()) {
                const chained = ToolChain.consumePending();
                if (chained && chained.blob) {
                    ToolChain.injectBackBanner(document.getElementById('toolContent'));
                    const file = ToolChain.blobToFile(chained.blob, chained.name || 'presentation.pptx');
                    setTimeout(() => handlePPTXFile(file), 100);
                }
            }
        }, 100);
    }

    // ===== Load Libraries =====
    function loadJSZip() {
        return new Promise((resolve, reject) => {
            if (window.JSZip) { JSZipLib = window.JSZip; resolve(); return; }
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
            s.onload = () => { JSZipLib = window.JSZip; resolve(); };
            s.onerror = () => reject(new Error('Failed to load JSZip'));
            document.head.appendChild(s);
        });
    }

    function loadJsPDF() {
        return new Promise((resolve, reject) => {
            if (window.jspdf) { jsPDFLib = window.jspdf.jsPDF; resolve(); return; }
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
            s.onload = () => { jsPDFLib = window.jspdf.jsPDF; resolve(); };
            s.onerror = () => reject(new Error('Failed to load jsPDF'));
            document.head.appendChild(s);
        });
    }

    // ===== Handle PPTX File =====
    async function handlePPTXFile(file) {
        pptxFile = file;
        slides = [];
        slideImages = [];

        showSection('converting');
        updateStatus('Loading libraries...');
        updateProgress(0);

        try {
            await loadJSZip();
            updateStatus('Parsing presentation...');
            updateProgress(5);

            const zip = await JSZipLib.loadAsync(file);

            // Get slide size from presentation.xml
            const slideSize = await getSlideSize(zip);

            // Get slide layout/master backgrounds & relationships
            const slideLayouts = await parseSlideLayouts(zip);
            const slideMasters = await parseSlideMasters(zip);

            // Discover slide files
            const slideFiles = [];
            for (const path of Object.keys(zip.files)) {
                const m = path.match(/^ppt\/slides\/slide(\d+)\.xml$/);
                if (m) slideFiles.push({ path, num: parseInt(m[1]) });
            }
            slideFiles.sort((a, b) => a.num - b.num);

            if (slideFiles.length === 0) {
                alert('No slides found in this presentation.');
                resetTool();
                return;
            }

            updateStatus(`Found ${slideFiles.length} slides. Parsing...`);
            updateProgress(10);

            // Get media files (images)
            const media = {};
            for (const path of Object.keys(zip.files)) {
                if (path.startsWith('ppt/media/')) {
                    const data = await zip.files[path].async('base64');
                    const ext = path.split('.').pop().toLowerCase();
                    const mime = ext === 'png' ? 'image/png' :
                                 ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                                 ext === 'gif' ? 'image/gif' :
                                 ext === 'bmp' ? 'image/bmp' :
                                 ext === 'svg' ? 'image/svg+xml' :
                                 ext === 'emf' ? 'image/x-emf' :
                                 ext === 'wmf' ? 'image/x-wmf' :
                                 ext === 'tiff' || ext === 'tif' ? 'image/tiff' :
                                 'image/png';
                    media[path] = `data:${mime};base64,${data}`;
                }
            }

            // Parse each slide
            for (let i = 0; i < slideFiles.length; i++) {
                updateStatus(`Parsing slide ${i + 1} of ${slideFiles.length}...`);
                updateProgress(10 + Math.round((i / slideFiles.length) * 30));

                const slideXml = await zip.files[slideFiles[i].path].async('text');
                const slideRels = await getSlideRels(zip, slideFiles[i].num);
                const slideData = parseSlide(slideXml, slideRels, media, slideSize, slideLayouts, slideMasters, slideFiles[i].num, zip);
                slides.push(slideData);
            }

            // Now render thumbnails for preview
            updateStatus('Rendering previews...');
            updateProgress(45);

            for (let i = 0; i < slides.length; i++) {
                updateProgress(45 + Math.round((i / slides.length) * 30));
                const dataUrl = await renderSlideToCanvas(slides[i], 1);  // 1x scale for preview
                slideImages.push(dataUrl);
            }

            // Show preview
            showSection('preview');
            renderSlidePreviews();

        } catch (err) {
            console.error('PPTX parsing failed:', err);
            alert('Failed to parse this PPTX file. It may be corrupted or use an unsupported format.\n\nError: ' + err.message);
            resetTool();
        }
    }

    // ===== Get slide size from presentation.xml =====
    async function getSlideSize(zip) {
        try {
            const presXml = await zip.files['ppt/presentation.xml'].async('text');
            const parser = new DOMParser();
            const doc = parser.parseFromString(presXml, 'application/xml');
            const sldSz = doc.querySelector('sldSz');
            if (sldSz) {
                return {
                    width: parseInt(sldSz.getAttribute('cx')) || DEFAULT_SLIDE_W,
                    height: parseInt(sldSz.getAttribute('cy')) || DEFAULT_SLIDE_H
                };
            }
        } catch (e) { /* use defaults */ }
        return { width: DEFAULT_SLIDE_W, height: DEFAULT_SLIDE_H };
    }

    // ===== Parse slide layouts =====
    async function parseSlideLayouts(zip) {
        const layouts = {};
        for (const path of Object.keys(zip.files)) {
            const m = path.match(/^ppt\/slideLayouts\/slideLayout(\d+)\.xml$/);
            if (m) {
                try {
                    const xml = await zip.files[path].async('text');
                    const rels = await getRelationships(zip, `ppt/slideLayouts/_rels/slideLayout${m[1]}.xml.rels`);
                    layouts[m[1]] = { xml, rels };
                } catch (e) { /* skip */ }
            }
        }
        return layouts;
    }

    // ===== Parse slide masters =====
    async function parseSlideMasters(zip) {
        const masters = {};
        for (const path of Object.keys(zip.files)) {
            const m = path.match(/^ppt\/slideMasters\/slideMaster(\d+)\.xml$/);
            if (m) {
                try {
                    const xml = await zip.files[path].async('text');
                    masters[m[1]] = { xml };
                } catch (e) { /* skip */ }
            }
        }
        return masters;
    }

    // ===== Get relationships for a slide =====
    async function getSlideRels(zip, slideNum) {
        return await getRelationships(zip, `ppt/slides/_rels/slide${slideNum}.xml.rels`);
    }

    async function getRelationships(zip, relsPath) {
        const rels = {};
        try {
            const relsXml = await zip.files[relsPath].async('text');
            const parser = new DOMParser();
            const doc = parser.parseFromString(relsXml, 'application/xml');
            doc.querySelectorAll('Relationship').forEach(rel => {
                rels[rel.getAttribute('Id')] = {
                    type: rel.getAttribute('Type'),
                    target: rel.getAttribute('Target')
                };
            });
        } catch (e) { /* no rels */ }
        return rels;
    }

    // ===== Parse a single slide XML =====
    function parseSlide(xml, rels, media, slideSize, layouts, masters, slideNum, zip) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'application/xml');
        const slide = {
            width: slideSize.width,
            height: slideSize.height,
            background: null,
            elements: []
        };

        // Try to get slide background
        slide.background = parseBackground(doc);

        // Parse shapes from spTree (shape tree)
        const spTree = doc.querySelector('spTree');
        if (spTree) {
            parseShapeTree(spTree, slide.elements, rels, media, slideSize);
        }

        return slide;
    }

    // ===== Parse background =====
    function parseBackground(doc) {
        // Look for background fill
        const bg = doc.querySelector('bg');
        if (!bg) return null;

        const bgFill = bg.querySelector('bgPr') || bg.querySelector('bgRef');
        if (!bgFill) return null;

        // Solid fill
        const solidFill = bgFill.querySelector('solidFill');
        if (solidFill) {
            return { type: 'solid', color: parseFillColor(solidFill) };
        }

        // Gradient fill
        const gradFill = bgFill.querySelector('gradFill');
        if (gradFill) {
            const stops = [];
            gradFill.querySelectorAll('gs').forEach(gs => {
                const color = parseFillColor(gs);
                const pos = parseInt(gs.getAttribute('pos') || '0') / 1000;
                stops.push({ pos, color });
            });
            if (stops.length >= 2) {
                return { type: 'gradient', stops };
            }
        }

        return null;
    }

    // ===== Parse fill color =====
    function parseFillColor(el) {
        // srgbClr
        const srgb = el.querySelector('srgbClr');
        if (srgb) {
            let color = '#' + srgb.getAttribute('val');
            // Check for alpha/tint/shade
            const alpha = srgb.querySelector('alpha');
            if (alpha) {
                const a = parseInt(alpha.getAttribute('val')) / 100000;
                return addAlpha(color, a);
            }
            return color;
        }

        // schemeClr — map to common defaults
        const scheme = el.querySelector('schemeClr');
        if (scheme) {
            return schemeColorToHex(scheme.getAttribute('val'));
        }

        // prstClr (preset color)
        const prst = el.querySelector('prstClr');
        if (prst) {
            return presetColorToHex(prst.getAttribute('val'));
        }

        return '#ffffff';
    }

    function addAlpha(hex, alpha) {
        // Return rgba string
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
    }

    function schemeColorToHex(val) {
        const map = {
            'dk1': '#000000', 'dk2': '#1F497D', 'lt1': '#FFFFFF', 'lt2': '#EEECE1',
            'accent1': '#4472C4', 'accent2': '#ED7D31', 'accent3': '#A5A5A5',
            'accent4': '#FFC000', 'accent5': '#5B9BD5', 'accent6': '#70AD47',
            'hlink': '#0563C1', 'folHlink': '#954F72',
            'tx1': '#000000', 'tx2': '#1F497D', 'bg1': '#FFFFFF', 'bg2': '#EEECE1',
            'phClr': '#4472C4'
        };
        return map[val] || '#000000';
    }

    function presetColorToHex(val) {
        const map = {
            'black': '#000000', 'white': '#FFFFFF', 'red': '#FF0000',
            'green': '#008000', 'blue': '#0000FF', 'yellow': '#FFFF00',
            'cyan': '#00FFFF', 'magenta': '#FF00FF', 'gray': '#808080',
            'darkGray': '#A9A9A9', 'lightGray': '#D3D3D3',
            'orange': '#FFA500', 'pink': '#FFC0CB', 'purple': '#800080'
        };
        return map[val] || '#000000';
    }

    // ===== Parse shape tree =====
    function parseShapeTree(spTree, elements, rels, media, slideSize) {
        // Iterate through child elements
        for (const child of spTree.children) {
            const tag = child.localName || child.tagName.split(':').pop();

            if (tag === 'sp') {
                // Shape (text box, rectangle, etc.)
                parseShape(child, elements, slideSize);
            } else if (tag === 'pic') {
                // Picture
                parsePicture(child, elements, rels, media, slideSize);
            } else if (tag === 'grpSp') {
                // Group shape — recurse
                const grpSpTree = child;
                parseShapeTree(grpSpTree, elements, rels, media, slideSize);
            } else if (tag === 'cxnSp') {
                // Connection shape (line)
                parseConnectionShape(child, elements, slideSize);
            } else if (tag === 'graphicFrame') {
                // Tables, charts, etc. — extract text at minimum
                parseGraphicFrame(child, elements, slideSize);
            }
        }
    }

    // ===== Parse shape =====
    function parseShape(sp, elements, slideSize) {
        const xfrm = sp.querySelector('xfrm');
        if (!xfrm) return;

        const off = xfrm.querySelector('off');
        const ext = xfrm.querySelector('ext');
        if (!off || !ext) return;

        const x = parseInt(off.getAttribute('x') || '0');
        const y = parseInt(off.getAttribute('y') || '0');
        const cx = parseInt(ext.getAttribute('cx') || '0');
        const cy = parseInt(ext.getAttribute('cy') || '0');
        const rot = parseInt(xfrm.getAttribute('rot') || '0') / 60000; // rotation in degrees

        // Check for shape fill
        let fill = null;
        const spPr = sp.querySelector('spPr');
        if (spPr) {
            const solidFill = spPr.querySelector('solidFill');
            if (solidFill) {
                fill = parseFillColor(solidFill);
            }
            const noFill = spPr.querySelector('noFill');
            if (noFill) fill = 'none';
        }

        // Check for line/outline
        let stroke = null;
        let strokeWidth = 0;
        if (spPr) {
            const ln = spPr.querySelector('ln');
            if (ln) {
                strokeWidth = parseInt(ln.getAttribute('w') || '0') * EMU_TO_PT;
                const lnFill = ln.querySelector('solidFill');
                if (lnFill) stroke = parseFillColor(lnFill);
                const noFill = ln.querySelector('noFill');
                if (noFill) stroke = null;
            }
        }

        // Get preset geometry
        let prstGeom = null;
        if (spPr) {
            const pg = spPr.querySelector('prstGeom');
            if (pg) prstGeom = pg.getAttribute('prst');
        }

        // Parse text runs
        const textRuns = parseTextBody(sp);

        const element = {
            type: 'shape',
            x, y, cx, cy, rot,
            fill,
            stroke,
            strokeWidth,
            prstGeom,
            textRuns
        };

        elements.push(element);
    }

    // ===== Parse picture =====
    function parsePicture(pic, elements, rels, media, slideSize) {
        const xfrm = pic.querySelector('xfrm');
        if (!xfrm) return;

        const off = xfrm.querySelector('off');
        const ext = xfrm.querySelector('ext');
        if (!off || !ext) return;

        const x = parseInt(off.getAttribute('x') || '0');
        const y = parseInt(off.getAttribute('y') || '0');
        const cx = parseInt(ext.getAttribute('cx') || '0');
        const cy = parseInt(ext.getAttribute('cy') || '0');
        const rot = parseInt(xfrm.getAttribute('rot') || '0') / 60000;

        // Get image relationship ID
        const blipFill = pic.querySelector('blipFill');
        if (!blipFill) return;
        const blip = blipFill.querySelector('blip');
        if (!blip) return;

        // Get r:embed or r:link
        const rEmbed = blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed')
                     || blip.getAttribute('r:embed');
        if (!rEmbed) return;

        const rel = rels[rEmbed];
        if (!rel) return;

        // Resolve media path
        let mediaPath = rel.target;
        if (mediaPath.startsWith('../')) {
            mediaPath = 'ppt/' + mediaPath.substring(3);
        } else if (!mediaPath.startsWith('ppt/')) {
            mediaPath = 'ppt/slides/' + mediaPath;
        }

        const dataUrl = media[mediaPath];
        if (!dataUrl) return;

        // Check for crop
        let crop = null;
        const srcRect = blipFill.querySelector('srcRect');
        if (srcRect) {
            crop = {
                l: parseInt(srcRect.getAttribute('l') || '0') / 1000,
                t: parseInt(srcRect.getAttribute('t') || '0') / 1000,
                r: parseInt(srcRect.getAttribute('r') || '0') / 1000,
                b: parseInt(srcRect.getAttribute('b') || '0') / 1000
            };
        }

        elements.push({
            type: 'image',
            x, y, cx, cy, rot,
            dataUrl,
            crop
        });
    }

    // ===== Parse connection shape (lines) =====
    function parseConnectionShape(cxnSp, elements, slideSize) {
        const xfrm = cxnSp.querySelector('xfrm');
        if (!xfrm) return;

        const off = xfrm.querySelector('off');
        const ext = xfrm.querySelector('ext');
        if (!off || !ext) return;

        const x = parseInt(off.getAttribute('x') || '0');
        const y = parseInt(off.getAttribute('y') || '0');
        const cx = parseInt(ext.getAttribute('cx') || '0');
        const cy = parseInt(ext.getAttribute('cy') || '0');
        const flipH = xfrm.getAttribute('flipH') === '1';
        const flipV = xfrm.getAttribute('flipV') === '1';

        let stroke = '#000000';
        let strokeWidth = 1;
        const spPr = cxnSp.querySelector('spPr');
        if (spPr) {
            const ln = spPr.querySelector('ln');
            if (ln) {
                strokeWidth = Math.max(1, parseInt(ln.getAttribute('w') || '12700') * EMU_TO_PT);
                const sf = ln.querySelector('solidFill');
                if (sf) stroke = parseFillColor(sf);
            }
        }

        elements.push({
            type: 'line',
            x, y, cx, cy,
            flipH, flipV,
            stroke,
            strokeWidth
        });
    }

    // ===== Parse graphic frame (tables) =====
    function parseGraphicFrame(gf, elements, slideSize) {
        const xfrm = gf.querySelector('xfrm');
        if (!xfrm) return;

        const off = xfrm.querySelector('off');
        const ext = xfrm.querySelector('ext');
        if (!off || !ext) return;

        const x = parseInt(off.getAttribute('x') || '0');
        const y = parseInt(off.getAttribute('y') || '0');
        const cx = parseInt(ext.getAttribute('cx') || '0');
        const cy = parseInt(ext.getAttribute('cy') || '0');

        // Try to parse table
        const tbl = gf.querySelector('tbl');
        if (tbl) {
            const table = parseTable(tbl, x, y, cx, cy);
            if (table) elements.push(table);
            return;
        }

        // For charts/other objects, just add a placeholder
        const textRuns = parseTextBody(gf);
        if (textRuns.length > 0) {
            elements.push({
                type: 'shape',
                x, y, cx, cy, rot: 0,
                fill: null,
                stroke: null,
                strokeWidth: 0,
                prstGeom: 'rect',
                textRuns
            });
        }
    }

    // ===== Parse table =====
    function parseTable(tbl, x, y, cx, cy) {
        const rows = [];
        const gridCols = [];

        // Get grid column widths
        const tblGrid = tbl.querySelector('tblGrid');
        if (tblGrid) {
            tblGrid.querySelectorAll('gridCol').forEach(gc => {
                gridCols.push(parseInt(gc.getAttribute('w') || '0'));
            });
        }

        // Parse rows
        tbl.querySelectorAll('tr').forEach(tr => {
            const rowH = parseInt(tr.getAttribute('h') || '0');
            const cells = [];
            tr.querySelectorAll('tc').forEach(tc => {
                const textRuns = [];
                tc.querySelectorAll('p').forEach(p => {
                    const runs = parseParagraph(p);
                    textRuns.push(...runs);
                });

                // Cell fill
                let cellFill = null;
                const tcPr = tc.querySelector('tcPr');
                if (tcPr) {
                    const sf = tcPr.querySelector('solidFill');
                    if (sf) cellFill = parseFillColor(sf);
                }

                cells.push({ textRuns, fill: cellFill });
            });
            rows.push({ height: rowH, cells });
        });

        if (rows.length === 0) return null;

        return {
            type: 'table',
            x, y, cx, cy,
            gridCols,
            rows
        };
    }

    // ===== Parse text body =====
    function parseTextBody(el) {
        const textRuns = [];
        const txBody = el.querySelector('txBody');
        if (!txBody) return textRuns;

        txBody.querySelectorAll('p').forEach(p => {
            const runs = parseParagraph(p);
            textRuns.push(...runs);
            // Add newline marker
            if (runs.length > 0) {
                textRuns.push({ text: '\n', fontSize: runs[0].fontSize, color: runs[0].color, bold: false, italic: false, fontFamily: runs[0].fontFamily, align: runs[0].align });
            }
        });

        return textRuns;
    }

    // ===== Parse paragraph =====
    function parseParagraph(p) {
        const runs = [];

        // Paragraph properties
        const pPr = p.querySelector('pPr');
        let align = 'left';
        let bulletChar = null;
        let indent = 0;

        if (pPr) {
            const algn = pPr.getAttribute('algn');
            if (algn === 'ctr') align = 'center';
            else if (algn === 'r') align = 'right';
            else if (algn === 'just') align = 'justify';

            indent = parseInt(pPr.getAttribute('lvl') || '0');

            // Bullet
            const buChar = pPr.querySelector('buChar');
            if (buChar) bulletChar = buChar.getAttribute('char') || '•';
            const buNone = pPr.querySelector('buNone');
            if (buNone) bulletChar = null;
        }

        // Runs
        p.querySelectorAll('r').forEach(r => {
            const rPr = r.querySelector('rPr');
            const t = r.querySelector('t');
            if (!t) return;

            let fontSize = 1800; // default 18pt in hundredths of a point
            let color = '#000000';
            let bold = false;
            let italic = false;
            let underline = false;
            let fontFamily = 'Calibri';

            if (rPr) {
                const sz = rPr.getAttribute('sz');
                if (sz) fontSize = parseInt(sz);

                bold = rPr.getAttribute('b') === '1';
                italic = rPr.getAttribute('i') === '1';
                underline = rPr.getAttribute('u') === 'sng' || rPr.getAttribute('u') === 'heavy';

                // Color
                const solidFill = rPr.querySelector('solidFill');
                if (solidFill) color = parseFillColor(solidFill);

                // Font
                const latin = rPr.querySelector('latin');
                if (latin) fontFamily = latin.getAttribute('typeface') || 'Calibri';
                const cs = rPr.querySelector('cs');
                if (cs && !latin) fontFamily = cs.getAttribute('typeface') || fontFamily;
            }

            runs.push({
                text: t.textContent,
                fontSize: fontSize / 100,  // convert to points
                color,
                bold,
                italic,
                underline,
                fontFamily,
                align,
                bulletChar: runs.length === 0 ? bulletChar : null,
                indent
            });
        });

        // If paragraph has no runs but has a line break, add empty run
        if (runs.length === 0) {
            const br = p.querySelector('br');
            const endParaRPr = p.querySelector('endParaRPr');
            let fontSize = 18;
            if (endParaRPr) {
                const sz = endParaRPr.getAttribute('sz');
                if (sz) fontSize = parseInt(sz) / 100;
            }
            // empty paragraph — add as spacer
            runs.push({ text: '', fontSize, color: '#000000', bold: false, italic: false, fontFamily: 'Calibri', align, indent: 0 });
        }

        return runs;
    }

    // ===== Render slide to canvas =====
    async function renderSlideToCanvas(slide, scale) {
        const ptW = slide.width * EMU_TO_PT;
        const ptH = slide.height * EMU_TO_PT;

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(ptW * scale);
        canvas.height = Math.round(ptH * scale);
        const ctx = canvas.getContext('2d');

        // Scale context
        ctx.scale(scale, scale);

        // Draw background
        if (slide.background) {
            if (slide.background.type === 'solid') {
                ctx.fillStyle = slide.background.color;
                ctx.fillRect(0, 0, ptW, ptH);
            } else if (slide.background.type === 'gradient') {
                const grad = ctx.createLinearGradient(0, 0, 0, ptH);
                slide.background.stops.forEach(s => {
                    grad.addColorStop(s.pos / 100, s.color);
                });
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, ptW, ptH);
            }
        } else {
            // Default white background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, ptW, ptH);
        }

        // Render elements in order
        for (const el of slide.elements) {
            ctx.save();

            if (el.type === 'image') {
                await drawImage(ctx, el);
            } else if (el.type === 'shape') {
                drawShape(ctx, el);
            } else if (el.type === 'line') {
                drawLine(ctx, el);
            } else if (el.type === 'table') {
                drawTable(ctx, el);
            }

            ctx.restore();
        }

        return canvas.toDataURL('image/jpeg', 0.95);
    }

    // ===== Draw image =====
    function drawImage(ctx, el) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const x = el.x * EMU_TO_PT;
                const y = el.y * EMU_TO_PT;
                const w = el.cx * EMU_TO_PT;
                const h = el.cy * EMU_TO_PT;

                ctx.save();
                if (el.rot) {
                    ctx.translate(x + w / 2, y + h / 2);
                    ctx.rotate((el.rot * Math.PI) / 180);
                    ctx.translate(-(x + w / 2), -(y + h / 2));
                }

                if (el.crop) {
                    const sx = (el.crop.l / 100) * img.naturalWidth;
                    const sy = (el.crop.t / 100) * img.naturalHeight;
                    const sw = img.naturalWidth * (1 - (el.crop.l + el.crop.r) / 100);
                    const sh = img.naturalHeight * (1 - (el.crop.t + el.crop.b) / 100);
                    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
                } else {
                    ctx.drawImage(img, x, y, w, h);
                }

                ctx.restore();
                resolve();
            };
            img.onerror = () => resolve(); // skip broken images
            img.src = el.dataUrl;
        });
    }

    // ===== Draw shape =====
    function drawShape(ctx, el) {
        const x = el.x * EMU_TO_PT;
        const y = el.y * EMU_TO_PT;
        const w = el.cx * EMU_TO_PT;
        const h = el.cy * EMU_TO_PT;

        ctx.save();
        if (el.rot) {
            ctx.translate(x + w / 2, y + h / 2);
            ctx.rotate((el.rot * Math.PI) / 180);
            ctx.translate(-(x + w / 2), -(y + h / 2));
        }

        // Draw shape background
        if (el.fill && el.fill !== 'none') {
            ctx.fillStyle = el.fill;
            drawShapePath(ctx, el.prstGeom, x, y, w, h);
            ctx.fill();
        }

        // Draw shape border
        if (el.stroke && el.strokeWidth > 0) {
            ctx.strokeStyle = el.stroke;
            ctx.lineWidth = el.strokeWidth;
            drawShapePath(ctx, el.prstGeom, x, y, w, h);
            ctx.stroke();
        }

        // Draw text
        if (el.textRuns && el.textRuns.length > 0) {
            drawText(ctx, el.textRuns, x, y, w, h);
        }

        ctx.restore();
    }

    // ===== Draw shape path =====
    function drawShapePath(ctx, prst, x, y, w, h) {
        ctx.beginPath();
        switch (prst) {
            case 'ellipse':
            case 'oval':
                ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
                break;
            case 'roundRect':
                const r = Math.min(w, h) * 0.1;
                ctx.moveTo(x + r, y);
                ctx.lineTo(x + w - r, y);
                ctx.quadraticCurveTo(x + w, y, x + w, y + r);
                ctx.lineTo(x + w, y + h - r);
                ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                ctx.lineTo(x + r, y + h);
                ctx.quadraticCurveTo(x, y + h, x, y + h - r);
                ctx.lineTo(x, y + r);
                ctx.quadraticCurveTo(x, y, x + r, y);
                break;
            case 'triangle':
            case 'rtTriangle':
                ctx.moveTo(x + w / 2, y);
                ctx.lineTo(x + w, y + h);
                ctx.lineTo(x, y + h);
                ctx.closePath();
                break;
            case 'diamond':
                ctx.moveTo(x + w / 2, y);
                ctx.lineTo(x + w, y + h / 2);
                ctx.lineTo(x + w / 2, y + h);
                ctx.lineTo(x, y + h / 2);
                ctx.closePath();
                break;
            case 'star5':
            case 'star4':
                drawStar(ctx, x + w / 2, y + h / 2, 5, w / 2, w / 4);
                break;
            case 'rightArrow':
            case 'leftArrow':
                const aw = w * 0.3;
                const ah = h * 0.3;
                ctx.moveTo(x, y + ah);
                ctx.lineTo(x + w - aw, y + ah);
                ctx.lineTo(x + w - aw, y);
                ctx.lineTo(x + w, y + h / 2);
                ctx.lineTo(x + w - aw, y + h);
                ctx.lineTo(x + w - aw, y + h - ah);
                ctx.lineTo(x, y + h - ah);
                ctx.closePath();
                break;
            default:
                // Default rectangle
                ctx.rect(x, y, w, h);
                break;
        }
    }

    function drawStar(ctx, cx, cy, points, outerR, innerR) {
        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (Math.PI / points) * i - Math.PI / 2;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
    }

    // ===== Draw line =====
    function drawLine(ctx, el) {
        const x = el.x * EMU_TO_PT;
        const y = el.y * EMU_TO_PT;
        const w = el.cx * EMU_TO_PT;
        const h = el.cy * EMU_TO_PT;

        let x1 = x, y1 = y, x2 = x + w, y2 = y + h;
        if (el.flipH) { x1 = x + w; x2 = x; }
        if (el.flipV) { y1 = y + h; y2 = y; }

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = el.stroke || '#000000';
        ctx.lineWidth = el.strokeWidth || 1;
        ctx.stroke();
    }

    // ===== Draw table =====
    function drawTable(ctx, el) {
        const x = el.x * EMU_TO_PT;
        const y = el.y * EMU_TO_PT;
        const totalW = el.cx * EMU_TO_PT;
        const totalH = el.cy * EMU_TO_PT;

        // Calculate column widths
        const totalColEmu = el.gridCols.reduce((s, c) => s + c, 0) || 1;
        const colWidths = el.gridCols.map(c => (c / totalColEmu) * totalW);

        // Calculate row heights
        const totalRowH = el.rows.reduce((s, r) => s + r.height, 0) || 1;
        const rowHeights = el.rows.map(r => (r.height / totalRowH) * totalH);

        let curY = y;
        for (let ri = 0; ri < el.rows.length; ri++) {
            let curX = x;
            const rh = rowHeights[ri];

            for (let ci = 0; ci < el.rows[ri].cells.length && ci < colWidths.length; ci++) {
                const cell = el.rows[ri].cells[ci];
                const cw = colWidths[ci];

                // Cell background
                if (cell.fill) {
                    ctx.fillStyle = cell.fill;
                    ctx.fillRect(curX, curY, cw, rh);
                }

                // Cell border
                ctx.strokeStyle = '#d0d0d0';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(curX, curY, cw, rh);

                // Cell text
                if (cell.textRuns && cell.textRuns.length > 0) {
                    drawText(ctx, cell.textRuns, curX + 4, curY + 2, cw - 8, rh - 4);
                }

                curX += cw;
            }
            curY += rh;
        }
    }

    // ===== Draw text =====
    function drawText(ctx, textRuns, x, y, maxW, maxH) {
        if (!textRuns || textRuns.length === 0) return;

        // Simple text rendering: wrap lines within bounds
        let curY = y;
        const padding = 4;
        let lineRuns = [];
        let lineHeight = 0;

        for (const run of textRuns) {
            if (run.text === '\n') {
                // Render accumulated line
                if (lineRuns.length > 0) {
                    curY += renderTextLine(ctx, lineRuns, x + padding, curY + padding, maxW - padding * 2, lineHeight);
                } else {
                    curY += (run.fontSize || 12) * 1.3;
                }
                lineRuns = [];
                lineHeight = 0;
                continue;
            }

            if (run.text === '') continue;

            lineRuns.push(run);
            lineHeight = Math.max(lineHeight, (run.fontSize || 12) * 1.3);
        }

        // Render last line
        if (lineRuns.length > 0) {
            renderTextLine(ctx, lineRuns, x + padding, curY + padding, maxW - padding * 2, lineHeight);
        }
    }

    function renderTextLine(ctx, runs, x, y, maxW, lineHeight) {
        if (runs.length === 0) return lineHeight || 16;

        // Determine alignment from first run
        const align = runs[0].align || 'left';

        // Calculate total text width
        let totalWidth = 0;
        const measurements = [];
        for (const run of runs) {
            const fontSize = run.fontSize || 12;
            const weight = run.bold ? 'bold' : 'normal';
            const style = run.italic ? 'italic' : 'normal';
            const family = sanitizeFont(run.fontFamily || 'Calibri');
            ctx.font = `${style} ${weight} ${fontSize}pt ${family}`;

            let text = run.text;
            if (run.bulletChar) text = run.bulletChar + ' ' + text;
            if (run.indent > 0) text = '  '.repeat(run.indent) + text;

            const w = ctx.measureText(text).width;
            measurements.push({ run, text, width: w, fontSize, weight, style, family });
            totalWidth += w;
        }

        // Calculate x offset for alignment
        let offsetX = 0;
        if (align === 'center') offsetX = Math.max(0, (maxW - totalWidth) / 2);
        else if (align === 'right') offsetX = Math.max(0, maxW - totalWidth);

        // Render each run
        let curX = x + offsetX;
        for (const m of measurements) {
            ctx.font = `${m.style} ${m.weight} ${m.fontSize}pt ${m.family}`;
            ctx.fillStyle = m.run.color || '#000000';
            ctx.textBaseline = 'top';
            ctx.fillText(m.text, curX, y, maxW);

            // Underline
            if (m.run.underline) {
                const lineY = y + m.fontSize + 1;
                ctx.beginPath();
                ctx.moveTo(curX, lineY);
                ctx.lineTo(curX + m.width, lineY);
                ctx.strokeStyle = m.run.color || '#000000';
                ctx.lineWidth = Math.max(0.5, m.fontSize / 18);
                ctx.stroke();
            }

            curX += m.width;
        }

        return lineHeight || 16;
    }

    function sanitizeFont(font) {
        // Map common PPT fonts to web-safe equivalents
        const map = {
            'calibri': 'Calibri, Arial, sans-serif',
            'arial': 'Arial, Helvetica, sans-serif',
            'times new roman': 'Times New Roman, serif',
            'courier new': 'Courier New, monospace',
            'verdana': 'Verdana, Geneva, sans-serif',
            'georgia': 'Georgia, serif',
            'tahoma': 'Tahoma, Geneva, sans-serif',
            'trebuchet ms': 'Trebuchet MS, sans-serif',
            'impact': 'Impact, sans-serif',
            'comic sans ms': 'Comic Sans MS, cursive',
            'segoe ui': 'Segoe UI, Arial, sans-serif',
            'century gothic': 'Century Gothic, sans-serif',
            'garamond': 'Garamond, serif',
            'book antiqua': 'Book Antiqua, Palatino, serif',
            'palatino linotype': 'Palatino Linotype, Palatino, serif',
            'cambria': 'Cambria, Georgia, serif',
            'consolas': 'Consolas, Courier New, monospace',
        };
        const lower = font.toLowerCase().replace(/['"]/g, '');
        return map[lower] || `"${font}", sans-serif`;
    }

    // ===== Render slide previews in the UI =====
    function renderSlidePreviews() {
        const grid = document.getElementById('p2pSlidesGrid');
        const countEl = document.getElementById('p2pSlideCount');
        if (!grid) return;

        countEl.textContent = `${slides.length} slide${slides.length !== 1 ? 's' : ''}`;

        const nameEl = document.getElementById('p2pFileName');
        const metaEl = document.getElementById('p2pFileMeta');
        if (nameEl) nameEl.textContent = pptxFile.name;
        if (metaEl) metaEl.textContent = `${slides.length} slides • ${ToolUtils.formatBytes(pptxFile.size)}`;

        grid.innerHTML = slideImages.map((dataUrl, i) => `
            <div class="p2p-slide-thumb">
                <div class="p2p-slide-number">${i + 1}</div>
                <div class="p2p-slide-img-wrap">
                    <img src="${dataUrl}" alt="Slide ${i + 1}">
                </div>
            </div>
        `).join('');
    }

    // ===== Convert to PDF =====
    async function convertToPDF() {
        if (isConverting || slides.length === 0) return;
        isConverting = true;

        showSection('converting');
        updateStatus('Loading PDF library...');
        updateProgress(0);

        try {
            await loadJsPDF();
            updateProgress(5);

            const qualityEl = document.querySelector('#p2pQuality .p2p-option.active');
            const scale = parseInt(qualityEl?.dataset.value || '2');

            // Render slides at full quality
            const ptW = slides[0].width * EMU_TO_PT;
            const ptH = slides[0].height * EMU_TO_PT;
            const orientation = ptW > ptH ? 'landscape' : 'landscape'; // slides are typically landscape

            const doc = new jsPDFLib({
                orientation: 'landscape',
                unit: 'pt',
                format: [ptW, ptH]
            });

            for (let i = 0; i < slides.length; i++) {
                updateStatus(`Rendering slide ${i + 1} of ${slides.length}...`);
                updateProgress(5 + Math.round((i / slides.length) * 85));

                if (i > 0) {
                    doc.addPage([ptW, ptH], 'landscape');
                }

                const dataUrl = await renderSlideToCanvas(slides[i], scale);
                doc.addImage(dataUrl, 'JPEG', 0, 0, ptW, ptH, undefined, 'FAST');
            }

            updateStatus('Finalizing PDF...');
            updateProgress(95);

            const pdfBlob = doc.output('blob');
            const sizeStr = ToolUtils.formatBytes(pdfBlob.size);

            updateProgress(100);

            // Show done
            showSection('done');
            const infoEl = document.getElementById('p2pDoneInfo');
            if (infoEl) infoEl.textContent = `${slides.length} slides • ${sizeStr}`;

            const dlBtn = document.getElementById('p2pDownloadBtn');
            if (dlBtn) dlBtn._pdfBlob = pdfBlob;

            // Inject cross-tool chaining actions
            if (window.ToolChain && dlBtn._pdfBlob) {
                const name = (pptxFile ? pptxFile.name.replace(/\.pptx$/i, '') : 'presentation') + '.pdf';
                const chainContainer = document.getElementById('p2pChainActions');
                if (chainContainer) {
                    ToolChain.inject(chainContainer, dlBtn._pdfBlob, name, 'ppt-to-pdf');
                }
            }

        } catch (err) {
            console.error('PDF conversion failed:', err);
            alert('Failed to convert to PDF. Please try again.\n\nError: ' + err.message);
            showSection('preview');
        }

        isConverting = false;
    }

    // ===== UI Helpers =====
    function showSection(section) {
        const banner = document.getElementById('p2pInfoBanner');
        const upload = document.getElementById('p2pUploadSection');
        const preview = document.getElementById('p2pPreviewSection');
        const converting = document.getElementById('p2pConvertingSection');
        const done = document.getElementById('p2pDoneSection');

        if (banner) banner.style.display = (section === 'upload' || section === 'preview') ? 'flex' : 'none';
        if (upload) upload.style.display = section === 'upload' ? 'block' : 'none';
        if (preview) preview.style.display = section === 'preview' ? 'block' : 'none';
        if (converting) converting.style.display = section === 'converting' ? 'block' : 'none';
        if (done) done.style.display = section === 'done' ? 'block' : 'none';
    }

    function updateStatus(text) {
        const el = document.getElementById('p2pConvertStatus');
        if (el) el.textContent = text;
    }

    function updateProgress(pct) {
        const fill = document.getElementById('p2pProgressFill');
        const text = document.getElementById('p2pProgressText');
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = Math.round(pct) + '%';
    }

    function resetTool() {
        pptxFile = null;
        slides = [];
        slideImages = [];
        isConverting = false;
        showSection('upload');
        const fi = document.getElementById('p2pFileInput');
        if (fi) fi.value = '';
    }

})();
