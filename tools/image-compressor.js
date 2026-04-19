/* =============================================
   Free Toolbox — Image Compressor Tool
   100% Client-Side Image Compression
   
   TWO MODES:
   1. Simple Mode  → "Compress to under X KB" (for everyone)
   2. Advanced Mode → Quality slider, format, resize (for techies)
   
   NO files are uploaded to any server!
   ============================================= */

(function () {
    'use strict';

    // ===== State =====
    let files = [];
    let compressedResults = [];
    let currentMode = 'simple'; // 'simple' or 'advanced'

    // Simple mode state
    let targetSizeKB = 200; // default target: 200 KB
    let selectedPreset = '200'; // which button is selected

    // Advanced mode state
    let quality = 0.7;
    let outputFormat = 'original';
    let maxWidth = 0;

    // ===== Register Tool =====
    ToolRegistry.register('image-compressor', {
        title: 'Image Compressor',
        description: 'Compress images up to 90% smaller without visible quality loss',
        category: 'Image Tools',
        tags: ['image', 'compress', 'jpg', 'png', 'webp', 'reduce size', 'optimize', 'kb', 'mb'],

        render() {
            return `
                <!-- Drop Zone -->
                <div class="tool-workspace">
                    <div class="drop-zone" id="dropZone">
                        <span class="drop-zone-icon">📸</span>
                        <h3 class="drop-zone-title">Drop your images here</h3>
                        <p class="drop-zone-subtitle">or click to browse files</p>
                        <button class="drop-zone-btn" onclick="document.getElementById('fileInput').click()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            Choose Images
                        </button>
                        <input type="file" id="fileInput" multiple accept="image/jpeg,image/png,image/webp,image/bmp,image/gif">
                        <p class="drop-zone-info">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            Supports JPG, PNG, WebP, BMP, GIF &bull; Max 200MB per file &bull; Up to 20 files at once
                        </p>
                    </div>
                </div>

                <!-- Controls Panel -->
                <div class="controls-panel" id="controlsPanel">

                    <!-- Mode Toggle -->
                    <div class="mode-toggle-container">
                        <div class="mode-toggle" id="modeToggle">
                            <button class="mode-btn active" data-mode="simple">
                                <span class="mode-btn-icon">🎯</span>
                                <span class="mode-btn-text">Simple</span>
                                <span class="mode-btn-desc">Just set a size limit</span>
                            </button>
                            <button class="mode-btn" data-mode="advanced">
                                <span class="mode-btn-icon">⚙️</span>
                                <span class="mode-btn-text">Advanced</span>
                                <span class="mode-btn-desc">Full control over settings</span>
                            </button>
                        </div>
                    </div>

                    <!-- ===== SIMPLE MODE ===== -->
                    <div class="mode-panel active" id="simpleModePanel">
                        <div class="simple-mode-content">
                            <h3 class="simple-mode-title">Compress each image to under:</h3>
                            
                            <!-- Preset Size Buttons -->
                            <div class="size-presets" id="sizePresets">
                                <button class="size-preset-btn" data-size="50">
                                    <span class="preset-value">50</span>
                                    <span class="preset-unit">KB</span>
                                    <span class="preset-use">For icons</span>
                                </button>
                                <button class="size-preset-btn" data-size="100">
                                    <span class="preset-value">100</span>
                                    <span class="preset-unit">KB</span>
                                    <span class="preset-use">For web</span>
                                </button>
                                <button class="size-preset-btn active" data-size="200">
                                    <span class="preset-value">200</span>
                                    <span class="preset-unit">KB</span>
                                    <span class="preset-use">For email</span>
                                </button>
                                <button class="size-preset-btn" data-size="500">
                                    <span class="preset-value">500</span>
                                    <span class="preset-unit">KB</span>
                                    <span class="preset-use">Good quality</span>
                                </button>
                                <button class="size-preset-btn" data-size="1024">
                                    <span class="preset-value">1</span>
                                    <span class="preset-unit">MB</span>
                                    <span class="preset-use">High quality</span>
                                </button>
                                <button class="size-preset-btn" data-size="2048">
                                    <span class="preset-value">2</span>
                                    <span class="preset-unit">MB</span>
                                    <span class="preset-use">Best quality</span>
                                </button>
                            </div>

                            <!-- Custom Size Input -->
                            <div class="custom-size-row">
                                <span class="custom-size-label">Or enter custom size:</span>
                                <div class="custom-size-input-group">
                                    <input type="number" class="custom-size-input" id="customSizeInput" placeholder="e.g. 300" min="10" max="51200">
                                    <select class="custom-size-unit" id="customSizeUnit">
                                        <option value="KB" selected>KB</option>
                                        <option value="MB">MB</option>
                                    </select>
                                    <button class="custom-size-apply" id="customSizeApply">Apply</button>
                                </div>
                            </div>

                            <!-- Current Target Display -->
                            <div class="target-display" id="targetDisplay">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                                Target: Each image will be compressed to under <strong id="targetLabel">200 KB</strong>
                            </div>
                        </div>
                    </div>

                    <!-- ===== ADVANCED MODE ===== -->
                    <div class="mode-panel" id="advancedModePanel">
                        <div class="controls-row">
                            <!-- Quality Slider -->
                            <div class="control-group">
                                <div class="control-label">
                                    <span>Quality</span>
                                    <span class="control-value" id="qualityValue">70%</span>
                                </div>
                                <input type="range" class="range-slider" id="qualitySlider" min="10" max="100" value="70" step="5">
                                <div style="display:flex; justify-content:space-between; margin-top:4px;">
                                    <span style="font-size:11px; color:var(--text-tertiary);">Smaller file</span>
                                    <span style="font-size:11px; color:var(--text-tertiary);">Better quality</span>
                                </div>
                            </div>

                            <!-- Output Format -->
                            <div class="control-group">
                                <div class="control-label">
                                    <span>Output Format</span>
                                </div>
                                <div class="format-options" id="formatOptions">
                                    <button class="format-btn active" data-format="original">Original</button>
                                    <button class="format-btn" data-format="jpeg">JPG</button>
                                    <button class="format-btn" data-format="png">PNG</button>
                                    <button class="format-btn" data-format="webp">WebP</button>
                                </div>
                            </div>

                            <!-- Max Width -->
                            <div class="control-group">
                                <div class="control-label">
                                    <span>Max Width (px)</span>
                                    <span class="control-value" id="widthValue">No limit</span>
                                </div>
                                <input type="range" class="range-slider" id="widthSlider" min="0" max="4000" value="0" step="100">
                                <div style="display:flex; justify-content:space-between; margin-top:4px;">
                                    <span style="font-size:11px; color:var(--text-tertiary);">No resize</span>
                                    <span style="font-size:11px; color:var(--text-tertiary);">4000px</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Action Bar (shared) -->
                    <div class="action-bar" style="margin-top:20px;">
                        <div style="display:flex; gap:8px; align-items:center;">
                            <span style="font-size:13px; color:var(--text-secondary);" id="fileCount">0 files selected</span>
                            <button class="btn-danger" id="clearBtn" style="display:none;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                                Clear All
                            </button>
                        </div>
                        <button class="btn-primary" id="compressBtn" disabled>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                            Compress Images
                        </button>
                    </div>
                </div>

                <!-- Progress -->
                <div class="progress-container" id="progressContainer">
                    <div class="progress-bar-wrapper">
                        <div class="progress-bar" id="progressBar"></div>
                    </div>
                    <p class="progress-text" id="progressText">Compressing...</p>
                </div>

                <!-- Results -->
                <div class="results-container" id="resultsContainer">
                    <div class="results-summary" id="resultsSummary"></div>
                    <div class="action-bar" style="margin-bottom:16px;">
                        <span></span>
                        <button class="btn-success" id="downloadAllBtn">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Download All
                        </button>
                    </div>
                    <div id="icChainActions"></div>
                    <div class="image-results-grid" id="resultsGrid"></div>
                </div>
            `;
        },

        init() {
            initDropZone();
            initModeToggle();
            initSimpleMode();
            initAdvancedControls();
            initButtons();

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
            compressedResults.forEach(r => {
                if (r.compressedUrl) URL.revokeObjectURL(r.compressedUrl);
                if (r.originalUrl) URL.revokeObjectURL(r.originalUrl);
            });
            files = [];
            compressedResults = [];
        }
    });

    // ===== Mode Toggle =====
    function initModeToggle() {
        const modeBtns = document.querySelectorAll('.mode-btn');
        modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentMode = btn.dataset.mode;

                // Show/hide panels
                document.getElementById('simpleModePanel').classList.toggle('active', currentMode === 'simple');
                document.getElementById('advancedModePanel').classList.toggle('active', currentMode === 'advanced');
            });
        });
    }

    // ===== Simple Mode =====
    function initSimpleMode() {
        // Preset buttons
        const presetBtns = document.querySelectorAll('.size-preset-btn');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                presetBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                targetSizeKB = parseInt(btn.dataset.size);
                selectedPreset = btn.dataset.size;
                updateTargetLabel();

                // Clear custom input
                const customInput = document.getElementById('customSizeInput');
                if (customInput) customInput.value = '';
            });
        });

        // Custom size apply
        const applyBtn = document.getElementById('customSizeApply');
        if (applyBtn) {
            applyBtn.addEventListener('click', applyCustomSize);
        }

        // Allow pressing Enter in custom input
        const customInput = document.getElementById('customSizeInput');
        if (customInput) {
            customInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') applyCustomSize();
            });
        }
    }

    function applyCustomSize() {
        const input = document.getElementById('customSizeInput');
        const unit = document.getElementById('customSizeUnit');
        if (!input || !input.value) return;

        let sizeKB = parseFloat(input.value);
        if (isNaN(sizeKB) || sizeKB <= 0) return;

        if (unit.value === 'MB') {
            sizeKB = sizeKB * 1024;
        }

        // Clamp to reasonable bounds
        sizeKB = Math.max(10, Math.min(51200, sizeKB));

        targetSizeKB = sizeKB;
        selectedPreset = 'custom';

        // Deselect all presets
        document.querySelectorAll('.size-preset-btn').forEach(b => b.classList.remove('active'));

        updateTargetLabel();
    }

    function updateTargetLabel() {
        const label = document.getElementById('targetLabel');
        if (label) {
            if (targetSizeKB >= 1024) {
                label.textContent = (targetSizeKB / 1024).toFixed(1).replace('.0', '') + ' MB';
            } else {
                label.textContent = targetSizeKB + ' KB';
            }
        }
    }

    // ===== Drop Zone =====
    function initDropZone() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        if (!dropZone || !fileInput) return;

        dropZone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') {
                fileInput.click();
            }
        });

        fileInput.addEventListener('change', (e) => {
            handleFiles(Array.from(e.target.files));
        });

        ['dragenter', 'dragover'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            handleFiles(droppedFiles);
        });
    }

    function handleFiles(newFiles) {
        const validFiles = newFiles.filter(f => {
            if (!f.type.startsWith('image/')) return false;
            if (f.size > 200 * 1024 * 1024) return false;
            return true;
        });
        if (validFiles.length === 0) return;
        files = [...files, ...validFiles].slice(0, 20);
        showControls();
        updateFileCount();
    }

    function showControls() {
        const panel = document.getElementById('controlsPanel');
        if (panel) panel.classList.add('visible');
        const compressBtn = document.getElementById('compressBtn');
        if (compressBtn) compressBtn.disabled = false;
        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) clearBtn.style.display = 'inline-flex';
    }

    function updateFileCount() {
        const el = document.getElementById('fileCount');
        if (el) {
            const totalSize = files.reduce((sum, f) => sum + f.size, 0);
            el.textContent = `${files.length} file${files.length > 1 ? 's' : ''} selected (${ToolUtils.formatBytes(totalSize)})`;
        }
    }

    // ===== Advanced Controls =====
    function initAdvancedControls() {
        const qualitySlider = document.getElementById('qualitySlider');
        const qualityValueEl = document.getElementById('qualityValue');
        if (qualitySlider) {
            qualitySlider.addEventListener('input', () => {
                quality = parseInt(qualitySlider.value) / 100;
                if (qualityValueEl) qualityValueEl.textContent = qualitySlider.value + '%';
            });
        }

        const widthSlider = document.getElementById('widthSlider');
        const widthValueEl = document.getElementById('widthValue');
        if (widthSlider) {
            widthSlider.addEventListener('input', () => {
                maxWidth = parseInt(widthSlider.value);
                if (widthValueEl) widthValueEl.textContent = maxWidth === 0 ? 'No limit' : maxWidth + 'px';
            });
        }

        const formatBtns = document.querySelectorAll('.format-btn');
        formatBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                formatBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                outputFormat = btn.dataset.format;
            });
        });
    }

    // ===== Buttons =====
    function initButtons() {
        const compressBtn = document.getElementById('compressBtn');
        if (compressBtn) compressBtn.addEventListener('click', startCompression);

        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) clearBtn.addEventListener('click', clearAll);

        const downloadAllBtn = document.getElementById('downloadAllBtn');
        if (downloadAllBtn) downloadAllBtn.addEventListener('click', downloadAll);
    }

    // ===== Compression Engine =====
    async function startCompression() {
        if (files.length === 0) return;

        const compressBtn = document.getElementById('compressBtn');
        compressBtn.disabled = true;
        compressBtn.innerHTML = '<span class="spinner"></span> Compressing...';

        const progress = document.getElementById('progressContainer');
        progress.classList.add('visible');

        compressedResults = [];
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.classList.remove('visible');

        let totalOriginal = 0;
        let totalCompressed = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            updateProgress(i, files.length, file.name);

            try {
                let result;
                if (currentMode === 'simple') {
                    result = await compressToTargetSize(file, targetSizeKB * 1024);
                } else {
                    result = await compressImage(file, quality, outputFormat, maxWidth);
                }
                compressedResults.push(result);
                totalOriginal += result.originalSize;
                totalCompressed += result.compressedSize;
            } catch (err) {
                console.error(`Failed to compress: ${file.name}`, err);
                compressedResults.push({
                    name: file.name,
                    error: true,
                    originalSize: file.size,
                    compressedSize: file.size,
                });
            }
        }

        updateProgress(files.length, files.length, 'Done!');

        setTimeout(() => {
            progress.classList.remove('visible');
            showResults(totalOriginal, totalCompressed);
            compressBtn.disabled = false;
            compressBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                Re-Compress
            `;
        }, 500);
    }

    // ===== SMART TARGET SIZE COMPRESSION (Binary Search) =====
    async function compressToTargetSize(file, targetBytes) {
        // If file is already under target, still process it (format conversion)
        // but don't over-compress

        const img = await loadImage(file);
        let bestBlob = null;
        let bestQuality = 1.0;

        // Determine output — for target-size mode, always use JPEG or WebP
        // (PNG doesn't support quality parameter)
        let mimeType = file.type;
        if (mimeType === 'image/png' || mimeType === 'image/bmp' || mimeType === 'image/gif') {
            mimeType = 'image/jpeg'; // Convert to JPEG for better compression
        }
        const extension = getExtension(mimeType);

        // Start dimensions
        let width = img.width;
        let height = img.height;

        // Step 1: If image is very large, scale down proportionally first
        // This helps reach small targets like 50KB or 100KB
        let scale = 1.0;
        if (targetBytes < 100 * 1024 && (width > 1920 || height > 1920)) {
            scale = 0.5;
        } else if (targetBytes < 200 * 1024 && (width > 2560 || height > 2560)) {
            scale = 0.7;
        } else if (targetBytes < 500 * 1024 && (width > 3840 || height > 3840)) {
            scale = 0.8;
        }
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        // Step 2: Binary search for the best quality that fits under target
        let lo = 0.05;
        let hi = 1.0;
        let attempts = 0;
        const maxAttempts = 8;

        while (attempts < maxAttempts && (hi - lo) > 0.03) {
            const mid = (lo + hi) / 2;
            const blob = await canvasToBlob(img, width, height, mimeType, mid);

            if (blob.size <= targetBytes) {
                bestBlob = blob;
                bestQuality = mid;
                lo = mid; // Try higher quality
            } else {
                hi = mid; // Try lower quality
            }
            attempts++;
        }

        // If even lowest quality doesn't fit, try scaling down more
        if (!bestBlob || bestBlob.size > targetBytes) {
            for (let s = 0.8; s >= 0.2; s -= 0.15) {
                const w = Math.round(img.width * s);
                const h = Math.round(img.height * s);
                const blob = await canvasToBlob(img, w, h, mimeType, 0.5);
                if (blob.size <= targetBytes) {
                    bestBlob = blob;
                    width = w;
                    height = h;
                    bestQuality = 0.5;

                    // Now binary search quality at this scale
                    let lo2 = 0.5;
                    let hi2 = 1.0;
                    for (let a = 0; a < 5; a++) {
                        const mid2 = (lo2 + hi2) / 2;
                        const blob2 = await canvasToBlob(img, w, h, mimeType, mid2);
                        if (blob2.size <= targetBytes) {
                            bestBlob = blob2;
                            bestQuality = mid2;
                            lo2 = mid2;
                        } else {
                            hi2 = mid2;
                        }
                    }
                    break;
                }
            }
        }

        // Fallback: if still nothing, just compress at minimum
        if (!bestBlob) {
            bestBlob = await canvasToBlob(img, Math.round(img.width * 0.2), Math.round(img.height * 0.2), mimeType, 0.1);
            width = Math.round(img.width * 0.2);
            height = Math.round(img.height * 0.2);
            bestQuality = 0.1;
        }

        const originalUrl = URL.createObjectURL(file);
        const compressedUrl = URL.createObjectURL(bestBlob);
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const outputName = `${baseName}_compressed.${extension}`;

        return {
            name: file.name,
            outputName,
            originalSize: file.size,
            compressedSize: bestBlob.size,
            originalUrl,
            compressedUrl,
            compressedBlob: bestBlob,
            width,
            height,
            originalWidth: img.width,
            originalHeight: img.height,
            savings: ((1 - bestBlob.size / file.size) * 100),
            targetHit: bestBlob.size <= targetBytes,
            targetBytes,
            qualityUsed: Math.round(bestQuality * 100),
            error: false,
        };
    }

    // ===== Standard Compression (Advanced Mode) =====
    function compressImage(file, q, fmt, mw) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        let width = img.width;
                        let height = img.height;
                        if (mw > 0 && width > mw) {
                            const ratio = mw / width;
                            width = mw;
                            height = Math.round(height * ratio);
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(img, 0, 0, width, height);

                        let mimeType, extension;
                        if (fmt === 'original') {
                            mimeType = file.type === 'image/gif' ? 'image/png' : file.type;
                            extension = getExtension(mimeType);
                        } else {
                            mimeType = `image/${fmt}`;
                            extension = fmt === 'jpeg' ? 'jpg' : fmt;
                        }

                        const qualityParam = mimeType === 'image/png' ? undefined : q;

                        canvas.toBlob((blob) => {
                            if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
                            const originalUrl = URL.createObjectURL(file);
                            const compressedUrl = URL.createObjectURL(blob);
                            const baseName = file.name.replace(/\.[^.]+$/, '');

                            resolve({
                                name: file.name,
                                outputName: `${baseName}_compressed.${extension}`,
                                originalSize: file.size,
                                compressedSize: blob.size,
                                originalUrl,
                                compressedUrl,
                                compressedBlob: blob,
                                width, height,
                                originalWidth: img.width,
                                originalHeight: img.height,
                                savings: ((1 - blob.size / file.size) * 100),
                                targetHit: true,
                                qualityUsed: Math.round(q * 100),
                                error: false,
                            });
                        }, mimeType, qualityParam);
                    } catch (err) { reject(err); }
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    // ===== Helper: Load Image =====
    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    // ===== Helper: Canvas to Blob =====
    function canvasToBlob(img, width, height, mimeType, quality) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
                resolve(blob);
            }, mimeType, quality);
        });
    }

    function getExtension(mimeType) {
        const map = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'image/bmp': 'bmp',
            'image/gif': 'png',
        };
        return map[mimeType] || 'jpg';
    }

    // ===== Progress =====
    function updateProgress(current, total, filename) {
        const bar = document.getElementById('progressBar');
        const text = document.getElementById('progressText');
        const pct = Math.round((current / total) * 100);
        if (bar) bar.style.width = pct + '%';
        if (text) text.textContent = current < total
            ? `Compressing ${current + 1} of ${total}: ${filename}`
            : `All ${total} images compressed!`;
    }

    // ===== Results =====
    function showResults(totalOriginal, totalCompressed) {
        const container = document.getElementById('resultsContainer');
        const summary = document.getElementById('resultsSummary');
        const grid = document.getElementById('resultsGrid');

        const totalSavings = totalOriginal > 0 ? ((1 - totalCompressed / totalOriginal) * 100) : 0;
        const savedBytes = totalOriginal - totalCompressed;

        // Check if all targets were hit (simple mode)
        const allHit = compressedResults.every(r => r.targetHit !== false);
        const targetInfo = currentMode === 'simple'
            ? ` &bull; Target: under ${targetSizeKB >= 1024 ? (targetSizeKB/1024).toFixed(1).replace('.0','') + ' MB' : targetSizeKB + ' KB'} ${allHit ? '✅' : '⚠️'}`
            : '';

        summary.innerHTML = `
            <div class="summary-text">
                <span class="summary-icon">${totalSavings > 0 ? '🎉' : '📊'}</span>
                <div>
                    <div class="summary-title">${totalSavings > 0 ? 'Compression Complete!' : 'Processing Complete'}</div>
                    <div class="summary-detail">
                        ${compressedResults.length} image${compressedResults.length > 1 ? 's' : ''} processed &bull;
                        Saved ${ToolUtils.formatBytes(Math.max(0, savedBytes))}${targetInfo}
                    </div>
                </div>
            </div>
            <div style="display:flex; gap:32px;">
                <div class="summary-stat">
                    <div class="summary-stat-value">${ToolUtils.formatPercentage(Math.max(0, totalSavings), 0)}</div>
                    <div class="summary-stat-label">Reduced</div>
                </div>
                <div class="summary-stat">
                    <div class="summary-stat-value" style="font-size:20px;">${ToolUtils.formatBytes(totalOriginal)}</div>
                    <div class="summary-stat-label">Original</div>
                </div>
                <div class="summary-stat">
                    <div class="summary-stat-value" style="font-size:20px;">${ToolUtils.formatBytes(totalCompressed)}</div>
                    <div class="summary-stat-label">Compressed</div>
                </div>
            </div>
        `;

        grid.innerHTML = compressedResults.map((result, idx) => {
            if (result.error) {
                return `
                    <div class="image-result-card" style="border-color: var(--danger);">
                        <div class="image-result-header">
                            <span class="image-result-name">${escapeHTML(result.name)}</span>
                            <span style="color:var(--danger); font-size:13px; font-weight:600;">Failed to compress</span>
                        </div>
                    </div>
                `;
            }

            const savingsClass = result.savings > 50 ? 'great' : 'good';
            const targetBadge = (currentMode === 'simple' && result.targetHit !== undefined)
                ? `<span class="target-hit-badge ${result.targetHit ? 'hit' : 'miss'}">${result.targetHit ? '✅ Under target' : '⚠️ Could not reach target'}</span>`
                : '';

            return `
                <div class="image-result-card">
                    <div class="image-result-header">
                        <span class="image-result-name" title="${escapeHTML(result.name)}">${escapeHTML(result.name)}</span>
                        <div class="image-result-savings">
                            ${targetBadge}
                            <span class="savings-badge ${savingsClass}">
                                ${result.savings > 0 ? '↓' : '↑'} ${ToolUtils.formatPercentage(Math.abs(result.savings), 1)} ${result.savings > 0 ? 'smaller' : 'larger'}
                            </span>
                        </div>
                    </div>
                    <div class="image-result-body">
                        <div class="preview-side">
                            <div class="preview-label">Original</div>
                            <img class="preview-image" src="${result.originalUrl}" alt="Original" loading="lazy">
                            <div class="preview-size">${ToolUtils.formatBytes(result.originalSize)} (${result.originalWidth}x${result.originalHeight})</div>
                        </div>
                        <div class="preview-side">
                            <div class="preview-label">Compressed</div>
                            <img class="preview-image" src="${result.compressedUrl}" alt="Compressed" loading="lazy">
                            <div class="preview-size">${ToolUtils.formatBytes(result.compressedSize)} (${result.width}x${result.height})</div>
                        </div>
                    </div>
                    <div class="image-result-footer">
                        <button class="btn-download" onclick="downloadSingle(${idx})">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Download
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.classList.add('visible');
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Cross-tool chaining for compressed images
        if (window.ToolChain && compressedResults.length > 0) {
            const firstResult = compressedResults[0];
            const chainContainer = document.getElementById('icChainActions');
            if (chainContainer && firstResult.compressedBlob) {
                ToolChain.inject(chainContainer, firstResult.compressedBlob, firstResult.outputName, 'image-compressor');
            }
        }
    }

    // ===== Downloads =====
    window.downloadSingle = function (idx) {
        const result = compressedResults[idx];
        if (result && result.compressedBlob) {
            ToolUtils.downloadBlob(result.compressedBlob, result.outputName);
        }
    };

    function downloadAll() {
        compressedResults.forEach((result, idx) => {
            if (result.compressedBlob) {
                setTimeout(() => {
                    ToolUtils.downloadBlob(result.compressedBlob, result.outputName);
                }, idx * 200);
            }
        });
    }

    // ===== Clear =====
    function clearAll() {
        compressedResults.forEach(r => {
            if (r.compressedUrl) URL.revokeObjectURL(r.compressedUrl);
            if (r.originalUrl) URL.revokeObjectURL(r.originalUrl);
        });
        files = [];
        compressedResults = [];

        const panel = document.getElementById('controlsPanel');
        if (panel) panel.classList.remove('visible');
        const results = document.getElementById('resultsContainer');
        if (results) results.classList.remove('visible');
        const progress = document.getElementById('progressContainer');
        if (progress) progress.classList.remove('visible');
        const fileInput = document.getElementById('fileInput');
        if (fileInput) fileInput.value = '';

        updateFileCount();

        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) clearBtn.style.display = 'none';
        const compressBtn = document.getElementById('compressBtn');
        if (compressBtn) {
            compressBtn.disabled = true;
            compressBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                Compress Images
            `;
        }
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

})();
