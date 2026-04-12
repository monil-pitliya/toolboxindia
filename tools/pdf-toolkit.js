/* =============================================
   ToolBox India — PDF Toolkit (All-in-One)

   Merge, Split, Extract, Delete, Rotate, Reorder,
   PDF→Images, Compress (with target size), PDF→Word,
   Add Page Numbers, Watermark, Protect PDF

   Uses:
   • pdf-lib   — create, merge, split, modify PDFs
   • pdf.js    — render PDF pages as thumbnails / images
   • JSZip     — bundle multiple files for download
   • docx      — generate Word .docx files

   100% client-side. Zero server uploads.
   ============================================= */

(function () {
    'use strict';

    // ===== Library Cache =====
    let pdfLib = null;
    let pdfjsLib = null;
    let JSZip = null;
    let docxLib = null;

    // ===== Current Feature State =====
    let currentFeature = null;
    let loadedPdfBytes = null;
    let loadedPdfDoc = null;
    let loadedFileName = '';
    let renderDoc = null;
    let pageStates = [];
    let mergeFiles = [];
    let playgroundSources = []; // [{name, bytes, doc, renderDoc, pageCount}]
    let playgroundPages = [];   // [{srcIndex, srcPage, selected, rotation, thumbnail}]
    let isWorking = false;

    // ===== Feature Definitions =====
    const FEATURES = [
        { id: 'merge',      icon: '📎', title: 'Merge PDFs',        desc: 'Combine multiple PDFs into one single file',             color: '#f093fb, #f5576c' },
        { id: 'split',      icon: '✂️', title: 'Split PDF',         desc: 'Split a PDF into separate pages or custom ranges',       color: '#4facfe, #00f2fe' },
        { id: 'compress',   icon: '📦', title: 'Compress PDF',      desc: 'Reduce PDF file size — pick a target size or level',     color: '#f6d365, #fda085' },
        { id: 'pdf2word',   icon: '📝', title: 'PDF to Word',       desc: 'Convert PDF to editable Word (.docx) document',          color: '#2196F3, #21CBF3' },
        { id: 'pdf2img',    icon: '🖼️', title: 'PDF to Images',     desc: 'Convert every page into JPG or PNG images',              color: '#667eea, #764ba2' },
        { id: 'extract',    icon: '📋', title: 'Extract Pages',     desc: 'Pick specific pages and save them as a new PDF',         color: '#43e97b, #38f9d7' },
        { id: 'delete',     icon: '🗑️', title: 'Delete Pages',      desc: 'Remove unwanted pages from your PDF',                   color: '#fa709a, #fee140' },
        { id: 'rotate',     icon: '🔄', title: 'Rotate Pages',      desc: 'Rotate pages by 90°, 180°, or 270°',                   color: '#a18cd1, #fbc2eb' },
        { id: 'reorder',    icon: '↕️', title: 'Reorder Pages',     desc: 'Drag & drop to rearrange pages in any order',            color: '#fccb90, #d57eeb' },
        { id: 'pagenums',   icon: '🔢', title: 'Add Page Numbers',  desc: 'Add page numbers to every page in your PDF',             color: '#0ba360, #3cba92' },
        { id: 'watermark',  icon: '💧', title: 'Add Watermark',     desc: 'Add text watermark across all pages of your PDF',        color: '#6a11cb, #2575fc' },
        { id: 'protect',    icon: '🔒', title: 'Protect PDF',       desc: 'Add password protection to your PDF file',               color: '#e53e3e, #e85d5d' },
        { id: 'playground', icon: '🎪', title: 'PDF Playground',    desc: 'Upload multiple PDFs, pick pages, reorder, rotate & merge — all in one go', color: '#ff6b6b, #feca57' },
    ];

    // ===== Register Tool =====
    ToolRegistry.register('pdf-toolkit', {
        title: 'PDF Toolkit',
        description: 'All-in-one PDF editor — merge, split, compress, convert to Word/images, add watermark, page numbers, protect & more. 100% in-browser.',
        category: 'PDF Tools',
        tags: ['pdf', 'merge pdf', 'split pdf', 'compress pdf', 'rotate pdf', 'extract pages', 'delete pages', 'pdf to image', 'pdf to word', 'reorder pdf', 'pdf editor', 'combine pdf', 'watermark', 'page numbers', 'protect pdf', 'password pdf'],

        render() {
            return `
                <div id="pdftkRoot">
                    <div id="pdftkHub">
                        <div class="pdftk-hub-header">
                            <h2>What do you want to do with your PDF?</h2>
                            <p>Pick a feature below — everything runs 100% in your browser, your files never leave your device.</p>
                        </div>
                        <div class="pdftk-features-grid">
                            ${FEATURES.map(f => `
                                <button class="pdftk-feature-card" data-feature="${f.id}">
                                    <div class="pdftk-feature-icon" style="background: linear-gradient(135deg, ${f.color});">${f.icon}</div>
                                    <div class="pdftk-feature-info">
                                        <strong>${f.title}</strong>
                                        <span>${f.desc}</span>
                                    </div>
                                    <svg class="pdftk-feature-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <div id="pdftkWorkspace" style="display:none;">
                        <div class="pdftk-topbar">
                            <button class="pdftk-back-btn" id="pdftkBackBtn">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                                All Tools
                            </button>
                            <h3 id="pdftkFeatureTitle"></h3>
                        </div>

                        <div id="pdftkUploadArea">
                            <div class="tool-workspace">
                                <div class="drop-zone" id="pdftkDropZone">
                                    <span class="drop-zone-icon">📄</span>
                                    <h3 class="drop-zone-title" id="pdftkDropTitle">Drop your PDF here</h3>
                                    <p class="drop-zone-subtitle" id="pdftkDropSubtitle">We'll load it and show you the pages</p>
                                    <button class="drop-zone-btn" onclick="document.getElementById('pdftkFileInput').click()">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                        <span id="pdftkBtnLabel">Choose PDF</span>
                                    </button>
                                    <input type="file" id="pdftkFileInput" accept="application/pdf" style="display:none">
                                    <input type="file" id="pdftkFileInputMulti" accept="application/pdf" multiple style="display:none">
                                    <p class="drop-zone-info">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                        PDF files only &bull; Max 50MB &bull; 100% private
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div id="pdftkLoading" style="display:none;">
                            <div class="pdftk-loading-card">
                                <div class="bgr-spinner"></div>
                                <h3 id="pdftkLoadingTitle">Loading PDF...</h3>
                                <p id="pdftkLoadingText">Reading pages and generating thumbnails</p>
                            </div>
                        </div>

                        <div id="pdftkEditor" style="display:none;"></div>
                        <div id="pdftkDone" style="display:none;"></div>
                    </div>

                    <!-- Page Preview Modal -->
                    <div class="pdftk-preview-overlay" id="pdftkPreviewOverlay">
                        <div class="pdftk-preview-modal">
                            <div class="pdftk-preview-topbar">
                                <span class="pdftk-preview-title" id="pdftkPreviewTitle">Page 1</span>
                                <button class="pdftk-preview-close" id="pdftkPreviewClose" title="Close (Esc)">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>
                            <div class="pdftk-preview-body" id="pdftkPreviewBody">
                                <div class="bgr-spinner"></div>
                            </div>
                            <div class="pdftk-preview-nav">
                                <button class="pdftk-preview-nav-btn" id="pdftkPreviewPrev" title="Previous page">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
                                    Prev
                                </button>
                                <span class="pdftk-preview-counter" id="pdftkPreviewCounter">1 / 10</span>
                                <button class="pdftk-preview-nav-btn" id="pdftkPreviewNext" title="Next page">
                                    Next
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        init() {
            initHub();
            initDropZone();
            initPreviewModal();
            document.getElementById('pdftkBackBtn')?.addEventListener('click', goBackToHub);
        },

        destroy() {
            resetState();
            currentFeature = null;
        }
    });

    // ===== Hub =====
    function initHub() {
        setTimeout(() => {
            document.querySelectorAll('.pdftk-feature-card').forEach(card => {
                card.addEventListener('click', () => openFeature(card.dataset.feature));
            });
        }, 50);
    }

    function openFeature(featureId) {
        const feature = FEATURES.find(f => f.id === featureId);
        if (!feature) return;
        currentFeature = featureId;

        document.getElementById('pdftkHub').style.display = 'none';
        document.getElementById('pdftkWorkspace').style.display = 'block';
        document.getElementById('pdftkFeatureTitle').textContent = feature.title;

        const isMulti = featureId === 'merge' || featureId === 'playground';
        const dropTitle = document.getElementById('pdftkDropTitle');
        const dropSub = document.getElementById('pdftkDropSubtitle');
        const btnLabel = document.getElementById('pdftkBtnLabel');
        const dropBtn = document.querySelector('#pdftkDropZone .drop-zone-btn');
        const multiInput = document.getElementById('pdftkFileInputMulti');
        const fileInput = document.getElementById('pdftkFileInput');

        if (featureId === 'playground') {
            dropTitle.textContent = 'Drop your PDFs here';
            dropSub.textContent = 'Upload one or more PDFs — pick pages, reorder, rotate & merge in one workspace';
            btnLabel.textContent = 'Choose PDFs';
            dropBtn.onclick = () => multiInput.click();
        } else if (featureId === 'merge') {
            dropTitle.textContent = 'Drop multiple PDFs here';
            dropSub.textContent = 'All files will be combined into a single PDF';
            btnLabel.textContent = 'Choose PDFs';
            dropBtn.onclick = () => multiInput.click();
        } else {
            dropTitle.textContent = 'Drop your PDF here';
            dropSub.textContent = feature.desc;
            btnLabel.textContent = 'Choose PDF';
            dropBtn.onclick = () => fileInput.click();
        }

        showWorkspaceSection('upload');
    }

    function goBackToHub() {
        resetState();
        document.getElementById('pdftkHub').style.display = 'block';
        document.getElementById('pdftkWorkspace').style.display = 'none';
    }

    // ===== Drop Zone =====
    function initDropZone() {
        const dropZone = document.getElementById('pdftkDropZone');
        const fileInput = document.getElementById('pdftkFileInput');
        const multiInput = document.getElementById('pdftkFileInputMulti');
        if (!dropZone) return;

        fileInput?.addEventListener('change', (e) => {
            if (e.target.files[0]) handleSinglePdf(e.target.files[0]);
        });
        multiInput?.addEventListener('change', (e) => {
            if (!e.target.files.length) return;
            if (currentFeature === 'playground') handlePlaygroundPdfs(Array.from(e.target.files));
            else handleMergePdfs(Array.from(e.target.files));
        });

        ['dragenter', 'dragover'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        });
        ['dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
        });
        dropZone.addEventListener('drop', (e) => {
            const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
            if (!files.length) return;
            if (currentFeature === 'playground') handlePlaygroundPdfs(files);
            else if (currentFeature === 'merge') handleMergePdfs(files);
            else handleSinglePdf(files[0]);
        });
    }

    // ===== Load Libraries =====
    let hasEncryptLib = false;
    async function ensureLibraries(opts = {}) {
        if (opts.encrypt && !hasEncryptLib) {
            // Load pdf-lib-plus-encrypt (superset of pdf-lib with .encrypt() support)
            await loadScript('https://cdn.jsdelivr.net/npm/pdf-lib-plus-encrypt@1.1.0/dist/pdf-lib-plus-encrypt.min.js');
            pdfLib = window.PDFLib;
            hasEncryptLib = true;
        } else if (!pdfLib) {
            await loadScript('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js');
            pdfLib = window.PDFLib;
        }
        if (opts.pdfjs && !pdfjsLib) {
            await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
            pdfjsLib = window.pdfjsLib;
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        }
        if (opts.zip && !JSZip) {
            await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
            JSZip = window.JSZip;
        }
        if (opts.docx && !docxLib) {
            await loadScript('https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.min.js');
            docxLib = window.docx;
        }
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Failed to load: ' + src));
            document.head.appendChild(s);
        });
    }

    // ===== Handle Single PDF =====
    async function handleSinglePdf(file) {
        if (isWorking) return;
        if (file.size > 50 * 1024 * 1024) { alert('File too large. Max 50MB.'); return; }
        isWorking = true;
        loadedFileName = file.name;
        showWorkspaceSection('loading');
        updateLoading('Loading libraries...', 'Setting up PDF engine');

        try {
            const needThumbs = ['split','extract','delete','rotate','reorder'].includes(currentFeature);
            const needPdfJs = needThumbs || currentFeature === 'pdf2img' || currentFeature === 'pdf2word' || currentFeature === 'compress';
            const needZip = ['split','pdf2img'].includes(currentFeature);
            const needDocx = currentFeature === 'pdf2word';
            const needEncrypt = currentFeature === 'protect';
            await ensureLibraries({ pdfjs: needPdfJs, zip: needZip, docx: needDocx, encrypt: needEncrypt });

            updateLoading('Reading PDF...', 'Parsing pages');
            loadedPdfBytes = await file.arrayBuffer();
            loadedPdfDoc = await pdfLib.PDFDocument.load(loadedPdfBytes, { ignoreEncryption: true });
            const totalPages = loadedPdfDoc.getPageCount();

            if (needPdfJs) {
                updateLoading('Generating thumbnails...', `${totalPages} pages found`);
                renderDoc = await pdfjsLib.getDocument({ data: loadedPdfBytes.slice(0) }).promise;
            }

            if (needThumbs) {
                pageStates = [];
                for (let i = 0; i < totalPages; i++) {
                    const thumb = await renderPageThumbnail(i + 1, 160);
                    pageStates.push({ page: i + 1, selected: true, rotation: 0, thumbnail: thumb });
                }
            } else {
                pageStates = [];
                for (let i = 0; i < totalPages; i++) {
                    pageStates.push({ page: i + 1, selected: true, rotation: 0, thumbnail: null });
                }
            }

            buildEditor(file.name, totalPages);
        } catch (err) {
            console.error('PDF load error:', err);
            alert('Could not read this PDF. It may be corrupted or password-protected.');
            showWorkspaceSection('upload');
        }
        isWorking = false;
    }

    // ===== Handle Merge =====
    async function handleMergePdfs(files) {
        if (isWorking) return;
        isWorking = true;
        showWorkspaceSection('loading');
        updateLoading('Loading libraries...', 'Setting up PDF engine');
        try {
            await ensureLibraries({});
            mergeFiles = [];
            for (let i = 0; i < files.length; i++) {
                updateLoading(`Reading file ${i + 1} of ${files.length}...`, files[i].name);
                const bytes = await files[i].arrayBuffer();
                const doc = await pdfLib.PDFDocument.load(bytes, { ignoreEncryption: true });
                mergeFiles.push({ name: files[i].name, bytes, pageCount: doc.getPageCount() });
            }
            buildMergeEditor();
        } catch (err) {
            console.error('Merge load error:', err);
            alert('Could not read one of the PDFs.');
            showWorkspaceSection('upload');
        }
        isWorking = false;
    }

    // ===== Render Thumbnail =====
    async function renderPageThumbnail(pageNum, maxHeight) {
        const page = await renderDoc.getPage(pageNum);
        const vp = page.getViewport({ scale: 1 });
        const scale = maxHeight / vp.height;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.7);
    }

    // ===== Build Editor UI (Router) =====
    function buildEditor(fileName, totalPages) {
        const editor = document.getElementById('pdftkEditor');
        const featureBuilders = {
            compress:   () => buildCompressUI(fileName, totalPages),
            pdf2img:    () => buildPdf2ImgUI(fileName, totalPages),
            pdf2word:   () => buildPdf2WordUI(fileName, totalPages),
            pagenums:   () => buildPageNumsUI(fileName, totalPages),
            watermark:  () => buildWatermarkUI(fileName, totalPages),
            protect:    () => buildProtectUI(fileName, totalPages),
        };

        const builder = featureBuilders[currentFeature];
        if (builder) {
            editor.innerHTML = builder();
            showWorkspaceSection('editor');
            initGenericActions();
            return;
        }

        // Page-grid based features: split, extract, delete, rotate, reorder
        const showSelect = ['extract', 'delete', 'split'].includes(currentFeature);
        const showRotate = currentFeature === 'rotate';
        const isDraggable = currentFeature === 'reorder';
        const instructions = {
            split:   'Select pages to form new PDFs, or split every page into individual files.',
            extract: 'Click pages to select which ones to keep in the new PDF.',
            delete:  'Click pages to mark them for deletion (grayed out = will be removed).',
            rotate:  'Click on a page to rotate it 90° clockwise. Click multiple times for more rotation.',
            reorder: 'Drag and drop pages to rearrange their order.',
        };

        editor.innerHTML = `
            <div class="pdftk-editor-info">
                <span class="pdftk-file-badge">📄 ${escHtml(fileName)} — ${totalPages} page${totalPages !== 1 ? 's' : ''}</span>
                <p>${instructions[currentFeature] || ''}</p>
            </div>
            ${currentFeature === 'split' ? buildSplitOptions() : ''}
            ${showSelect && currentFeature !== 'split' ? `
                <div class="pdftk-select-bar">
                    <button class="pdftk-sel-btn" data-action="all">Select All</button>
                    <button class="pdftk-sel-btn" data-action="none">Deselect All</button>
                    <button class="pdftk-sel-btn" data-action="invert">Invert</button>
                    <span class="pdftk-sel-count" id="pdftkSelCount">${totalPages} selected</span>
                </div>` : ''}
            <div class="pdftk-page-grid ${isDraggable ? 'pdftk-draggable' : ''}" id="pdftkPageGrid">
                ${pageStates.map((ps, i) => `
                    <div class="pdftk-page-thumb ${ps.selected ? 'selected' : ''}" data-index="${i}" ${isDraggable ? 'draggable="true"' : ''}>
                        <div class="pdftk-page-num">${ps.page}</div>
                        ${ps.thumbnail ? `<img src="${ps.thumbnail}" alt="Page ${ps.page}" style="transform:rotate(${ps.rotation}deg);">` : `<div class="pdftk-page-placeholder">Page ${ps.page}</div>`}
                        ${showRotate ? `<button class="pdftk-rotate-badge" title="Rotate 90°">↻</button>` : ''}
                        <button class="pdftk-preview-btn" data-preview-index="${i}" title="Preview page">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                        </button>
                    </div>
                `).join('')}
            </div>
            <div class="pdftk-action-bar">
                <button class="btn-primary pdftk-apply-btn" id="pdftkApplyBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    ${getApplyLabel()}
                </button>
            </div>
        `;
        showWorkspaceSection('editor');
        initEditorInteractions();
    }

    // ===== Feature-Specific UI Builders =====

    function buildCompressUI(fileName, totalPages) {
        const originalSize = loadedPdfBytes.byteLength;
        const origFormatted = ToolUtils.formatBytes(originalSize);
        return `
            <div class="pdftk-editor-info">
                <span class="pdftk-file-badge">📄 ${escHtml(fileName)} — ${totalPages} pages — ${origFormatted}</span>
                <p>Choose how you want to compress your PDF.</p>
            </div>
            <div class="i2p-settings" style="max-width:560px;margin:0 auto 24px;">
                <div class="i2p-setting-group">
                    <label class="i2p-label">Compression Method</label>
                    <div class="i2p-options" id="pdftkCompressMethod">
                        <button class="i2p-option active" data-value="smart">Smart (keeps text)</button>
                        <button class="i2p-option" data-value="target">Target File Size</button>
                    </div>
                </div>
                <div id="pdftkSmartOpts">
                    <div class="i2p-setting-group">
                        <label class="i2p-label">Compression Level</label>
                        <div class="i2p-options" id="pdftkCompressLevel">
                            <button class="i2p-option" data-value="low">Low</button>
                            <button class="i2p-option active" data-value="medium">Medium</button>
                            <button class="i2p-option" data-value="high">High</button>
                        </div>
                    </div>
                </div>
                <div id="pdftkTargetOpts" style="display:none;">
                    <div class="i2p-setting-group">
                        <label class="i2p-label">Target Size (current: ${origFormatted})</label>
                        <div class="pdftk-size-presets" id="pdftkSizePresets">
                            <button class="pdftk-size-btn" data-kb="200">200 KB</button>
                            <button class="pdftk-size-btn" data-kb="500">500 KB</button>
                            <button class="pdftk-size-btn active" data-kb="1024">1 MB</button>
                            <button class="pdftk-size-btn" data-kb="2048">2 MB</button>
                            <button class="pdftk-size-btn" data-kb="5120">5 MB</button>
                            <button class="pdftk-size-btn" data-kb="10240">10 MB</button>
                        </div>
                        <div class="pdftk-custom-size">
                            <input type="number" id="pdftkCustomSize" class="pdftk-text-input" placeholder="Custom size in KB" min="50" max="50000" style="max-width:200px;">
                            <span class="pdftk-hint">KB</span>
                        </div>
                        <p class="pdftk-hint">⚠️ Target mode renders pages as images — text won't be selectable in the output.</p>
                    </div>
                </div>
            </div>
            <div class="pdftk-action-bar">
                <button class="btn-primary pdftk-apply-btn" id="pdftkApplyBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Compress PDF
                </button>
            </div>
        `;
    }

    function buildPdf2ImgUI(fileName, totalPages) {
        return `
            <div class="pdftk-editor-info">
                <span class="pdftk-file-badge">📄 ${escHtml(fileName)} — ${totalPages} pages</span>
                <p>Select pages to convert to images, then choose format and quality.</p>
            </div>
            <div class="pdftk-select-bar">
                <button class="pdftk-sel-btn" data-action="all">Select All</button>
                <button class="pdftk-sel-btn" data-action="none">Deselect All</button>
                <button class="pdftk-sel-btn" data-action="invert">Invert</button>
                <span class="pdftk-sel-count" id="pdftkSelCount">${totalPages} selected</span>
            </div>
            <div class="pdftk-page-grid" id="pdftkPageGrid">
                ${pageStates.map((ps, i) => `
                    <div class="pdftk-page-thumb selected" data-index="${i}">
                        <div class="pdftk-page-num">${ps.page}</div>
                        ${ps.thumbnail ? `<img src="${ps.thumbnail}" alt="Page ${ps.page}">` : `<div class="pdftk-page-placeholder">Page ${ps.page}</div>`}
                        <button class="pdftk-preview-btn" data-preview-index="${i}" title="Preview page">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                        </button>
                    </div>
                `).join('')}
            </div>
            <div class="i2p-settings" style="max-width:500px;margin:0 auto 24px;">
                <div class="i2p-setting-group">
                    <label class="i2p-label">Format</label>
                    <div class="i2p-options" id="pdftkImgFormat">
                        <button class="i2p-option active" data-value="jpeg">JPG</button>
                        <button class="i2p-option" data-value="png">PNG</button>
                    </div>
                </div>
                <div class="i2p-setting-group">
                    <label class="i2p-label">Quality</label>
                    <div class="i2p-options" id="pdftkImgQuality">
                        <button class="i2p-option" data-value="1">Low (fast)</button>
                        <button class="i2p-option active" data-value="2">Medium</button>
                        <button class="i2p-option" data-value="3">High (large)</button>
                    </div>
                </div>
            </div>
            <div class="pdftk-action-bar">
                <button class="btn-primary pdftk-apply-btn" id="pdftkApplyBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Convert to Images
                </button>
            </div>
        `;
    }

    function buildPdf2WordUI(fileName, totalPages) {
        return `
            <div class="pdftk-editor-info">
                <span class="pdftk-file-badge">📄 ${escHtml(fileName)} — ${totalPages} pages</span>
                <p>Extract text from your PDF and create an editable Word document.</p>
            </div>
            <div class="i2p-settings" style="max-width:500px;margin:0 auto 24px;">
                <div class="i2p-setting-group">
                    <label class="i2p-label">Conversion Mode</label>
                    <div class="i2p-options" id="pdftkWordMode">
                        <button class="i2p-option active" data-value="text">Text Only (accurate)</button>
                        <button class="i2p-option" data-value="visual">Text + Page Images</button>
                    </div>
                </div>
                <div class="i2p-setting-group">
                    <label class="i2p-label">Font Size</label>
                    <div class="i2p-options" id="pdftkWordFontSize">
                        <button class="i2p-option" data-value="10">10pt</button>
                        <button class="i2p-option active" data-value="11">11pt</button>
                        <button class="i2p-option" data-value="12">12pt</button>
                        <button class="i2p-option" data-value="14">14pt</button>
                    </div>
                </div>
                <p class="pdftk-hint">💡 Works best with text-based PDFs. Scanned/image PDFs will have limited text extraction.</p>
            </div>
            <div class="pdftk-action-bar">
                <button class="btn-primary pdftk-apply-btn" id="pdftkApplyBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Convert to Word
                </button>
            </div>
        `;
    }

    function buildPageNumsUI(fileName, totalPages) {
        return `
            <div class="pdftk-editor-info">
                <span class="pdftk-file-badge">📄 ${escHtml(fileName)} — ${totalPages} pages</span>
                <p>Add page numbers to your PDF.</p>
            </div>
            <div class="i2p-settings" style="max-width:500px;margin:0 auto 24px;">
                <div class="i2p-setting-group">
                    <label class="i2p-label">Position</label>
                    <div class="i2p-options" id="pdftkNumPos">
                        <button class="i2p-option" data-value="top-left">Top Left</button>
                        <button class="i2p-option" data-value="top-center">Top Center</button>
                        <button class="i2p-option" data-value="top-right">Top Right</button>
                        <button class="i2p-option" data-value="bottom-left">Bottom Left</button>
                        <button class="i2p-option active" data-value="bottom-center">Bottom Center</button>
                        <button class="i2p-option" data-value="bottom-right">Bottom Right</button>
                    </div>
                </div>
                <div class="i2p-setting-group">
                    <label class="i2p-label">Format</label>
                    <div class="i2p-options" id="pdftkNumFormat">
                        <button class="i2p-option active" data-value="plain">1, 2, 3</button>
                        <button class="i2p-option" data-value="dash">- 1 -, - 2 -</button>
                        <button class="i2p-option" data-value="of">1 of ${totalPages}</button>
                        <button class="i2p-option" data-value="page">Page 1</button>
                    </div>
                </div>
                <div class="i2p-setting-group">
                    <label class="i2p-label">Font Size</label>
                    <div class="i2p-options" id="pdftkNumFontSize">
                        <button class="i2p-option" data-value="8">Small (8pt)</button>
                        <button class="i2p-option active" data-value="10">Medium (10pt)</button>
                        <button class="i2p-option" data-value="12">Large (12pt)</button>
                    </div>
                </div>
                <div class="i2p-setting-group">
                    <label class="i2p-label">Start From Page</label>
                    <input type="number" id="pdftkNumStart" class="pdftk-text-input" value="1" min="1" max="${totalPages}" style="max-width:120px;">
                </div>
            </div>
            <div class="pdftk-action-bar">
                <button class="btn-primary pdftk-apply-btn" id="pdftkApplyBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Add Page Numbers
                </button>
            </div>
        `;
    }

    function buildWatermarkUI(fileName, totalPages) {
        return `
            <div class="pdftk-editor-info">
                <span class="pdftk-file-badge">📄 ${escHtml(fileName)} — ${totalPages} pages</span>
                <p>Add a text watermark across all pages.</p>
            </div>
            <div class="i2p-settings" style="max-width:500px;margin:0 auto 24px;">
                <div class="i2p-setting-group">
                    <label class="i2p-label">Watermark Text</label>
                    <input type="text" id="pdftkWmText" class="pdftk-text-input" placeholder="e.g. CONFIDENTIAL, DRAFT, SAMPLE" value="CONFIDENTIAL" maxlength="50">
                </div>
                <div class="i2p-setting-group">
                    <label class="i2p-label">Font Size</label>
                    <div class="i2p-options" id="pdftkWmSize">
                        <button class="i2p-option" data-value="30">Small</button>
                        <button class="i2p-option active" data-value="50">Medium</button>
                        <button class="i2p-option" data-value="80">Large</button>
                        <button class="i2p-option" data-value="120">Extra Large</button>
                    </div>
                </div>
                <div class="i2p-setting-group">
                    <label class="i2p-label">Opacity</label>
                    <div class="i2p-options" id="pdftkWmOpacity">
                        <button class="i2p-option" data-value="0.08">Very Light</button>
                        <button class="i2p-option active" data-value="0.15">Light</button>
                        <button class="i2p-option" data-value="0.3">Medium</button>
                        <button class="i2p-option" data-value="0.5">Bold</button>
                    </div>
                </div>
                <div class="i2p-setting-group">
                    <label class="i2p-label">Color</label>
                    <div class="i2p-options" id="pdftkWmColor">
                        <button class="i2p-option active" data-value="gray">Gray</button>
                        <button class="i2p-option" data-value="red">Red</button>
                        <button class="i2p-option" data-value="blue">Blue</button>
                        <button class="i2p-option" data-value="black">Black</button>
                    </div>
                </div>
                <div class="i2p-setting-group">
                    <label class="i2p-label">Rotation</label>
                    <div class="i2p-options" id="pdftkWmRotation">
                        <button class="i2p-option" data-value="0">Horizontal</button>
                        <button class="i2p-option active" data-value="45">Diagonal ↗</button>
                        <button class="i2p-option" data-value="-45">Diagonal ↘</button>
                    </div>
                </div>
            </div>
            <div class="pdftk-action-bar">
                <button class="btn-primary pdftk-apply-btn" id="pdftkApplyBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Add Watermark
                </button>
            </div>
        `;
    }

    function buildProtectUI(fileName, totalPages) {
        return `
            <div class="pdftk-editor-info">
                <span class="pdftk-file-badge">📄 ${escHtml(fileName)} — ${totalPages} pages</span>
                <p>Add password protection to your PDF so only authorized people can open it.</p>
            </div>
            <div class="i2p-settings" style="max-width:500px;margin:0 auto 24px;">
                <div class="i2p-setting-group">
                    <label class="i2p-label">User Password (required to open)</label>
                    <input type="text" id="pdftkUserPass" class="pdftk-text-input" placeholder="Enter password" autocomplete="off">
                </div>
                <div class="i2p-setting-group">
                    <label class="i2p-label">Owner Password (for full access — optional)</label>
                    <input type="text" id="pdftkOwnerPass" class="pdftk-text-input" placeholder="Leave empty to use same as user password" autocomplete="off">
                    <p class="pdftk-hint">The owner password grants full editing/printing rights. If blank, the user password is used.</p>
                </div>
            </div>
            <div class="pdftk-action-bar">
                <button class="btn-primary pdftk-apply-btn" id="pdftkApplyBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Protect PDF
                </button>
            </div>
        `;
    }

    function buildSplitOptions() {
        return `
            <div class="pdftk-split-options">
                <label class="pdftk-label">Split Method</label>
                <div class="i2p-options" id="pdftkSplitMode">
                    <button class="i2p-option active" data-value="all">Every Page</button>
                    <button class="i2p-option" data-value="range">Custom Ranges</button>
                    <button class="i2p-option" data-value="selected">Selected Pages</button>
                </div>
                <div id="pdftkRangeInput" style="display:none;margin-top:12px;">
                    <input type="text" class="pdftk-text-input" id="pdftkRangeText" placeholder="e.g. 1-3, 5, 7-10">
                    <p class="pdftk-hint">Separate ranges with commas. Each range becomes a separate PDF.</p>
                </div>
            </div>
        `;
    }

    function buildMergeEditor() {
        const editor = document.getElementById('pdftkEditor');
        const totalPages = mergeFiles.reduce((s, f) => s + f.pageCount, 0);
        editor.innerHTML = `
            <div class="pdftk-editor-info">
                <span class="pdftk-file-badge">📎 ${mergeFiles.length} files — ${totalPages} total pages</span>
                <p>Drag files to rearrange the order they'll appear in the merged PDF.</p>
            </div>
            <div class="pdftk-merge-list" id="pdftkMergeList">
                ${mergeFiles.map((f, i) => `
                    <div class="pdftk-merge-item" draggable="true" data-index="${i}">
                        <span class="pdftk-merge-handle">⠿</span>
                        <div class="pdftk-merge-info">
                            <strong>${escHtml(f.name)}</strong>
                            <span>${f.pageCount} page${f.pageCount !== 1 ? 's' : ''}</span>
                        </div>
                        <button class="pdftk-merge-remove" data-index="${i}">✕</button>
                    </div>
                `).join('')}
            </div>
            <div class="pdftk-merge-add">
                <button class="i2p-add-more-btn" id="pdftkMergeAddMore">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add More PDFs
                </button>
                <input type="file" id="pdftkMergeMoreInput" accept="application/pdf" multiple style="display:none;">
            </div>
            <div class="pdftk-action-bar">
                <button class="btn-primary pdftk-apply-btn" id="pdftkApplyBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Merge ${mergeFiles.length} PDFs
                </button>
            </div>
        `;
        showWorkspaceSection('editor');
        initMergeInteractions();
    }

    // ===== Generic Actions Init (for settings-only features) =====
    function initGenericActions() {
        document.getElementById('pdftkApplyBtn')?.addEventListener('click', applyFeature);

        // All option groups
        document.querySelectorAll('#pdftkEditor .i2p-options').forEach(group => {
            group.addEventListener('click', (e) => {
                const btn = e.target.closest('.i2p-option');
                if (!btn) return;
                group.querySelectorAll('.i2p-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Compress method toggle
        const compressMethod = document.getElementById('pdftkCompressMethod');
        if (compressMethod) {
            compressMethod.addEventListener('click', () => {
                const active = compressMethod.querySelector('.i2p-option.active')?.dataset.value;
                const smartOpts = document.getElementById('pdftkSmartOpts');
                const targetOpts = document.getElementById('pdftkTargetOpts');
                if (smartOpts) smartOpts.style.display = active === 'smart' ? 'block' : 'none';
                if (targetOpts) targetOpts.style.display = active === 'target' ? 'block' : 'none';
            });
        }

        // Target size presets
        const presets = document.getElementById('pdftkSizePresets');
        if (presets) {
            presets.addEventListener('click', (e) => {
                const btn = e.target.closest('.pdftk-size-btn');
                if (!btn) return;
                presets.querySelectorAll('.pdftk-size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const customInput = document.getElementById('pdftkCustomSize');
                if (customInput) customInput.value = '';
            });
        }

        // Custom size clears preset selection
        const customSize = document.getElementById('pdftkCustomSize');
        if (customSize) {
            customSize.addEventListener('input', () => {
                const presets = document.getElementById('pdftkSizePresets');
                if (presets) presets.querySelectorAll('.pdftk-size-btn').forEach(b => b.classList.remove('active'));
            });
        }

        // Select bar for pdf2img
        initSelectBar();
    }

    function initSelectBar() {
        const grid = document.getElementById('pdftkPageGrid');
        if (!grid) return;

        grid.addEventListener('click', (e) => {
            // Preview button
            const previewBtn = e.target.closest('.pdftk-preview-btn');
            if (previewBtn) {
                e.stopPropagation();
                const idx = parseInt(previewBtn.dataset.previewIndex);
                openPreviewModal('regular', idx);
                return;
            }

            const thumb = e.target.closest('.pdftk-page-thumb');
            if (!thumb) return;
            const idx = parseInt(thumb.dataset.index);
            if (['extract', 'delete', 'split', 'pdf2img'].includes(currentFeature)) {
                pageStates[idx].selected = !pageStates[idx].selected;
                thumb.classList.toggle('selected', pageStates[idx].selected);
                updateSelCount();
            }
        });

        document.querySelectorAll('.pdftk-sel-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                pageStates.forEach(ps => {
                    if (action === 'all') ps.selected = true;
                    else if (action === 'none') ps.selected = false;
                    else if (action === 'invert') ps.selected = !ps.selected;
                });
                grid.querySelectorAll('.pdftk-page-thumb').forEach((el, i) => {
                    el.classList.toggle('selected', pageStates[i].selected);
                });
                updateSelCount();
            });
        });
    }

    // ===== Editor Interactions (page grid) =====
    function initEditorInteractions() {
        const grid = document.getElementById('pdftkPageGrid');
        if (!grid) return;

        grid.addEventListener('click', (e) => {
            // Preview button — open modal
            const previewBtn = e.target.closest('.pdftk-preview-btn');
            if (previewBtn) {
                e.stopPropagation();
                const idx = parseInt(previewBtn.dataset.previewIndex);
                openPreviewModal('regular', idx);
                return;
            }

            const thumb = e.target.closest('.pdftk-page-thumb');
            if (!thumb) return;
            const idx = parseInt(thumb.dataset.index);

            if (currentFeature === 'rotate' && e.target.closest('.pdftk-rotate-badge')) {
                pageStates[idx].rotation = (pageStates[idx].rotation + 90) % 360;
                const img = thumb.querySelector('img');
                if (img) img.style.transform = `rotate(${pageStates[idx].rotation}deg)`;
                return;
            }

            if (['extract', 'delete', 'split', 'pdf2img'].includes(currentFeature)) {
                pageStates[idx].selected = !pageStates[idx].selected;
                thumb.classList.toggle('selected', pageStates[idx].selected);
                updateSelCount();
            }
        });

        document.querySelectorAll('.pdftk-sel-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                pageStates.forEach(ps => {
                    if (action === 'all') ps.selected = true;
                    else if (action === 'none') ps.selected = false;
                    else if (action === 'invert') ps.selected = !ps.selected;
                });
                grid.querySelectorAll('.pdftk-page-thumb').forEach((el, i) => {
                    el.classList.toggle('selected', pageStates[i].selected);
                });
                updateSelCount();
            });
        });

        // Split mode toggle
        const splitMode = document.getElementById('pdftkSplitMode');
        if (splitMode) {
            splitMode.addEventListener('click', (e) => {
                const btn = e.target.closest('.i2p-option');
                if (!btn) return;
                splitMode.querySelectorAll('.i2p-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const rangeInput = document.getElementById('pdftkRangeInput');
                if (rangeInput) rangeInput.style.display = btn.dataset.value === 'range' ? 'block' : 'none';
            });
        }

        // Drag-to-reorder
        if (currentFeature === 'reorder') {
            let draggedEl = null;
            grid.querySelectorAll('.pdftk-page-thumb').forEach(thumb => {
                thumb.addEventListener('dragstart', (e) => {
                    draggedEl = thumb;
                    thumb.classList.add('i2p-dragging');
                    e.dataTransfer.effectAllowed = 'move';
                });
                thumb.addEventListener('dragend', () => {
                    thumb.classList.remove('i2p-dragging');
                    draggedEl = null;
                    reorderPagesFromDOM();
                });
                thumb.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (!draggedEl || draggedEl === thumb) return;
                    const rect = thumb.getBoundingClientRect();
                    const mid = rect.left + rect.width / 2;
                    if (e.clientX < mid) grid.insertBefore(draggedEl, thumb);
                    else grid.insertBefore(draggedEl, thumb.nextSibling);
                });
            });
        }

        document.getElementById('pdftkApplyBtn')?.addEventListener('click', applyFeature);

        document.querySelectorAll('#pdftkEditor .i2p-options').forEach(group => {
            group.addEventListener('click', (e) => {
                const btn = e.target.closest('.i2p-option');
                if (!btn) return;
                group.querySelectorAll('.i2p-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    function initMergeInteractions() {
        const list = document.getElementById('pdftkMergeList');
        if (!list) return;

        let dragEl = null;
        list.querySelectorAll('.pdftk-merge-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                dragEl = item; item.classList.add('i2p-dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            item.addEventListener('dragend', () => {
                item.classList.remove('i2p-dragging'); dragEl = null;
                const newOrder = Array.from(list.querySelectorAll('.pdftk-merge-item')).map(el => parseInt(el.dataset.index));
                mergeFiles = newOrder.map(i => mergeFiles[i]);
                buildMergeEditor();
            });
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!dragEl || dragEl === item) return;
                const rect = item.getBoundingClientRect();
                const mid = rect.top + rect.height / 2;
                if (e.clientY < mid) list.insertBefore(dragEl, item);
                else list.insertBefore(dragEl, item.nextSibling);
            });
        });

        list.querySelectorAll('.pdftk-merge-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                mergeFiles.splice(parseInt(btn.dataset.index), 1);
                if (mergeFiles.length === 0) { showWorkspaceSection('upload'); return; }
                buildMergeEditor();
            });
        });

        const addBtn = document.getElementById('pdftkMergeAddMore');
        const addInput = document.getElementById('pdftkMergeMoreInput');
        if (addBtn && addInput) {
            addBtn.addEventListener('click', () => addInput.click());
            addInput.addEventListener('change', async (e) => {
                for (const file of Array.from(e.target.files)) {
                    try {
                        const bytes = await file.arrayBuffer();
                        const doc = await pdfLib.PDFDocument.load(bytes, { ignoreEncryption: true });
                        mergeFiles.push({ name: file.name, bytes, pageCount: doc.getPageCount() });
                    } catch (err) { /* skip */ }
                }
                addInput.value = '';
                buildMergeEditor();
            });
        }

        document.getElementById('pdftkApplyBtn')?.addEventListener('click', applyFeature);
    }

    function reorderPagesFromDOM() {
        const grid = document.getElementById('pdftkPageGrid');
        if (!grid) return;
        const indices = Array.from(grid.querySelectorAll('.pdftk-page-thumb')).map(el => parseInt(el.dataset.index));
        pageStates = indices.map(i => ({ ...pageStates[i] }));
        grid.querySelectorAll('.pdftk-page-thumb').forEach((el, i) => {
            el.dataset.index = i;
            el.querySelector('.pdftk-page-num').textContent = i + 1;
        });
    }

    function updateSelCount() {
        const el = document.getElementById('pdftkSelCount');
        if (el) el.textContent = `${pageStates.filter(ps => ps.selected).length} selected`;
    }

    function getApplyLabel() {
        return { split: 'Split PDF', extract: 'Extract Pages', delete: 'Delete Pages', rotate: 'Apply Rotation', reorder: 'Save New Order', playground: 'Build PDF' }[currentFeature] || 'Apply';
    }

    // ===== Apply Feature (Router) =====
    async function applyFeature() {
        if (isWorking) return;
        isWorking = true;
        showWorkspaceSection('loading');
        try {
            switch (currentFeature) {
                case 'merge':     await doMerge(); break;
                case 'split':     await doSplit(); break;
                case 'extract':   await doExtract(); break;
                case 'delete':    await doDelete(); break;
                case 'rotate':    await doRotate(); break;
                case 'reorder':   await doReorder(); break;
                case 'pdf2img':   await doPdf2Img(); break;
                case 'compress':  await doCompress(); break;
                case 'pdf2word':  await doPdf2Word(); break;
                case 'pagenums':  await doPageNums(); break;
                case 'watermark': await doWatermark(); break;
                case 'protect':    await doProtect(); break;
                case 'playground': await doPlayground(); break;
            }
        } catch (err) {
            console.error('Operation failed:', err);
            alert('Operation failed. Please try again.\n' + (err.message || ''));
            showWorkspaceSection('editor');
        }
        isWorking = false;
    }

    // ===================== FEATURE IMPLEMENTATIONS =====================

    // === Merge ===
    async function doMerge() {
        updateLoading('Merging PDFs...', `Combining ${mergeFiles.length} files`);
        const merged = await pdfLib.PDFDocument.create();
        for (let i = 0; i < mergeFiles.length; i++) {
            updateLoading('Merging PDFs...', `Adding file ${i + 1} of ${mergeFiles.length}`);
            const src = await pdfLib.PDFDocument.load(mergeFiles[i].bytes, { ignoreEncryption: true });
            const pages = await merged.copyPages(src, src.getPageIndices());
            pages.forEach(p => merged.addPage(p));
        }
        const bytes = await merged.save();
        showDone(bytes, 'merged.pdf', `${mergeFiles.length} files merged → ${merged.getPageCount()} pages • ${ToolUtils.formatBytes(bytes.byteLength)}`);
    }

    // === Split ===
    async function doSplit() {
        const mode = document.querySelector('#pdftkSplitMode .i2p-option.active')?.dataset.value || 'all';
        updateLoading('Splitting PDF...', 'Preparing pages');

        if (mode === 'all') {
            const zip = new JSZip();
            for (let i = 0; i < pageStates.length; i++) {
                updateLoading('Splitting PDF...', `Page ${i + 1} of ${pageStates.length}`);
                const newDoc = await pdfLib.PDFDocument.create();
                const [page] = await newDoc.copyPages(loadedPdfDoc, [i]);
                newDoc.addPage(page);
                zip.file(`page_${String(i + 1).padStart(3, '0')}.pdf`, await newDoc.save());
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            showDone(null, 'split_pages.zip', `${pageStates.length} pages → individual PDFs • ${ToolUtils.formatBytes(zipBlob.size)}`, zipBlob);
        } else if (mode === 'range') {
            const ranges = parseRanges(document.getElementById('pdftkRangeText')?.value || '', pageStates.length);
            if (!ranges.length) { alert('Enter valid page ranges.'); showWorkspaceSection('editor'); return; }
            if (ranges.length === 1) {
                const newDoc = await pdfLib.PDFDocument.create();
                const indices = ranges[0].map(p => p - 1);
                (await newDoc.copyPages(loadedPdfDoc, indices)).forEach(p => newDoc.addPage(p));
                const bytes = await newDoc.save();
                showDone(bytes, 'split_range.pdf', `${indices.length} pages extracted • ${ToolUtils.formatBytes(bytes.byteLength)}`);
            } else {
                const zip = new JSZip();
                for (let r = 0; r < ranges.length; r++) {
                    const newDoc = await pdfLib.PDFDocument.create();
                    (await newDoc.copyPages(loadedPdfDoc, ranges[r].map(p => p - 1))).forEach(p => newDoc.addPage(p));
                    zip.file(`part_${r + 1}.pdf`, await newDoc.save());
                }
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                showDone(null, 'split_ranges.zip', `${ranges.length} ranges → PDFs • ${ToolUtils.formatBytes(zipBlob.size)}`, zipBlob);
            }
        } else {
            const selected = pageStates.filter(ps => ps.selected);
            if (!selected.length) { alert('Select at least one page.'); showWorkspaceSection('editor'); return; }
            const newDoc = await pdfLib.PDFDocument.create();
            (await newDoc.copyPages(loadedPdfDoc, selected.map(ps => ps.page - 1))).forEach(p => newDoc.addPage(p));
            const bytes = await newDoc.save();
            showDone(bytes, 'split_selected.pdf', `${selected.length} pages extracted • ${ToolUtils.formatBytes(bytes.byteLength)}`);
        }
    }

    // === Extract ===
    async function doExtract() {
        const selected = pageStates.filter(ps => ps.selected);
        if (!selected.length) { alert('Select at least one page.'); showWorkspaceSection('editor'); return; }
        updateLoading('Extracting pages...', `${selected.length} pages`);
        const newDoc = await pdfLib.PDFDocument.create();
        (await newDoc.copyPages(loadedPdfDoc, selected.map(ps => ps.page - 1))).forEach(p => newDoc.addPage(p));
        const bytes = await newDoc.save();
        showDone(bytes, 'extracted.pdf', `${selected.length} of ${pageStates.length} pages extracted • ${ToolUtils.formatBytes(bytes.byteLength)}`);
    }

    // === Delete ===
    async function doDelete() {
        const toKeep = pageStates.filter(ps => !ps.selected);
        const deleted = pageStates.length - toKeep.length;
        if (!toKeep.length) { alert('Cannot delete ALL pages.'); showWorkspaceSection('editor'); return; }
        if (!deleted) { alert('Click pages to mark for deletion.'); showWorkspaceSection('editor'); return; }
        updateLoading('Removing pages...', `Deleting ${deleted} pages`);
        const newDoc = await pdfLib.PDFDocument.create();
        (await newDoc.copyPages(loadedPdfDoc, toKeep.map(ps => ps.page - 1))).forEach(p => newDoc.addPage(p));
        const bytes = await newDoc.save();
        showDone(bytes, 'trimmed.pdf', `${deleted} removed • ${toKeep.length} remaining • ${ToolUtils.formatBytes(bytes.byteLength)}`);
    }

    // === Rotate ===
    async function doRotate() {
        const rotated = pageStates.filter(ps => ps.rotation !== 0);
        if (!rotated.length) { alert('Click pages to rotate first.'); showWorkspaceSection('editor'); return; }
        updateLoading('Rotating pages...', 'Applying rotations');
        const newDoc = await pdfLib.PDFDocument.create();
        const pages = await newDoc.copyPages(loadedPdfDoc, loadedPdfDoc.getPageIndices());
        pages.forEach((page, i) => {
            if (pageStates[i].rotation) page.setRotation(pdfLib.degrees(page.getRotation().angle + pageStates[i].rotation));
            newDoc.addPage(page);
        });
        const bytes = await newDoc.save();
        showDone(bytes, 'rotated.pdf', `${rotated.length} pages rotated • ${ToolUtils.formatBytes(bytes.byteLength)}`);
    }

    // === Reorder ===
    async function doReorder() {
        updateLoading('Reordering pages...', 'Saving new order');
        const newDoc = await pdfLib.PDFDocument.create();
        (await newDoc.copyPages(loadedPdfDoc, pageStates.map(ps => ps.page - 1))).forEach(p => newDoc.addPage(p));
        const bytes = await newDoc.save();
        showDone(bytes, 'reordered.pdf', `${pageStates.length} pages reordered • ${ToolUtils.formatBytes(bytes.byteLength)}`);
    }

    // === PDF to Images ===
    async function doPdf2Img() {
        const selected = pageStates.filter(ps => ps.selected);
        if (!selected.length) { alert('Select at least one page.'); showWorkspaceSection('editor'); return; }
        const format = document.querySelector('#pdftkImgFormat .i2p-option.active')?.dataset.value || 'jpeg';
        const qScale = parseInt(document.querySelector('#pdftkImgQuality .i2p-option.active')?.dataset.value || '2');
        const mime = format === 'png' ? 'image/png' : 'image/jpeg';
        const ext = format === 'png' ? 'png' : 'jpg';
        const jpgQ = [0.5, 0.8, 0.95][qScale - 1];

        const zip = new JSZip();
        for (let i = 0; i < selected.length; i++) {
            updateLoading('Converting pages...', `Page ${i + 1} of ${selected.length}`);
            const page = await renderDoc.getPage(selected[i].page);
            const vp = page.getViewport({ scale: qScale });
            const canvas = document.createElement('canvas');
            canvas.width = vp.width; canvas.height = vp.height;
            const ctx = canvas.getContext('2d');
            if (format === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            zip.file(`page_${String(selected[i].page).padStart(3, '0')}.${ext}`, canvas.toDataURL(mime, jpgQ).split(',')[1], { base64: true });
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        showDone(null, 'pdf_images.zip', `${selected.length} pages → ${ext.toUpperCase()} • ${ToolUtils.formatBytes(zipBlob.size)}`, zipBlob);
    }

    // === Compress ===
    async function doCompress() {
        const method = document.querySelector('#pdftkCompressMethod .i2p-option.active')?.dataset.value || 'smart';
        const originalSize = loadedPdfBytes.byteLength;

        if (method === 'target') {
            await doCompressTarget(originalSize);
        } else {
            await doCompressSmart(originalSize);
        }
    }

    async function doCompressSmart(originalSize) {
        updateLoading('Compressing PDF...', 'Optimizing structure');
        const level = document.querySelector('#pdftkCompressLevel .i2p-option.active')?.dataset.value || 'medium';
        const newDoc = await pdfLib.PDFDocument.load(loadedPdfBytes, { ignoreEncryption: true });

        if (level === 'high' || level === 'medium') {
            newDoc.setTitle(''); newDoc.setAuthor(''); newDoc.setSubject('');
            newDoc.setKeywords([]); newDoc.setProducer(''); newDoc.setCreator('');
        }

        const bytes = await newDoc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 100 });
        const saved = originalSize - bytes.byteLength;
        const pct = ((saved / originalSize) * 100).toFixed(1);
        const info = saved > 0
            ? `${ToolUtils.formatBytes(originalSize)} → ${ToolUtils.formatBytes(bytes.byteLength)} (${pct}% smaller)`
            : `${ToolUtils.formatBytes(bytes.byteLength)} — Already well optimized`;
        showDone(bytes, 'compressed.pdf', info);
    }

    async function doCompressTarget(originalSize) {
        // Get target size
        const customVal = document.getElementById('pdftkCustomSize')?.value;
        const presetBtn = document.querySelector('#pdftkSizePresets .pdftk-size-btn.active');
        let targetKB = customVal ? parseInt(customVal) : (presetBtn ? parseInt(presetBtn.dataset.kb) : 1024);
        const targetBytes = targetKB * 1024;

        if (targetBytes >= originalSize) {
            alert(`Your PDF (${ToolUtils.formatBytes(originalSize)}) is already smaller than ${ToolUtils.formatBytes(targetBytes)}.`);
            showWorkspaceSection('editor');
            return;
        }

        // Need pdf.js for rendering
        if (!renderDoc) {
            renderDoc = await pdfjsLib.getDocument({ data: loadedPdfBytes.slice(0) }).promise;
        }

        const totalPages = loadedPdfDoc.getPageCount();
        const targetPerPage = targetBytes / totalPages;

        // Binary search for best JPEG quality
        let lo = 0.1, hi = 0.9, bestBytes = null;

        for (let attempt = 0; attempt < 6; attempt++) {
            const quality = (lo + hi) / 2;
            updateLoading('Compressing PDF...', `Trying quality ${Math.round(quality * 100)}% (attempt ${attempt + 1}/6)`);

            const newDoc = await pdfLib.PDFDocument.create();
            for (let i = 0; i < totalPages; i++) {
                const page = await renderDoc.getPage(i + 1);
                const origVp = page.getViewport({ scale: 1 });

                // Scale down for smaller target sizes
                let scale = 1.5;
                if (targetPerPage < 30000) scale = 0.8;
                else if (targetPerPage < 60000) scale = 1.0;
                else if (targetPerPage < 120000) scale = 1.2;

                const vp = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = vp.width; canvas.height = vp.height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                await page.render({ canvasContext: ctx, viewport: vp }).promise;

                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                const imgBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
                const image = await newDoc.embedJpg(imgBytes);

                const pdfPage = newDoc.addPage([origVp.width, origVp.height]);
                pdfPage.drawImage(image, { x: 0, y: 0, width: origVp.width, height: origVp.height });
            }

            bestBytes = await newDoc.save({ useObjectStreams: true });

            if (bestBytes.byteLength <= targetBytes) {
                lo = quality; // can try higher quality
            } else {
                hi = quality; // need lower quality
            }

            // Close enough
            if (Math.abs(bestBytes.byteLength - targetBytes) < targetBytes * 0.1) break;
        }

        const newSize = bestBytes.byteLength;
        const pct = (((originalSize - newSize) / originalSize) * 100).toFixed(1);
        const hit = newSize <= targetBytes;
        const info = hit
            ? `✅ ${ToolUtils.formatBytes(originalSize)} → ${ToolUtils.formatBytes(newSize)} (${pct}% smaller, under ${ToolUtils.formatBytes(targetBytes)} target)`
            : `⚠️ ${ToolUtils.formatBytes(originalSize)} → ${ToolUtils.formatBytes(newSize)} (${pct}% smaller, target was ${ToolUtils.formatBytes(targetBytes)})`;
        showDone(bestBytes, 'compressed.pdf', info);
    }

    // === PDF to Word ===
    async function doPdf2Word() {
        const mode = document.querySelector('#pdftkWordMode .i2p-option.active')?.dataset.value || 'text';
        const fontSize = parseInt(document.querySelector('#pdftkWordFontSize .i2p-option.active')?.dataset.value || '11');
        const totalPages = loadedPdfDoc.getPageCount();

        updateLoading('Extracting text...', `Processing ${totalPages} pages`);

        const sections = [];

        for (let i = 0; i < totalPages; i++) {
            updateLoading('Extracting text...', `Page ${i + 1} of ${totalPages}`);
            const page = await renderDoc.getPage(i + 1);
            const textContent = await page.getTextContent();
            const lines = [];
            let currentLine = '';
            let lastY = null;

            // Group text items by Y position to form lines
            for (const item of textContent.items) {
                const y = Math.round(item.transform[5]);
                if (lastY !== null && Math.abs(y - lastY) > 5) {
                    if (currentLine.trim()) lines.push(currentLine.trim());
                    currentLine = '';
                }
                currentLine += item.str + ' ';
                lastY = y;
            }
            if (currentLine.trim()) lines.push(currentLine.trim());

            // Build docx paragraphs
            const children = [];

            // Page header
            children.push(new docxLib.Paragraph({
                children: [new docxLib.TextRun({ text: `— Page ${i + 1} —`, bold: true, size: fontSize * 2, color: '666666' })],
                spacing: { after: 200 },
                alignment: docxLib.AlignmentType.CENTER,
            }));

            // If visual mode, add page image
            if (mode === 'visual') {
                try {
                    const vp = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    canvas.width = vp.width; canvas.height = vp.height;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    await page.render({ canvasContext: ctx, viewport: vp }).promise;
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    const base64 = dataUrl.split(',')[1];
                    const imgBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

                    children.push(new docxLib.Paragraph({
                        children: [
                            new docxLib.ImageRun({
                                data: imgBuffer,
                                transformation: { width: 500, height: Math.round(500 * (vp.height / vp.width)) },
                                type: 'jpg',
                            })
                        ],
                        spacing: { after: 200 },
                        alignment: docxLib.AlignmentType.CENTER,
                    }));
                } catch (e) { /* skip image on error */ }
            }

            // Text paragraphs
            for (const line of lines) {
                children.push(new docxLib.Paragraph({
                    children: [new docxLib.TextRun({ text: line, size: fontSize * 2 })],
                    spacing: { after: 80 },
                }));
            }

            if (lines.length === 0) {
                children.push(new docxLib.Paragraph({
                    children: [new docxLib.TextRun({ text: '(No text detected on this page)', italics: true, color: '999999', size: fontSize * 2 })],
                }));
            }

            sections.push({
                properties: { page: { size: { orientation: docxLib.PageOrientation.PORTRAIT } } },
                children,
            });
        }

        updateLoading('Creating Word document...', 'Building .docx file');

        const doc = new docxLib.Document({
            creator: 'ToolBox India',
            description: `Converted from ${loadedFileName}`,
            sections,
        });

        const buffer = await docxLib.Packer.toBlob(doc);
        showDone(null, loadedFileName.replace(/\.pdf$/i, '') + '.docx',
            `${totalPages} pages → Word document • ${ToolUtils.formatBytes(buffer.size)}`, buffer);
    }

    // === Add Page Numbers ===
    async function doPageNums() {
        const pos = document.querySelector('#pdftkNumPos .i2p-option.active')?.dataset.value || 'bottom-center';
        const fmt = document.querySelector('#pdftkNumFormat .i2p-option.active')?.dataset.value || 'plain';
        const fSize = parseInt(document.querySelector('#pdftkNumFontSize .i2p-option.active')?.dataset.value || '10');
        const startFrom = parseInt(document.getElementById('pdftkNumStart')?.value || '1');
        const totalPages = loadedPdfDoc.getPageCount();

        updateLoading('Adding page numbers...', `${totalPages} pages`);

        const newDoc = await pdfLib.PDFDocument.load(loadedPdfBytes, { ignoreEncryption: true });
        const font = await newDoc.embedFont(pdfLib.StandardFonts.Helvetica);
        const pages = newDoc.getPages();

        for (let i = 0; i < pages.length; i++) {
            if (i < startFrom - 1) continue; // skip pages before start

            const page = pages[i];
            const { width, height } = page.getSize();
            const pageNum = i + 1;

            let text;
            if (fmt === 'plain') text = `${pageNum}`;
            else if (fmt === 'dash') text = `- ${pageNum} -`;
            else if (fmt === 'of') text = `${pageNum} of ${totalPages}`;
            else text = `Page ${pageNum}`;

            const textWidth = font.widthOfTextAtSize(text, fSize);
            const margin = 40;

            let x, y;
            if (pos.startsWith('top')) y = height - margin;
            else y = margin - fSize;

            if (pos.endsWith('left')) x = margin;
            else if (pos.endsWith('right')) x = width - margin - textWidth;
            else x = (width - textWidth) / 2;

            page.drawText(text, {
                x, y, size: fSize, font,
                color: pdfLib.rgb(0.4, 0.4, 0.4),
            });
        }

        const bytes = await newDoc.save();
        showDone(bytes, 'numbered.pdf', `Page numbers added to ${totalPages - startFrom + 1} pages • ${ToolUtils.formatBytes(bytes.byteLength)}`);
    }

    // === Add Watermark ===
    async function doWatermark() {
        const text = document.getElementById('pdftkWmText')?.value?.trim() || 'CONFIDENTIAL';
        const fSize = parseInt(document.querySelector('#pdftkWmSize .i2p-option.active')?.dataset.value || '50');
        const opacity = parseFloat(document.querySelector('#pdftkWmOpacity .i2p-option.active')?.dataset.value || '0.15');
        const colorName = document.querySelector('#pdftkWmColor .i2p-option.active')?.dataset.value || 'gray';
        const rotation = parseInt(document.querySelector('#pdftkWmRotation .i2p-option.active')?.dataset.value || '45');

        const colors = { gray: [0.5, 0.5, 0.5], red: [0.8, 0.1, 0.1], blue: [0.1, 0.2, 0.8], black: [0, 0, 0] };
        const [r, g, b] = colors[colorName] || colors.gray;

        const totalPages = loadedPdfDoc.getPageCount();
        updateLoading('Adding watermark...', `${totalPages} pages`);

        const newDoc = await pdfLib.PDFDocument.load(loadedPdfBytes, { ignoreEncryption: true });
        const font = await newDoc.embedFont(pdfLib.StandardFonts.HelveticaBold);
        const pages = newDoc.getPages();

        const radians = (rotation * Math.PI) / 180;

        for (const page of pages) {
            const { width, height } = page.getSize();
            const textWidth = font.widthOfTextAtSize(text, fSize);

            page.drawText(text, {
                x: (width - textWidth * Math.cos(radians)) / 2,
                y: height / 2,
                size: fSize,
                font,
                color: pdfLib.rgb(r, g, b),
                opacity,
                rotate: pdfLib.degrees(rotation),
            });
        }

        const bytes = await newDoc.save();
        showDone(bytes, 'watermarked.pdf', `"${text}" watermark added to ${totalPages} pages • ${ToolUtils.formatBytes(bytes.byteLength)}`);
    }

    // === Protect PDF ===
    async function doProtect() {
        const userPass = document.getElementById('pdftkUserPass')?.value?.trim();
        const ownerPass = document.getElementById('pdftkOwnerPass')?.value?.trim() || userPass;

        if (!userPass) { alert('Please enter a password.'); showWorkspaceSection('editor'); return; }

        showWorkspaceSection('loading');
        updateLoading('Encrypting PDF...', 'Adding password protection');

        try {
            const newDoc = await pdfLib.PDFDocument.load(loadedPdfBytes, { ignoreEncryption: true });

            await newDoc.encrypt({
                userPassword: userPass,
                ownerPassword: ownerPass,
                permissions: {
                    modifying: false,
                },
            });

            const bytes = await newDoc.save({ useObjectStreams: false });
            showDone(bytes, 'protected.pdf', `🔒 Password protected • ${ToolUtils.formatBytes(bytes.byteLength)}`);
        } catch (err) {
            console.error('Protect PDF error:', err);
            alert('Failed to encrypt PDF: ' + err.message);
            showWorkspaceSection('editor');
        }
    }

    // ===== Show Done =====
    function showDone(bytes, fileName, infoText, blobOverride) {
        const isZip = fileName.endsWith('.zip');
        const isDocx = fileName.endsWith('.docx');
        const mimeType = isZip ? 'application/zip' : isDocx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf';
        const blob = blobOverride || new Blob([bytes], { type: mimeType });
        const done = document.getElementById('pdftkDone');
        const dlLabel = isZip ? 'ZIP' : isDocx ? 'Word' : 'PDF';

        done.innerHTML = `
            <div class="i2p-done-card">
                <div class="i2p-done-icon">✅</div>
                <h3>Done!</h3>
                <p>${infoText}</p>
                <div class="i2p-done-actions">
                    <button class="btn-success i2p-download-btn" id="pdftkDownloadBtn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Download ${dlLabel}
                    </button>
                    <button class="btn-secondary" id="pdftkStartOver">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                        Start Over
                    </button>
                </div>
            </div>
        `;
        showWorkspaceSection('done');
        document.getElementById('pdftkDownloadBtn')?.addEventListener('click', () => ToolUtils.downloadBlob(blob, fileName));
        document.getElementById('pdftkStartOver')?.addEventListener('click', () => { resetState(); openFeature(currentFeature); });
    }

    // ===== Parse Ranges =====
    function parseRanges(text, maxPage) {
        if (!text.trim()) return [];
        return text.split(',').map(s => s.trim()).filter(Boolean).map(part => {
            const range = [];
            if (part.includes('-')) {
                const [s, e] = part.split('-').map(Number);
                if (!isNaN(s) && !isNaN(e) && s >= 1 && e <= maxPage && s <= e)
                    for (let i = s; i <= e; i++) range.push(i);
            } else {
                const p = parseInt(part);
                if (!isNaN(p) && p >= 1 && p <= maxPage) range.push(p);
            }
            return range;
        }).filter(r => r.length);
    }

    // ===================== PAGE PREVIEW MODAL =====================

    let previewContext = null; // { mode: 'regular'|'playground', currentIndex: 0, pages: [...] }

    async function renderHiResPage(rDoc, pageNum, maxDim) {
        const page = await rDoc.getPage(pageNum);
        const vp = page.getViewport({ scale: 1 });
        const scale = Math.min(maxDim / vp.width, maxDim / vp.height);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        await page.render({ canvasContext: ctx, viewport }).promise;
        return canvas;
    }

    function openPreviewModal(mode, index) {
        // mode: 'regular' = uses renderDoc + pageStates, 'playground' = uses playgroundSources + playgroundPages
        const overlay = document.getElementById('pdftkPreviewOverlay');
        if (!overlay) return;

        if (mode === 'regular') {
            previewContext = {
                mode: 'regular',
                currentIndex: index,
                pages: pageStates.map((ps, i) => ({ label: `Page ${ps.page}`, srcPage: ps.page, rotation: ps.rotation }))
            };
        } else {
            // Playground — build list from current DOM order (may have been reordered)
            const grid = document.getElementById('pgPageGrid');
            const orderedPages = [];
            if (grid) {
                grid.querySelectorAll('.pg-page-card').forEach(el => {
                    const idx = parseInt(el.dataset.index);
                    const pg = playgroundPages[idx];
                    const srcName = playgroundSources[pg.srcIndex].name;
                    orderedPages.push({ label: `${srcName} — Page ${pg.srcPage}`, srcIndex: pg.srcIndex, srcPage: pg.srcPage, rotation: pg.rotation });
                });
            }
            previewContext = { mode: 'playground', currentIndex: index, pages: orderedPages };
        }

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        showPreviewPage();

        // Keyboard listener
        if (!overlay._keyHandler) {
            overlay._keyHandler = (e) => {
                if (!overlay.classList.contains('active')) return;
                if (e.key === 'Escape') closePreviewModal();
                else if (e.key === 'ArrowLeft') navigatePreview(-1);
                else if (e.key === 'ArrowRight') navigatePreview(1);
            };
            document.addEventListener('keydown', overlay._keyHandler);
        }
    }

    function closePreviewModal() {
        const overlay = document.getElementById('pdftkPreviewOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
        previewContext = null;
    }

    function navigatePreview(delta) {
        if (!previewContext) return;
        const newIdx = previewContext.currentIndex + delta;
        if (newIdx < 0 || newIdx >= previewContext.pages.length) return;
        previewContext.currentIndex = newIdx;
        showPreviewPage();
    }

    async function showPreviewPage() {
        if (!previewContext) return;
        const { currentIndex, pages, mode } = previewContext;
        const pg = pages[currentIndex];

        const titleEl = document.getElementById('pdftkPreviewTitle');
        const counterEl = document.getElementById('pdftkPreviewCounter');
        const body = document.getElementById('pdftkPreviewBody');
        const prevBtn = document.getElementById('pdftkPreviewPrev');
        const nextBtn = document.getElementById('pdftkPreviewNext');

        if (titleEl) titleEl.textContent = pg.label;
        if (counterEl) counterEl.textContent = `${currentIndex + 1} / ${pages.length}`;
        if (prevBtn) prevBtn.disabled = currentIndex === 0;
        if (nextBtn) nextBtn.disabled = currentIndex === pages.length - 1;

        // Show spinner while rendering
        if (body) body.innerHTML = '<div class="bgr-spinner"></div>';

        try {
            let rDoc;
            if (mode === 'regular') {
                rDoc = renderDoc;
            } else {
                rDoc = playgroundSources[pg.srcIndex].renderDoc;
            }

            // Render at high resolution — max 800px so it's crisp
            const canvas = await renderHiResPage(rDoc, pg.srcPage, 800);
            if (pg.rotation) canvas.style.transform = `rotate(${pg.rotation}deg)`;
            if (body) { body.innerHTML = ''; body.appendChild(canvas); }
        } catch (err) {
            console.error('Preview render error:', err);
            if (body) body.innerHTML = '<p style="color:var(--text-secondary);padding:40px;">Could not render this page.</p>';
        }
    }

    function initPreviewModal() {
        document.getElementById('pdftkPreviewClose')?.addEventListener('click', closePreviewModal);
        document.getElementById('pdftkPreviewPrev')?.addEventListener('click', () => navigatePreview(-1));
        document.getElementById('pdftkPreviewNext')?.addEventListener('click', () => navigatePreview(1));
        // Click on overlay background to close
        document.getElementById('pdftkPreviewOverlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'pdftkPreviewOverlay') closePreviewModal();
        });
    }

    // ===================== PLAYGROUND =====================

    // Color palette for labeling source PDFs
    const PG_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#d946ef','#f97316','#14b8a6','#8b5cf6','#ec4899'];

    async function handlePlaygroundPdfs(files) {
        if (isWorking) return;
        isWorking = true;
        showWorkspaceSection('loading');
        updateLoading('Loading libraries...', 'Setting up PDF engine');

        try {
            await ensureLibraries({ pdfjs: true });

            for (let fi = 0; fi < files.length; fi++) {
                const file = files[fi];
                if (file.size > 50 * 1024 * 1024) { alert(`${file.name} exceeds 50MB limit. Skipping.`); continue; }
                updateLoading(`Reading file ${fi + 1} of ${files.length}...`, file.name);
                const bytes = await file.arrayBuffer();
                const doc = await pdfLib.PDFDocument.load(bytes, { ignoreEncryption: true });
                const rDoc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
                const pc = doc.getPageCount();
                const srcIndex = playgroundSources.length;
                playgroundSources.push({ name: file.name, bytes, doc, renderDoc: rDoc, pageCount: pc });

                for (let p = 1; p <= pc; p++) {
                    updateLoading(`Thumbnails: File ${fi + 1}, page ${p} of ${pc}`, file.name);
                    const thumb = await renderPgThumbnail(rDoc, p, 160);
                    playgroundPages.push({ srcIndex, srcPage: p, selected: true, rotation: 0, thumbnail: thumb });
                }
            }

            if (!playgroundSources.length) { alert('No valid PDFs found.'); showWorkspaceSection('upload'); isWorking = false; return; }
            buildPlaygroundEditor();
        } catch (err) {
            console.error('Playground load error:', err);
            alert('Could not read one of the PDFs. It may be corrupted or password-protected.');
            showWorkspaceSection('upload');
        }
        isWorking = false;
    }

    async function addMorePlaygroundPdfs(files) {
        if (isWorking) return;
        isWorking = true;
        showWorkspaceSection('loading');
        updateLoading('Adding more PDFs...', '');
        try {
            await ensureLibraries({ pdfjs: true });
            for (let fi = 0; fi < files.length; fi++) {
                const file = files[fi];
                if (file.size > 50 * 1024 * 1024) { alert(`${file.name} exceeds 50MB limit. Skipping.`); continue; }
                updateLoading(`Reading file ${fi + 1} of ${files.length}...`, file.name);
                const bytes = await file.arrayBuffer();
                const doc = await pdfLib.PDFDocument.load(bytes, { ignoreEncryption: true });
                const rDoc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
                const pc = doc.getPageCount();
                const srcIndex = playgroundSources.length;
                playgroundSources.push({ name: file.name, bytes, doc, renderDoc: rDoc, pageCount: pc });

                for (let p = 1; p <= pc; p++) {
                    updateLoading(`Thumbnails: File ${fi + 1}, page ${p} of ${pc}`, file.name);
                    const thumb = await renderPgThumbnail(rDoc, p, 160);
                    playgroundPages.push({ srcIndex, srcPage: p, selected: true, rotation: 0, thumbnail: thumb });
                }
            }
            buildPlaygroundEditor();
        } catch (err) {
            console.error('Add more error:', err);
            alert('Could not read one of the PDFs.');
            buildPlaygroundEditor();
        }
        isWorking = false;
    }

    async function renderPgThumbnail(rDoc, pageNum, maxHeight) {
        const page = await rDoc.getPage(pageNum);
        const vp = page.getViewport({ scale: 1 });
        const scale = maxHeight / vp.height;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.7);
    }

    function buildPlaygroundEditor() {
        const editor = document.getElementById('pdftkEditor');
        const totalPages = playgroundPages.length;
        const totalFiles = playgroundSources.length;
        const selectedCount = playgroundPages.filter(p => p.selected).length;

        editor.innerHTML = `
            <div class="pg-header">
                <div class="pdftk-editor-info">
                    <span class="pdftk-file-badge">🎪 ${totalFiles} file${totalFiles > 1 ? 's' : ''} — ${totalPages} total pages</span>
                    <p>Click pages to select/deselect. Drag to reorder. Use rotation button to rotate. Only selected pages will be in the final PDF.</p>
                </div>
                <div class="pg-source-legend" id="pgSourceLegend">
                    ${playgroundSources.map((src, i) => `
                        <span class="pg-legend-chip" style="--pg-color: ${PG_COLORS[i % PG_COLORS.length]};">
                            <span class="pg-legend-dot" style="background: ${PG_COLORS[i % PG_COLORS.length]};"></span>
                            ${escHtml(src.name)} (${src.pageCount}p)
                        </span>
                    `).join('')}
                </div>
            </div>

            <div class="pg-toolbar">
                <div class="pg-toolbar-left">
                    <button class="pdftk-sel-btn pg-btn" data-action="all">Select All</button>
                    <button class="pdftk-sel-btn pg-btn" data-action="none">Deselect All</button>
                    <button class="pdftk-sel-btn pg-btn" data-action="invert">Invert</button>
                </div>
                <div class="pg-toolbar-right">
                    <span class="pg-sel-count" id="pgSelCount">${selectedCount} of ${totalPages} selected</span>
                </div>
            </div>

            <div class="pg-page-grid" id="pgPageGrid">
                ${playgroundPages.map((pg, i) => {
                    const srcColor = PG_COLORS[pg.srcIndex % PG_COLORS.length];
                    const srcName = playgroundSources[pg.srcIndex].name;
                    return `
                    <div class="pg-page-card ${pg.selected ? 'selected' : ''}" data-index="${i}" draggable="true">
                        <div class="pg-page-top-bar" style="background: ${srcColor};">
                            <span class="pg-page-label">${pg.srcPage}</span>
                            <button class="pg-rotate-btn" title="Rotate 90°">↻</button>
                        </div>
                        <div class="pg-thumb-wrap">
                            ${pg.thumbnail ? `<img src="${pg.thumbnail}" alt="Page ${pg.srcPage}" style="transform:rotate(${pg.rotation}deg);" draggable="false">` : `<div class="pg-placeholder">Page ${pg.srcPage}</div>`}
                            <div class="pg-check-overlay">${pg.selected ? '✓' : ''}</div>
                            <button class="pg-preview-btn" data-preview-index="${i}" title="Preview page">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                            </button>
                        </div>
                        <div class="pg-page-info">
                            <span class="pg-src-dot" style="background: ${srcColor};"></span>
                            <span class="pg-src-label" title="${escHtml(srcName)}">${escHtml(srcName.length > 16 ? srcName.slice(0, 14) + '…' : srcName)}</span>
                        </div>
                    </div>`;
                }).join('')}
            </div>

            <div class="pg-bottom-bar">
                <div class="pg-add-more">
                    <button class="i2p-add-more-btn" id="pgAddMoreBtn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Add More PDFs
                    </button>
                    <input type="file" id="pgAddMoreInput" accept="application/pdf" multiple style="display:none;">
                </div>
                <div class="pdftk-action-bar">
                    <button class="btn-primary pdftk-apply-btn" id="pdftkApplyBtn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                        Build PDF (${selectedCount} pages)
                    </button>
                </div>
            </div>
        `;
        showWorkspaceSection('editor');
        initPlaygroundInteractions();
    }

    function updatePgSelCount() {
        const sel = playgroundPages.filter(p => p.selected).length;
        const total = playgroundPages.length;
        const countEl = document.getElementById('pgSelCount');
        if (countEl) countEl.textContent = `${sel} of ${total} selected`;
        const applyBtn = document.getElementById('pdftkApplyBtn');
        if (applyBtn) applyBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            Build PDF (${sel} pages)`;
    }

    function initPlaygroundInteractions() {
        const grid = document.getElementById('pgPageGrid');
        if (!grid) return;

        // Click: preview, toggle select, or rotate
        grid.addEventListener('click', (e) => {
            // Preview button
            const previewBtn = e.target.closest('.pg-preview-btn');
            if (previewBtn) {
                e.stopPropagation();
                const pgIdx = parseInt(previewBtn.dataset.previewIndex);
                // Find the visual position of this card in the grid for navigation
                const allCards = Array.from(grid.querySelectorAll('.pg-page-card'));
                const visualIdx = allCards.findIndex(c => parseInt(c.dataset.index) === pgIdx);
                openPreviewModal('playground', visualIdx >= 0 ? visualIdx : 0);
                return;
            }

            const card = e.target.closest('.pg-page-card');
            if (!card) return;
            const idx = parseInt(card.dataset.index);

            // Rotate button
            if (e.target.closest('.pg-rotate-btn')) {
                playgroundPages[idx].rotation = (playgroundPages[idx].rotation + 90) % 360;
                const img = card.querySelector('.pg-thumb-wrap img');
                if (img) img.style.transform = `rotate(${playgroundPages[idx].rotation}deg)`;
                return;
            }

            // Toggle selection
            playgroundPages[idx].selected = !playgroundPages[idx].selected;
            card.classList.toggle('selected', playgroundPages[idx].selected);
            const overlay = card.querySelector('.pg-check-overlay');
            if (overlay) overlay.textContent = playgroundPages[idx].selected ? '✓' : '';
            updatePgSelCount();
        });

        // Selection bar buttons
        document.querySelectorAll('.pg-toolbar .pg-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                playgroundPages.forEach(pg => {
                    if (action === 'all') pg.selected = true;
                    else if (action === 'none') pg.selected = false;
                    else if (action === 'invert') pg.selected = !pg.selected;
                });
                grid.querySelectorAll('.pg-page-card').forEach((el, i) => {
                    el.classList.toggle('selected', playgroundPages[i].selected);
                    const overlay = el.querySelector('.pg-check-overlay');
                    if (overlay) overlay.textContent = playgroundPages[i].selected ? '✓' : '';
                });
                updatePgSelCount();
            });
        });

        // Drag-to-reorder
        let draggedEl = null;
        grid.querySelectorAll('.pg-page-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                draggedEl = card;
                card.classList.add('pg-dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('pg-dragging');
                draggedEl = null;
                // Rebuild playgroundPages from DOM order
                const newOrder = [];
                grid.querySelectorAll('.pg-page-card').forEach(el => {
                    const idx = parseInt(el.dataset.index);
                    newOrder.push(playgroundPages[idx]);
                });
                playgroundPages = newOrder;
                // Reassign data-index to match new order
                grid.querySelectorAll('.pg-page-card').forEach((el, i) => {
                    el.dataset.index = i;
                });
            });
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!draggedEl || draggedEl === card) return;
                const rect = card.getBoundingClientRect();
                const mid = rect.left + rect.width / 2;
                if (e.clientX < mid) grid.insertBefore(draggedEl, card);
                else grid.insertBefore(draggedEl, card.nextSibling);
            });
        });

        // Add More PDFs
        const addBtn = document.getElementById('pgAddMoreBtn');
        const addInput = document.getElementById('pgAddMoreInput');
        if (addBtn && addInput) {
            addBtn.addEventListener('click', () => addInput.click());
            addInput.addEventListener('change', (e) => {
                if (e.target.files.length) addMorePlaygroundPdfs(Array.from(e.target.files));
            });
        }

        // Apply button
        document.getElementById('pdftkApplyBtn')?.addEventListener('click', applyFeature);
    }

    async function doPlayground() {
        const selected = playgroundPages.filter(pg => pg.selected);
        if (!selected.length) { alert('Select at least one page.'); showWorkspaceSection('editor'); return; }

        updateLoading('Building your PDF...', `Assembling ${selected.length} pages`);
        const newDoc = await pdfLib.PDFDocument.create();

        for (let i = 0; i < selected.length; i++) {
            const pg = selected[i];
            const srcDoc = playgroundSources[pg.srcIndex].doc;
            updateLoading('Building your PDF...', `Page ${i + 1} of ${selected.length}`);

            const [copiedPage] = await newDoc.copyPages(srcDoc, [pg.srcPage - 1]);
            if (pg.rotation !== 0) {
                copiedPage.setRotation(pdfLib.degrees(copiedPage.getRotation().angle + pg.rotation));
            }
            newDoc.addPage(copiedPage);
        }

        const bytes = await newDoc.save();
        const srcNames = [...new Set(selected.map(pg => playgroundSources[pg.srcIndex].name))];
        const infoText = `${selected.length} pages from ${srcNames.length} file${srcNames.length > 1 ? 's' : ''} • ${ToolUtils.formatBytes(bytes.byteLength)}`;
        showDone(bytes, 'playground-result.pdf', infoText);
    }

    // ===== UI Helpers =====
    function showWorkspaceSection(section) {
        ['pdftkUploadArea', 'pdftkLoading', 'pdftkEditor', 'pdftkDone'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        const map = { upload: 'pdftkUploadArea', loading: 'pdftkLoading', editor: 'pdftkEditor', done: 'pdftkDone' };
        const el = document.getElementById(map[section]);
        if (el) el.style.display = 'block';
    }

    function updateLoading(title, text) {
        const t = document.getElementById('pdftkLoadingTitle');
        const s = document.getElementById('pdftkLoadingText');
        if (t) t.textContent = title;
        if (s) s.textContent = text;
    }

    function resetState() {
        loadedPdfBytes = null; loadedPdfDoc = null; renderDoc = null;
        loadedFileName = ''; pageStates = []; mergeFiles = []; isWorking = false;
        playgroundSources = []; playgroundPages = [];
        ['pdftkFileInput', 'pdftkFileInputMulti'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    }

    function escHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

})();
