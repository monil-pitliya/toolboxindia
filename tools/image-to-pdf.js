/* =============================================
   ToolBox India — Image to PDF Converter

   Converts one or multiple images into a single PDF.
   Users can reorder images, pick page size & orientation,
   and choose how images fit on the page.

   Uses jsPDF loaded via CDN (dynamic import).
   100% client-side. Zero server uploads.
   ============================================= */

(function () {
    'use strict';

    // ===== State =====
    let imageFiles = [];       // { id, file, dataUrl, width, height }
    let jsPDFLib = null;       // cached jsPDF constructor
    let isGenerating = false;
    let draggedItem = null;    // for drag-reorder

    const PAGE_SIZES = {
        a4:     { label: 'A4',      w: 595.28, h: 841.89 },
        letter: { label: 'Letter',  w: 612,    h: 792 },
        a3:     { label: 'A3',      w: 841.89, h: 1190.55 },
        a5:     { label: 'A5',      w: 419.53, h: 595.28 },
        legal:  { label: 'Legal',   w: 612,    h: 1008 },
    };

    // ===== Register Tool =====
    ToolRegistry.register('image-to-pdf', {
        title: 'Image to PDF',
        description: 'Convert one or multiple images into a single PDF — reorder pages, pick size & orientation.',
        category: 'Converter Tools',
        tags: ['image to pdf', 'jpg to pdf', 'png to pdf', 'convert', 'pdf maker', 'photo to pdf', 'picture to pdf', 'images to pdf'],

        render() {
            return `
                <!-- Info Banner -->
                <div class="i2p-info-banner" id="i2pInfoBanner">
                    <span class="i2p-info-icon">📄</span>
                    <div>
                        <strong>100% Private</strong> — Your images are converted to PDF entirely in your browser. Nothing is uploaded anywhere.
                    </div>
                </div>

                <!-- Upload Section -->
                <div id="i2pUploadSection">
                    <div class="tool-workspace">
                        <div class="drop-zone" id="i2pDropZone">
                            <span class="drop-zone-icon">🖼️ → 📄</span>
                            <h3 class="drop-zone-title">Drop images here</h3>
                            <p class="drop-zone-subtitle">Each image becomes one page in the PDF. Add multiple images to merge into one PDF.</p>
                            <button class="drop-zone-btn" onclick="document.getElementById('i2pFileInput').click()">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                Choose Images
                            </button>
                            <input type="file" id="i2pFileInput" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp" multiple>
                            <p class="drop-zone-info">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                JPG, PNG, WebP, GIF, BMP &bull; Multiple files allowed &bull; Drag to reorder
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Preview & Settings Section -->
                <div id="i2pEditorSection" style="display:none;">
                    <!-- Image Thumbnails (reorderable) -->
                    <div class="i2p-preview-header">
                        <h3 id="i2pPageCount">0 pages</h3>
                        <button class="i2p-add-more-btn" onclick="document.getElementById('i2pFileInputMore').click()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Add More
                        </button>
                        <input type="file" id="i2pFileInputMore" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp" multiple style="display:none;">
                    </div>
                    <div class="i2p-thumbs-grid" id="i2pThumbsGrid">
                        <!-- Thumbnails injected here -->
                    </div>
                    <p class="i2p-drag-hint">💡 Drag & drop thumbnails to reorder pages</p>

                    <!-- Settings -->
                    <div class="i2p-settings">
                        <div class="i2p-setting-group">
                            <label class="i2p-label">Page Size</label>
                            <div class="i2p-options" id="i2pPageSize">
                                <button class="i2p-option active" data-value="a4">A4</button>
                                <button class="i2p-option" data-value="letter">Letter</button>
                                <button class="i2p-option" data-value="a3">A3</button>
                                <button class="i2p-option" data-value="a5">A5</button>
                                <button class="i2p-option" data-value="legal">Legal</button>
                            </div>
                        </div>
                        <div class="i2p-setting-group">
                            <label class="i2p-label">Orientation</label>
                            <div class="i2p-options" id="i2pOrientation">
                                <button class="i2p-option active" data-value="portrait">📐 Portrait</button>
                                <button class="i2p-option" data-value="landscape">📐 Landscape</button>
                                <button class="i2p-option" data-value="auto">🔄 Auto (per image)</button>
                            </div>
                        </div>
                        <div class="i2p-setting-group">
                            <label class="i2p-label">Image Fit</label>
                            <div class="i2p-options" id="i2pFitMode">
                                <button class="i2p-option active" data-value="fit">Fit to Page</button>
                                <button class="i2p-option" data-value="fill">Fill Page (crop)</button>
                                <button class="i2p-option" data-value="stretch">Stretch</button>
                            </div>
                        </div>
                        <div class="i2p-setting-group">
                            <label class="i2p-label">Margin</label>
                            <div class="i2p-options" id="i2pMargin">
                                <button class="i2p-option" data-value="0">None</button>
                                <button class="i2p-option active" data-value="20">Small</button>
                                <button class="i2p-option" data-value="40">Medium</button>
                                <button class="i2p-option" data-value="60">Large</button>
                            </div>
                        </div>
                    </div>

                    <!-- Generate Button -->
                    <div class="i2p-generate-area">
                        <button class="btn-primary i2p-generate-btn" id="i2pGenerateBtn">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                            Generate PDF
                        </button>
                        <button class="btn-secondary" id="i2pClearAll">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                            Clear All
                        </button>
                    </div>
                </div>

                <!-- Generating State -->
                <div id="i2pGeneratingSection" style="display:none;">
                    <div class="i2p-generating-card">
                        <div class="bgr-spinner"></div>
                        <h3>Generating PDF...</h3>
                        <p id="i2pGenStatus">Processing image 1 of 3</p>
                    </div>
                </div>

                <!-- Done Section -->
                <div id="i2pDoneSection" style="display:none;">
                    <div class="i2p-done-card">
                        <div class="i2p-done-icon">✅</div>
                        <h3>PDF Ready!</h3>
                        <p id="i2pDoneInfo">3 pages • 1.2 MB • A4 Portrait</p>
                        <div class="i2p-done-actions">
                            <button class="btn-success i2p-download-btn" id="i2pDownloadBtn">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                Download PDF
                            </button>
                            <button class="btn-secondary" id="i2pStartOver">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                                Start Over
                            </button>
                        </div>
                        <div id="i2pChainActions"></div>
                    </div>
                </div>
            `;
        },

        init() {
            initDropZone();
            initEditor();

            // Consume chained file from another tool
            if (window.ToolChain && ToolChain.hasPending()) {
                const chained = ToolChain.consumePending();
                if (chained && chained.blob) {
                    ToolChain.injectBackBanner(document.getElementById('toolContent'));
                    const file = ToolChain.blobToFile(chained.blob, chained.name || 'image.jpg');
                    setTimeout(() => handleFiles([file]), 100);
                }
            }
        },

        destroy() {
            imageFiles = [];
            isGenerating = false;
            draggedItem = null;
        }
    });

    // ===== Drop Zone =====
    function initDropZone() {
        const dropZone = document.getElementById('i2pDropZone');
        const fileInput = document.getElementById('i2pFileInput');
        if (!dropZone || !fileInput) return;

        dropZone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });

        ['dragenter', 'dragover'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        });
        ['dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
        });
        dropZone.addEventListener('drop', (e) => {
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (files.length) handleFiles(files);
        });
    }

    // ===== Editor Setup =====
    function initEditor() {
        setTimeout(() => {
            // "Add More" input
            const moreInput = document.getElementById('i2pFileInputMore');
            if (moreInput) {
                moreInput.addEventListener('change', (e) => {
                    handleFiles(e.target.files);
                    moreInput.value = '';
                });
            }

            // Option buttons (page size, orientation, fit, margin)
            document.querySelectorAll('.i2p-options').forEach(group => {
                group.addEventListener('click', (e) => {
                    const btn = e.target.closest('.i2p-option');
                    if (!btn) return;
                    group.querySelectorAll('.i2p-option').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });

            // Generate button
            const genBtn = document.getElementById('i2pGenerateBtn');
            if (genBtn) genBtn.addEventListener('click', generatePDF);

            // Clear All
            const clearBtn = document.getElementById('i2pClearAll');
            if (clearBtn) clearBtn.addEventListener('click', resetTool);

            // Download
            const dlBtn = document.getElementById('i2pDownloadBtn');
            if (dlBtn) dlBtn.addEventListener('click', () => {
                if (dlBtn._pdfBlob) {
                    ToolUtils.downloadBlob(dlBtn._pdfBlob, 'images-to-pdf.pdf');
                }
            });

            // Start Over
            const startOver = document.getElementById('i2pStartOver');
            if (startOver) startOver.addEventListener('click', resetTool);
        }, 100);
    }

    // ===== Handle new image files =====
    async function handleFiles(fileList) {
        const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
        if (!files.length) return;

        for (const file of files) {
            const dataUrl = await readFileAsDataUrl(file);
            const dims = await getImageDimensions(dataUrl);
            imageFiles.push({
                id: ToolUtils.generateId(),
                file,
                dataUrl,
                width: dims.width,
                height: dims.height,
                name: file.name
            });
        }

        showSection('editor');
        renderThumbnails();
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    }

    function getImageDimensions(dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.src = dataUrl;
        });
    }

    // ===== Render Thumbnails =====
    function renderThumbnails() {
        const grid = document.getElementById('i2pThumbsGrid');
        const countEl = document.getElementById('i2pPageCount');
        if (!grid) return;

        countEl.textContent = `${imageFiles.length} page${imageFiles.length !== 1 ? 's' : ''}`;

        grid.innerHTML = imageFiles.map((img, i) => `
            <div class="i2p-thumb" draggable="true" data-id="${img.id}">
                <div class="i2p-thumb-number">${i + 1}</div>
                <div class="i2p-thumb-img-wrap">
                    <img src="${img.dataUrl}" alt="Page ${i + 1}">
                </div>
                <div class="i2p-thumb-info">
                    <span class="i2p-thumb-name" title="${img.name}">${truncateName(img.name, 18)}</span>
                    <span class="i2p-thumb-dims">${img.width}×${img.height}</span>
                </div>
                <button class="i2p-thumb-remove" data-id="${img.id}" title="Remove">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `).join('');

        // Drag-to-reorder
        grid.querySelectorAll('.i2p-thumb').forEach(thumb => {
            thumb.addEventListener('dragstart', (e) => {
                draggedItem = thumb;
                thumb.classList.add('i2p-dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            thumb.addEventListener('dragend', () => {
                thumb.classList.remove('i2p-dragging');
                draggedItem = null;
                // Re-read order from DOM
                reorderFromDOM();
            });
            thumb.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!draggedItem || draggedItem === thumb) return;
                const rect = thumb.getBoundingClientRect();
                const midX = rect.left + rect.width / 2;
                if (e.clientX < midX) {
                    grid.insertBefore(draggedItem, thumb);
                } else {
                    grid.insertBefore(draggedItem, thumb.nextSibling);
                }
            });
        });

        // Remove buttons
        grid.querySelectorAll('.i2p-thumb-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                imageFiles = imageFiles.filter(img => img.id !== id);
                if (imageFiles.length === 0) {
                    resetTool();
                } else {
                    renderThumbnails();
                }
            });
        });
    }

    function reorderFromDOM() {
        const grid = document.getElementById('i2pThumbsGrid');
        if (!grid) return;
        const ids = Array.from(grid.querySelectorAll('.i2p-thumb')).map(el => el.dataset.id);
        const reordered = [];
        ids.forEach(id => {
            const found = imageFiles.find(img => img.id === id);
            if (found) reordered.push(found);
        });
        imageFiles = reordered;
        renderThumbnails(); // re-number
    }

    function truncateName(name, max) {
        if (name.length <= max) return name;
        const ext = name.split('.').pop();
        return name.substring(0, max - ext.length - 3) + '...' + ext;
    }

    // ===== Get current settings =====
    function getSettings() {
        const getActive = (id) => {
            const el = document.querySelector(`#${id} .i2p-option.active`);
            return el ? el.dataset.value : null;
        };
        return {
            pageSize: getActive('i2pPageSize') || 'a4',
            orientation: getActive('i2pOrientation') || 'portrait',
            fitMode: getActive('i2pFitMode') || 'fit',
            margin: parseInt(getActive('i2pMargin') || '20', 10),
        };
    }

    // ===== Generate PDF =====
    async function generatePDF() {
        if (isGenerating || imageFiles.length === 0) return;
        isGenerating = true;

        showSection('generating');

        try {
            // Load jsPDF dynamically
            if (!jsPDFLib) {
                updateGenStatus('Loading PDF library...');
                await loadJsPDF();
            }

            const settings = getSettings();
            const pageDef = PAGE_SIZES[settings.pageSize] || PAGE_SIZES.a4;

            // Create PDF — first page orientation
            const firstOrientation = getPageOrientation(imageFiles[0], settings, pageDef);
            const doc = new jsPDFLib({
                orientation: firstOrientation,
                unit: 'pt',
                format: [pageDef.w, pageDef.h]
            });

            for (let i = 0; i < imageFiles.length; i++) {
                updateGenStatus(`Processing image ${i + 1} of ${imageFiles.length}`);

                const img = imageFiles[i];
                const orient = getPageOrientation(img, settings, pageDef);

                if (i > 0) {
                    doc.addPage([pageDef.w, pageDef.h], orient);
                } else if (orient !== firstOrientation) {
                    // Fix first page orientation if auto differs
                    doc.setPage(1);
                }

                const pw = orient === 'landscape' ? pageDef.h : pageDef.w;
                const ph = orient === 'landscape' ? pageDef.w : pageDef.h;
                const margin = settings.margin;
                const availW = pw - margin * 2;
                const availH = ph - margin * 2;

                const pos = calculatePosition(img.width, img.height, availW, availH, settings.fitMode);
                doc.addImage(img.dataUrl, 'JPEG', margin + pos.x, margin + pos.y, pos.w, pos.h);
            }

            updateGenStatus('Finalizing PDF...');

            const pdfBlob = doc.output('blob');
            const sizeStr = ToolUtils.formatBytes(pdfBlob.size);
            const orientLabel = settings.orientation === 'auto' ? 'Auto' :
                settings.orientation.charAt(0).toUpperCase() + settings.orientation.slice(1);

            // Show done
            showSection('done');
            const infoEl = document.getElementById('i2pDoneInfo');
            if (infoEl) {
                infoEl.textContent = `${imageFiles.length} page${imageFiles.length !== 1 ? 's' : ''} • ${sizeStr} • ${pageDef.label} ${orientLabel}`;
            }

            // Store blob on download button
            const dlBtn = document.getElementById('i2pDownloadBtn');
            if (dlBtn) dlBtn._pdfBlob = pdfBlob;

            // Inject cross-tool chaining actions
            if (window.ToolChain && dlBtn._pdfBlob) {
                const chainContainer = document.getElementById('i2pChainActions');
                if (chainContainer) {
                    ToolChain.inject(chainContainer, dlBtn._pdfBlob, 'images-to-pdf.pdf', 'image-to-pdf');
                }
            }

        } catch (err) {
            console.error('PDF generation failed:', err);
            alert('Failed to generate PDF. Please try again.');
            showSection('editor');
        }

        isGenerating = false;
    }

    function getPageOrientation(img, settings, pageDef) {
        if (settings.orientation === 'auto') {
            // Use landscape if image is wider than tall
            return (img.width > img.height) ? 'landscape' : 'portrait';
        }
        return settings.orientation;
    }

    function calculatePosition(imgW, imgH, availW, availH, fitMode) {
        const imgRatio = imgW / imgH;
        const pageRatio = availW / availH;

        let w, h, x, y;

        if (fitMode === 'fit') {
            // Fit inside available area maintaining aspect ratio
            if (imgRatio > pageRatio) {
                w = availW;
                h = availW / imgRatio;
            } else {
                h = availH;
                w = availH * imgRatio;
            }
            x = (availW - w) / 2;
            y = (availH - h) / 2;

        } else if (fitMode === 'fill') {
            // Fill entire area (crop overflow)
            if (imgRatio > pageRatio) {
                h = availH;
                w = availH * imgRatio;
            } else {
                w = availW;
                h = availW / imgRatio;
            }
            x = (availW - w) / 2;
            y = (availH - h) / 2;

        } else {
            // Stretch — fill exactly
            w = availW;
            h = availH;
            x = 0;
            y = 0;
        }

        return { x, y, w, h };
    }

    // ===== Load jsPDF from CDN =====
    function loadJsPDF() {
        return new Promise((resolve, reject) => {
            if (window.jspdf) {
                jsPDFLib = window.jspdf.jsPDF;
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
            script.onload = () => {
                jsPDFLib = window.jspdf.jsPDF;
                resolve();
            };
            script.onerror = () => reject(new Error('Failed to load jsPDF library'));
            document.head.appendChild(script);
        });
    }

    // ===== UI Helpers =====
    function showSection(section) {
        const banner = document.getElementById('i2pInfoBanner');
        const upload = document.getElementById('i2pUploadSection');
        const editor = document.getElementById('i2pEditorSection');
        const generating = document.getElementById('i2pGeneratingSection');
        const done = document.getElementById('i2pDoneSection');

        if (banner) banner.style.display = (section === 'upload' || section === 'editor') ? 'flex' : 'none';
        if (upload) upload.style.display = section === 'upload' ? 'block' : 'none';
        if (editor) editor.style.display = section === 'editor' ? 'block' : 'none';
        if (generating) generating.style.display = section === 'generating' ? 'block' : 'none';
        if (done) done.style.display = section === 'done' ? 'block' : 'none';
    }

    function updateGenStatus(text) {
        const el = document.getElementById('i2pGenStatus');
        if (el) el.textContent = text;
    }

    function resetTool() {
        imageFiles = [];
        isGenerating = false;
        showSection('upload');
        const fi = document.getElementById('i2pFileInput');
        if (fi) fi.value = '';
    }

})();
