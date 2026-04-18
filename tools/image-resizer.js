/* =============================================
   ToolBox India — Image Resizer
   Full-featured client-side image resizing tool
   
   Features:
   • Resize by exact dimensions (px, cm, mm, in)
   • Resize by percentage
   • Batch resize multiple images
   • Social media preset sizes (Instagram, Facebook, Twitter, YouTube, LinkedIn, WhatsApp)
   • Aspect ratio lock / unlock
   • Crop to fit (center crop when ratio changes)
   • Output format conversion (JPG, PNG, WebP)
   • Quality control slider
   • DPI settings (72, 150, 300, custom)
   • Live preview with before/after comparison
   • Drag & drop upload
   • Bulk download as ZIP
   
   100% client-side — NO files leave the browser!
   ============================================= */

(function () {
    'use strict';

    /* ---------- state ---------- */
    let files = [];           // { file, img, name, origW, origH }
    let resizedResults = [];  // { blob, name, w, h, size }
    let activeIndex = 0;
    let aspectLocked = true;
    let resizeMode = 'pixels';   // 'pixels' | 'percent' | 'preset'
    let unit = 'px';             // 'px' | 'cm' | 'mm' | 'in'
    let targetW = 0;
    let targetH = 0;
    let percent = 100;
    let quality = 0.92;
    let outputFormat = 'original'; // 'original' | 'jpeg' | 'png' | 'webp'
    let dpi = 72;
    let cropToFit = false;
    let selectedPreset = null;

    /* ---------- social media presets ---------- */
    const PRESETS = [
        { cat: 'Instagram', items: [
            { label: 'Post Square',   w: 1080, h: 1080 },
            { label: 'Post Portrait', w: 1080, h: 1350 },
            { label: 'Post Landscape',w: 1080, h: 566  },
            { label: 'Story / Reel',  w: 1080, h: 1920 },
            { label: 'Profile Pic',   w: 320,  h: 320  },
        ]},
        { cat: 'Facebook', items: [
            { label: 'Post',          w: 1200, h: 630  },
            { label: 'Cover Photo',   w: 820,  h: 312  },
            { label: 'Profile Pic',   w: 170,  h: 170  },
            { label: 'Event Cover',   w: 1920, h: 1005 },
            { label: 'Story',         w: 1080, h: 1920 },
        ]},
        { cat: 'Twitter / X', items: [
            { label: 'Post Image',    w: 1600, h: 900  },
            { label: 'Header',        w: 1500, h: 500  },
            { label: 'Profile Pic',   w: 400,  h: 400  },
        ]},
        { cat: 'YouTube', items: [
            { label: 'Thumbnail',     w: 1280, h: 720  },
            { label: 'Channel Art',   w: 2560, h: 1440 },
            { label: 'Profile Pic',   w: 800,  h: 800  },
        ]},
        { cat: 'LinkedIn', items: [
            { label: 'Post',          w: 1200, h: 627  },
            { label: 'Cover Photo',   w: 1128, h: 191  },
            { label: 'Profile Pic',   w: 400,  h: 400  },
        ]},
        { cat: 'WhatsApp', items: [
            { label: 'Profile Pic',   w: 500,  h: 500  },
            { label: 'Status',        w: 1080, h: 1920 },
        ]},
        { cat: 'Common', items: [
            { label: 'HD (720p)',     w: 1280, h: 720  },
            { label: 'Full HD (1080p)', w: 1920, h: 1080 },
            { label: '4K UHD',        w: 3840, h: 2160 },
            { label: 'A4 (300 DPI)',  w: 2480, h: 3508 },
            { label: 'Passport Photo',w: 413,  h: 531  },
            { label: 'Favicon',       w: 64,   h: 64   },
            { label: 'Icon 512',      w: 512,  h: 512  },
        ]},
    ];

    /* ---------- unit conversions ---------- */
    function pxToUnit(px, dpiVal, unitStr) {
        if (unitStr === 'cm') return +(px / dpiVal * 2.54).toFixed(2);
        if (unitStr === 'mm') return +(px / dpiVal * 25.4).toFixed(2);
        if (unitStr === 'in') return +(px / dpiVal).toFixed(3);
        return px;
    }

    function unitToPx(val, dpiVal, unitStr) {
        if (unitStr === 'cm') return Math.round(val * dpiVal / 2.54);
        if (unitStr === 'mm') return Math.round(val * dpiVal / 25.4);
        if (unitStr === 'in') return Math.round(val * dpiVal);
        return Math.round(val);
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(2) + ' MB';
    }

    /* ========================================
       REGISTER TOOL
       ======================================== */
    ToolRegistry.register('image-resizer', {
        render() {
            return `
                <div id="irRoot">
                    <!-- Upload Screen -->
                    <div id="irUpload" class="ir-section">
                        <div class="drop-zone" id="irDropZone">
                            <div class="drop-zone-icon">
                                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5">
                                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                                </svg>
                            </div>
                            <p class="drop-zone-text">Drop images here to resize</p>
                            <p class="drop-zone-hint">or click to browse • Supports JPG, PNG, WebP, BMP, GIF</p>
                            <input type="file" id="irFileInput" accept="image/*" multiple hidden>
                        </div>
                    </div>

                    <!-- Workspace -->
                    <div id="irWorkspace" class="ir-section" style="display:none;">
                        <div class="ir-layout">
                            <!-- LEFT: Preview -->
                            <div class="ir-preview-panel">
                                <div class="ir-preview-header">
                                    <span id="irFileName" class="ir-file-name">image.jpg</span>
                                    <span id="irOrigDims" class="ir-orig-dims">1920 × 1080</span>
                                </div>
                                <div class="ir-preview-canvas" id="irPreviewCanvas">
                                    <img id="irPreviewImg" src="" alt="Preview">
                                </div>
                                <div class="ir-preview-info">
                                    <span id="irOrigSize" class="ir-info-badge">Original: —</span>
                                    <span id="irNewSize" class="ir-info-badge ir-info-new">New: —</span>
                                </div>
                                <!-- Batch thumbnails -->
                                <div id="irThumbnails" class="ir-thumbnails" style="display:none;"></div>
                            </div>

                            <!-- RIGHT: Controls -->
                            <div class="ir-controls-panel">
                                <!-- Resize Mode Tabs -->
                                <div class="ir-mode-tabs">
                                    <button class="ir-mode-tab active" data-mode="pixels">📐 Dimensions</button>
                                    <button class="ir-mode-tab" data-mode="percent">📊 Percentage</button>
                                    <button class="ir-mode-tab" data-mode="preset">📱 Presets</button>
                                </div>

                                <!-- Pixels / Dimensions Mode -->
                                <div id="irModePixels" class="ir-mode-content">
                                    <div class="ir-dim-row">
                                        <div class="ir-dim-field">
                                            <label>Width</label>
                                            <div class="ir-input-group">
                                                <input type="number" id="irWidth" class="ir-input" min="1" max="20000" value="0">
                                                <select id="irUnit" class="ir-unit-select">
                                                    <option value="px" selected>px</option>
                                                    <option value="cm">cm</option>
                                                    <option value="mm">mm</option>
                                                    <option value="in">in</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button id="irLockAspect" class="ir-lock-btn active" title="Lock aspect ratio">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <rect x="3" y="11" width="18" height="11" rx="2"/>
                                                <path d="M7 11V7a5 5 0 0110 0v4"/>
                                            </svg>
                                        </button>
                                        <div class="ir-dim-field">
                                            <label>Height</label>
                                            <div class="ir-input-group">
                                                <input type="number" id="irHeight" class="ir-input" min="1" max="20000" value="0">
                                                <span class="ir-unit-label" id="irUnitLabel">px</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="ir-option-row">
                                        <label class="ir-checkbox">
                                            <input type="checkbox" id="irCropToFit">
                                            <span>Crop to fit (center crop when ratio changes)</span>
                                        </label>
                                    </div>
                                </div>

                                <!-- Percentage Mode -->
                                <div id="irModePercent" class="ir-mode-content" style="display:none;">
                                    <div class="ir-percent-control">
                                        <label>Scale</label>
                                        <input type="range" id="irPercent" class="ir-range" min="1" max="500" value="100">
                                        <div class="ir-percent-row">
                                            <input type="number" id="irPercentVal" class="ir-input ir-input-sm" min="1" max="500" value="100">
                                            <span>%</span>
                                        </div>
                                    </div>
                                    <div class="ir-percent-presets">
                                        <button class="ir-pct-btn" data-pct="25">25%</button>
                                        <button class="ir-pct-btn" data-pct="50">50%</button>
                                        <button class="ir-pct-btn" data-pct="75">75%</button>
                                        <button class="ir-pct-btn active" data-pct="100">100%</button>
                                        <button class="ir-pct-btn" data-pct="150">150%</button>
                                        <button class="ir-pct-btn" data-pct="200">200%</button>
                                    </div>
                                    <div class="ir-percent-result" id="irPercentResult">Result: — × — px</div>
                                </div>

                                <!-- Preset Mode -->
                                <div id="irModePreset" class="ir-mode-content" style="display:none;">
                                    <div class="ir-preset-list" id="irPresetList"></div>
                                </div>

                                <!-- Common Options -->
                                <div class="ir-common-options">
                                    <h4 class="ir-section-title">Output Settings</h4>

                                    <div class="ir-option-row">
                                        <label>Format</label>
                                        <select id="irFormat" class="ir-select">
                                            <option value="original">Keep Original</option>
                                            <option value="jpeg">JPEG</option>
                                            <option value="png">PNG</option>
                                            <option value="webp">WebP</option>
                                        </select>
                                    </div>

                                    <div class="ir-option-row" id="irQualityRow">
                                        <label>Quality</label>
                                        <input type="range" id="irQuality" class="ir-range" min="10" max="100" value="92">
                                        <span id="irQualityVal" class="ir-range-val">92%</span>
                                    </div>

                                    <div class="ir-option-row">
                                        <label>DPI</label>
                                        <div class="ir-dpi-group">
                                            <button class="ir-dpi-btn" data-dpi="72">72</button>
                                            <button class="ir-dpi-btn active" data-dpi="72">Screen</button>
                                            <button class="ir-dpi-btn" data-dpi="150">150</button>
                                            <button class="ir-dpi-btn" data-dpi="300">300 (Print)</button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Action Buttons -->
                                <div class="ir-actions">
                                    <button id="irResizeBtn" class="btn-primary ir-btn-resize">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                                        Resize Image
                                    </button>
                                    <button id="irResetBtn" class="btn-secondary ir-btn-reset" style="display:none;">
                                        ↺ Reset
                                    </button>
                                </div>

                                <!-- Result -->
                                <div id="irResult" class="ir-result" style="display:none;">
                                    <div class="ir-result-card">
                                        <div class="ir-result-info">
                                            <span class="ir-result-dims" id="irResultDims">—</span>
                                            <span class="ir-result-size" id="irResultSize">—</span>
                                            <span class="ir-result-saving" id="irResultSaving"></span>
                                        </div>
                                        <div class="ir-result-actions">
                                            <button id="irDownloadBtn" class="btn-primary">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                                Download
                                            </button>
                                            <button id="irDownloadAllBtn" class="btn-secondary" style="display:none;">
                                                📦 Download All (ZIP)
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Add More -->
                                <button id="irAddMore" class="ir-add-more">+ Add More Images</button>
                                <input type="file" id="irAddMoreInput" accept="image/*" multiple hidden>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        init() {
            setupUpload();
            setupControls();
            renderPresets();
        },

        destroy() {
            files = [];
            resizedResults = [];
            activeIndex = 0;
            aspectLocked = true;
            resizeMode = 'pixels';
            unit = 'px';
            targetW = 0;
            targetH = 0;
            percent = 100;
            quality = 0.92;
            outputFormat = 'original';
            dpi = 72;
            cropToFit = false;
            selectedPreset = null;
        },
    });

    /* ========================================
       FILE UPLOAD
       ======================================== */
    function setupUpload() {
        const dropZone = document.getElementById('irDropZone');
        const fileInput = document.getElementById('irFileInput');
        if (!dropZone || !fileInput) return;

        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drop-zone-active'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-zone-active'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('drop-zone-active');
            handleFiles(e.dataTransfer.files);
        });
        fileInput.addEventListener('change', e => handleFiles(e.target.files));

        // Add more files button
        const addMoreBtn = document.getElementById('irAddMore');
        const addMoreInput = document.getElementById('irAddMoreInput');
        if (addMoreBtn && addMoreInput) {
            addMoreBtn.addEventListener('click', () => addMoreInput.click());
            addMoreInput.addEventListener('change', e => handleFiles(e.target.files));
        }
    }

    function handleFiles(fileList) {
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif'];
        const newFiles = Array.from(fileList).filter(f => validTypes.includes(f.type));
        if (!newFiles.length) return;

        let loaded = 0;
        for (const file of newFiles) {
            const img = new Image();
            const reader = new FileReader();
            reader.onload = e => {
                img.onload = () => {
                    files.push({ file, img, name: file.name, origW: img.naturalWidth, origH: img.naturalHeight, dataUrl: e.target.result });
                    loaded++;
                    if (loaded === newFiles.length) {
                        onFilesReady();
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    function onFilesReady() {
        if (!files.length) return;

        document.getElementById('irUpload').style.display = 'none';
        document.getElementById('irWorkspace').style.display = '';

        // Set active to latest added (or first)
        if (activeIndex >= files.length) activeIndex = 0;
        const f = files[activeIndex];

        // Set default target to original dimensions
        targetW = f.origW;
        targetH = f.origH;
        updateDimInputs();
        updatePreview();
        renderThumbnails();

        // Reset result
        document.getElementById('irResult').style.display = 'none';
        document.getElementById('irResetBtn').style.display = 'none';
    }

    /* ========================================
       CONTROLS SETUP
       ======================================== */
    function setupControls() {
        // Mode tabs
        document.querySelectorAll('.ir-mode-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.ir-mode-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                resizeMode = tab.dataset.mode;
                document.getElementById('irModePixels').style.display = resizeMode === 'pixels' ? '' : 'none';
                document.getElementById('irModePercent').style.display = resizeMode === 'percent' ? '' : 'none';
                document.getElementById('irModePreset').style.display = resizeMode === 'preset' ? '' : 'none';
                if (resizeMode === 'percent') updatePercentResult();
            });
        });

        // Width / Height inputs
        const wInput = document.getElementById('irWidth');
        const hInput = document.getElementById('irHeight');
        if (wInput) {
            wInput.addEventListener('input', () => {
                const valInUnit = parseFloat(wInput.value) || 0;
                targetW = unitToPx(valInUnit, dpi, unit);
                if (aspectLocked && files[activeIndex]) {
                    const ratio = files[activeIndex].origH / files[activeIndex].origW;
                    targetH = Math.round(targetW * ratio);
                    hInput.value = pxToUnit(targetH, dpi, unit);
                }
                updatePreviewDebounced();
            });
        }
        if (hInput) {
            hInput.addEventListener('input', () => {
                const valInUnit = parseFloat(hInput.value) || 0;
                targetH = unitToPx(valInUnit, dpi, unit);
                if (aspectLocked && files[activeIndex]) {
                    const ratio = files[activeIndex].origW / files[activeIndex].origH;
                    targetW = Math.round(targetH * ratio);
                    wInput.value = pxToUnit(targetW, dpi, unit);
                }
                updatePreviewDebounced();
            });
        }

        // Unit selector
        document.getElementById('irUnit')?.addEventListener('change', e => {
            unit = e.target.value;
            document.getElementById('irUnitLabel').textContent = unit;
            updateDimInputs();
        });

        // Lock aspect
        document.getElementById('irLockAspect')?.addEventListener('click', e => {
            aspectLocked = !aspectLocked;
            const btn = e.currentTarget;
            btn.classList.toggle('active', aspectLocked);
            btn.innerHTML = aspectLocked
                ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>'
                : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>';
        });

        // Crop to fit
        document.getElementById('irCropToFit')?.addEventListener('change', e => {
            cropToFit = e.target.checked;
        });

        // Percentage
        const pctRange = document.getElementById('irPercent');
        const pctVal = document.getElementById('irPercentVal');
        if (pctRange) {
            pctRange.addEventListener('input', () => {
                percent = parseInt(pctRange.value);
                if (pctVal) pctVal.value = percent;
                updatePercentResult();
                // Update percent preset buttons
                document.querySelectorAll('.ir-pct-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.pct) === percent));
            });
        }
        if (pctVal) {
            pctVal.addEventListener('input', () => {
                percent = parseInt(pctVal.value) || 100;
                if (pctRange) pctRange.value = Math.min(percent, 500);
                updatePercentResult();
            });
        }
        document.querySelectorAll('.ir-pct-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                percent = parseInt(btn.dataset.pct);
                if (pctRange) pctRange.value = percent;
                if (pctVal) pctVal.value = percent;
                document.querySelectorAll('.ir-pct-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                updatePercentResult();
            });
        });

        // Format
        document.getElementById('irFormat')?.addEventListener('change', e => {
            outputFormat = e.target.value;
            const qualityRow = document.getElementById('irQualityRow');
            // PNG doesn't support quality
            if (qualityRow) {
                qualityRow.style.display = outputFormat === 'png' ? 'none' : '';
            }
        });

        // Quality
        const qualitySlider = document.getElementById('irQuality');
        if (qualitySlider) {
            qualitySlider.addEventListener('input', () => {
                quality = parseInt(qualitySlider.value) / 100;
                document.getElementById('irQualityVal').textContent = qualitySlider.value + '%';
            });
        }

        // DPI
        document.querySelectorAll('.ir-dpi-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                dpi = parseInt(btn.dataset.dpi);
                document.querySelectorAll('.ir-dpi-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (unit !== 'px') updateDimInputs();
            });
        });

        // Resize button
        document.getElementById('irResizeBtn')?.addEventListener('click', doResize);

        // Reset
        document.getElementById('irResetBtn')?.addEventListener('click', () => {
            resizedResults = [];
            document.getElementById('irResult').style.display = 'none';
            document.getElementById('irResetBtn').style.display = 'none';
            document.getElementById('irResizeBtn').style.display = '';
            if (files[activeIndex]) {
                targetW = files[activeIndex].origW;
                targetH = files[activeIndex].origH;
                updateDimInputs();
                updatePreview();
            }
        });

        // Download
        document.getElementById('irDownloadBtn')?.addEventListener('click', downloadCurrent);
        document.getElementById('irDownloadAllBtn')?.addEventListener('click', downloadAllZip);
    }

    /* ========================================
       PRESETS
       ======================================== */
    function renderPresets() {
        const container = document.getElementById('irPresetList');
        if (!container) return;

        let html = '';
        for (const cat of PRESETS) {
            html += `<div class="ir-preset-category">
                <h5 class="ir-preset-cat-title">${cat.cat}</h5>
                <div class="ir-preset-items">`;
            for (const item of cat.items) {
                html += `<button class="ir-preset-btn" data-w="${item.w}" data-h="${item.h}" title="${item.w}×${item.h}">
                    <span class="ir-preset-label">${item.label}</span>
                    <span class="ir-preset-size">${item.w}×${item.h}</span>
                </button>`;
            }
            html += `</div></div>`;
        }
        container.innerHTML = html;

        // Preset click handlers
        container.querySelectorAll('.ir-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.ir-preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                targetW = parseInt(btn.dataset.w);
                targetH = parseInt(btn.dataset.h);
                selectedPreset = `${targetW}×${targetH}`;
                aspectLocked = false;
                document.getElementById('irLockAspect')?.classList.remove('active');
                updateDimInputs();
                updatePreview();
            });
        });
    }

    /* ========================================
       PREVIEW & DIMENSIONS
       ======================================== */
    function updateDimInputs() {
        const wInput = document.getElementById('irWidth');
        const hInput = document.getElementById('irHeight');
        if (wInput) wInput.value = pxToUnit(targetW, dpi, unit);
        if (hInput) hInput.value = pxToUnit(targetH, dpi, unit);
        document.getElementById('irUnitLabel').textContent = unit;
    }

    function updatePercentResult() {
        if (!files[activeIndex]) return;
        const f = files[activeIndex];
        const newW = Math.round(f.origW * percent / 100);
        const newH = Math.round(f.origH * percent / 100);
        const el = document.getElementById('irPercentResult');
        if (el) el.textContent = `Result: ${newW} × ${newH} px`;
    }

    let previewTimeout = null;
    function updatePreviewDebounced() {
        clearTimeout(previewTimeout);
        previewTimeout = setTimeout(updatePreview, 150);
    }

    function updatePreview() {
        const f = files[activeIndex];
        if (!f) return;

        const imgEl = document.getElementById('irPreviewImg');
        if (imgEl) imgEl.src = f.dataUrl;

        document.getElementById('irFileName').textContent = f.name;
        document.getElementById('irOrigDims').textContent = `${f.origW} × ${f.origH} px`;
        document.getElementById('irOrigSize').textContent = `Original: ${formatSize(f.file.size)} • ${f.origW}×${f.origH}`;

        // Calculate new dimensions based on mode
        let newW, newH;
        if (resizeMode === 'percent') {
            newW = Math.round(f.origW * percent / 100);
            newH = Math.round(f.origH * percent / 100);
        } else {
            newW = targetW || f.origW;
            newH = targetH || f.origH;
        }

        document.getElementById('irNewSize').textContent = `New: ${newW} × ${newH} px`;
    }

    /* ========================================
       THUMBNAILS (batch)
       ======================================== */
    function renderThumbnails() {
        const container = document.getElementById('irThumbnails');
        if (!container) return;

        if (files.length <= 1) {
            container.style.display = 'none';
            return;
        }

        container.style.display = '';
        container.innerHTML = files.map((f, i) =>
            `<div class="ir-thumb ${i === activeIndex ? 'active' : ''}" data-idx="${i}">
                <img src="${f.dataUrl}" alt="${f.name}">
                <span class="ir-thumb-name">${f.name.length > 12 ? f.name.slice(0, 10) + '…' : f.name}</span>
                <button class="ir-thumb-remove" data-idx="${i}" title="Remove">×</button>
            </div>`
        ).join('');

        container.querySelectorAll('.ir-thumb').forEach(el => {
            el.addEventListener('click', e => {
                if (e.target.classList.contains('ir-thumb-remove')) return;
                activeIndex = parseInt(el.dataset.idx);
                const f = files[activeIndex];
                targetW = f.origW;
                targetH = f.origH;
                updateDimInputs();
                updatePreview();
                renderThumbnails();
            });
        });

        container.querySelectorAll('.ir-thumb-remove').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.idx);
                files.splice(idx, 1);
                resizedResults.splice(idx, 1);
                if (activeIndex >= files.length) activeIndex = Math.max(0, files.length - 1);
                if (!files.length) {
                    document.getElementById('irUpload').style.display = '';
                    document.getElementById('irWorkspace').style.display = 'none';
                    return;
                }
                const f = files[activeIndex];
                targetW = f.origW;
                targetH = f.origH;
                updateDimInputs();
                updatePreview();
                renderThumbnails();
            });
        });
    }

    /* ========================================
       RESIZE ENGINE
       ======================================== */
    async function doResize() {
        if (!files.length) return;

        const btn = document.getElementById('irResizeBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Resizing...';
        }

        resizedResults = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                let newW, newH;

                if (resizeMode === 'percent') {
                    newW = Math.round(f.origW * percent / 100);
                    newH = Math.round(f.origH * percent / 100);
                } else {
                    newW = targetW || f.origW;
                    newH = targetH || f.origH;
                }

                // Ensure minimum 1px
                newW = Math.max(1, newW);
                newH = Math.max(1, newH);

                const blob = await resizeImage(f.img, f.origW, f.origH, newW, newH, f.file.type);
                const ext = getOutputExt(f.file.type);
                const name = f.name.replace(/\.[^.]+$/, '') + '_resized.' + ext;

                resizedResults.push({ blob, name, w: newW, h: newH, size: blob.size, origSize: f.file.size });
            }

            showResult();
        } catch (err) {
            console.error('Resize error:', err);
            alert('Failed to resize: ' + err.message);
        }

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg> Resize Image';
        }
    }

    function resizeImage(img, origW, origH, newW, newH, origType) {
        return new Promise(resolve => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (cropToFit && !aspectLocked) {
                // Center-crop to fit exact dimensions
                canvas.width = newW;
                canvas.height = newH;

                const origRatio = origW / origH;
                const targetRatio = newW / newH;

                let srcX = 0, srcY = 0, srcW = origW, srcH = origH;
                if (origRatio > targetRatio) {
                    // Original is wider — crop sides
                    srcW = origH * targetRatio;
                    srcX = (origW - srcW) / 2;
                } else {
                    // Original is taller — crop top/bottom
                    srcH = origW / targetRatio;
                    srcY = (origH - srcH) / 2;
                }

                // Use higher quality rendering
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, newW, newH);
            } else {
                // Standard resize — scale to fit
                canvas.width = newW;
                canvas.height = newH;

                // Multi-step downscale for quality (Lanczos-like)
                if (newW < origW * 0.5 || newH < origH * 0.5) {
                    // Step down gradually for better quality
                    const steps = Math.ceil(Math.log2(Math.max(origW / newW, origH / newH)));
                    let currentCanvas = document.createElement('canvas');
                    let currentCtx = currentCanvas.getContext('2d');
                    currentCanvas.width = origW;
                    currentCanvas.height = origH;
                    currentCtx.drawImage(img, 0, 0);

                    for (let s = 0; s < steps; s++) {
                        const stepW = s === steps - 1 ? newW : Math.round(currentCanvas.width / 2);
                        const stepH = s === steps - 1 ? newH : Math.round(currentCanvas.height / 2);

                        const stepCanvas = document.createElement('canvas');
                        const stepCtx = stepCanvas.getContext('2d');
                        stepCanvas.width = stepW;
                        stepCanvas.height = stepH;
                        stepCtx.imageSmoothingEnabled = true;
                        stepCtx.imageSmoothingQuality = 'high';
                        stepCtx.drawImage(currentCanvas, 0, 0, stepW, stepH);

                        currentCanvas = stepCanvas;
                        currentCtx = stepCtx;
                    }

                    ctx.drawImage(currentCanvas, 0, 0);
                } else {
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, newW, newH);
                }
            }

            // Determine output format
            let mimeType = origType;
            if (outputFormat === 'jpeg') mimeType = 'image/jpeg';
            else if (outputFormat === 'png') mimeType = 'image/png';
            else if (outputFormat === 'webp') mimeType = 'image/webp';

            const q = mimeType === 'image/png' ? undefined : quality;
            canvas.toBlob(blob => resolve(blob), mimeType, q);
        });
    }

    function getOutputExt(origType) {
        if (outputFormat === 'jpeg') return 'jpg';
        if (outputFormat === 'png') return 'png';
        if (outputFormat === 'webp') return 'webp';
        // Keep original
        if (origType === 'image/png') return 'png';
        if (origType === 'image/webp') return 'webp';
        if (origType === 'image/gif') return 'gif';
        if (origType === 'image/bmp') return 'bmp';
        return 'jpg';
    }

    /* ========================================
       RESULT & DOWNLOAD
       ======================================== */
    function showResult() {
        const r = resizedResults[activeIndex];
        if (!r) return;

        document.getElementById('irResult').style.display = '';
        document.getElementById('irResetBtn').style.display = '';
        document.getElementById('irResultDims').textContent = `${r.w} × ${r.h} px`;
        document.getElementById('irResultSize').textContent = formatSize(r.size);

        const saving = r.origSize > 0 ? Math.round((1 - r.size / r.origSize) * 100) : 0;
        const savingEl = document.getElementById('irResultSaving');
        if (savingEl) {
            if (saving > 0) {
                savingEl.textContent = `${saving}% smaller`;
                savingEl.className = 'ir-result-saving ir-saving-positive';
            } else if (saving < 0) {
                savingEl.textContent = `${Math.abs(saving)}% larger`;
                savingEl.className = 'ir-result-saving ir-saving-negative';
            } else {
                savingEl.textContent = 'Same size';
                savingEl.className = 'ir-result-saving';
            }
        }

        // Show preview of resized image
        const imgEl = document.getElementById('irPreviewImg');
        if (imgEl && r.blob) {
            imgEl.src = URL.createObjectURL(r.blob);
        }

        // Show "Download All" if batch
        const downloadAllBtn = document.getElementById('irDownloadAllBtn');
        if (downloadAllBtn) {
            downloadAllBtn.style.display = files.length > 1 ? '' : 'none';
        }
    }

    function downloadCurrent() {
        const r = resizedResults[activeIndex];
        if (!r) return;
        const url = URL.createObjectURL(r.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = r.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function downloadAllZip() {
        if (resizedResults.length <= 1) return downloadCurrent();

        const btn = document.getElementById('irDownloadAllBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Creating ZIP...';
        }

        try {
            // Load JSZip from CDN if needed
            if (typeof JSZip === 'undefined') {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            const zip = new JSZip();
            for (const r of resizedResults) {
                zip.file(r.name, r.blob);
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'resized_images.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('ZIP error:', err);
            alert('Failed to create ZIP: ' + err.message);
        }

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '📦 Download All (ZIP)';
        }
    }

})();
