/* =============================================
   ToolBox India — Background Remover Tool

   Uses @imgly/background-removal (real AI / ONNX model)
   that ACTUALLY identifies the main object and removes
   the background — not some hacky color-matching trick.

   Simple flow:
   1. User uploads image
   2. AI identifies the main object
   3. Everything except the object becomes WHITE
   4. User downloads the result

   The AI model (~5MB) downloads once and caches in browser.
   100% client-side. Zero server uploads.
   ============================================= */

(function () {
    'use strict';

    // ===== State =====
    let originalFile = null;
    let resultBlob = null;
    let isProcessing = false;
    let bgRemovalLib = null; // cached library reference

    // ===== Register Tool =====
    ToolRegistry.register('background-remover', {
        title: 'Background Remover',
        description: 'AI removes the background — keeps only the main object on a clean white background.',
        category: 'Image Tools',
        tags: ['background', 'remover', 'remove bg', 'white background', 'cutout', 'ai', 'photo', 'erase background', 'passport photo'],

        render() {
            return `
                <!-- Info Banner -->
                <div class="bgr-info-banner" id="bgrInfoBanner">
                    <span class="bgr-info-icon">🤖</span>
                    <div>
                        <strong>AI-Powered</strong> — The AI model loads on first use and caches in your browser. All processing happens on your device.
                    </div>
                </div>

                <!-- Step 1: Upload -->
                <div id="bgrUploadSection">
                    <div class="tool-workspace">
                        <div class="drop-zone" id="bgrDropZone">
                            <span class="drop-zone-icon">🖼️</span>
                            <h3 class="drop-zone-title">Drop your image here</h3>
                            <p class="drop-zone-subtitle">AI will detect the main object and make the background white</p>
                            <button class="drop-zone-btn" onclick="document.getElementById('bgrFileInput').click()">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                Choose Image
                            </button>
                            <input type="file" id="bgrFileInput" accept="image/jpeg,image/png,image/webp">
                            <p class="drop-zone-info">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                JPG, PNG, WebP &bull; Max 10MB &bull; Works best with people, products & objects
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Step 2: Processing -->
                <div id="bgrProcessingSection" style="display:none;">
                    <div class="bgr-processing-card">
                        <div class="bgr-spinner"></div>
                        <h3 id="bgrStatusTitle">Loading AI model...</h3>
                        <p id="bgrStatusText">This happens once — the model caches for instant future use</p>
                        <div class="bgr-progress-bar-wrapper">
                            <div class="bgr-progress-bar" id="bgrProgressBar"></div>
                        </div>
                    </div>
                </div>

                <!-- Step 3: Result -->
                <div id="bgrResultSection" style="display:none;">
                    <div class="bgr-result-container">
                        <!-- Before / After -->
                        <div class="bgr-comparison">
                            <div class="bgr-compare-card">
                                <div class="bgr-compare-label">Before</div>
                                <div class="bgr-compare-img-wrap">
                                    <img id="bgrOriginalImg" alt="Original">
                                </div>
                            </div>
                            <div class="bgr-compare-arrow">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                            </div>
                            <div class="bgr-compare-card bgr-compare-result">
                                <div class="bgr-compare-label">After — White Background</div>
                                <div class="bgr-compare-img-wrap" style="background:#ffffff;">
                                    <img id="bgrResultImg" alt="Background removed">
                                </div>
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="bgr-actions">
                            <button class="btn-secondary" id="bgrTryAnother">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                                Try Another Image
                            </button>
                            <button class="btn-success" id="bgrDownload">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                Download Image
                            </button>
                        </div>
                    </div>
                </div>
            `;
        },

        init() {
            initDropZone();
            initButtons();
        },

        destroy() {
            originalFile = null;
            resultBlob = null;
            isProcessing = false;
        }
    });

    // ===== Drop Zone =====
    function initDropZone() {
        const dropZone = document.getElementById('bgrDropZone');
        const fileInput = document.getElementById('bgrFileInput');
        if (!dropZone || !fileInput) return;

        dropZone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) processFile(e.target.files[0]);
        });

        ['dragenter', 'dragover'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        });
        ['dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
        });
        dropZone.addEventListener('drop', (e) => {
            const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
            if (file) processFile(file);
        });
    }

    // ===== Buttons =====
    function initButtons() {
        setTimeout(() => {
            const tryAnother = document.getElementById('bgrTryAnother');
            if (tryAnother) tryAnother.addEventListener('click', resetTool);

            const download = document.getElementById('bgrDownload');
            if (download) download.addEventListener('click', downloadResult);
        }, 100);
    }

    // ===== Main Process =====
    async function processFile(file) {
        if (!file.type.startsWith('image/') || isProcessing) return;
        if (file.size > 10 * 1024 * 1024) {
            alert('File too large. Please use an image under 10MB.');
            return;
        }

        originalFile = file;
        isProcessing = true;

        // Show processing UI
        showSection('processing');
        updateStatus('Loading AI model...', 'This happens once — the model caches for instant future use', 20);

        try {
            // Step 1: Load the AI library (dynamic import, cached after first load)
            if (!bgRemovalLib) {
                updateStatus('Loading AI model...', 'Downloading background removal AI (~5MB)...', 30);
                const module = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.6/+esm');
                bgRemovalLib = module.removeBackground;
                updateStatus('AI model ready!', 'Now processing your image...', 50);
            }

            // Step 2: Remove background using real AI
            updateStatus('Analyzing image...', 'AI is identifying the main object', 60);

            const transparentBlob = await bgRemovalLib(file, {
                output: { format: 'image/png' },
            });

            updateStatus('Cleaning up & removing noise...', 'Making the background perfectly white', 85);

            // Step 3: Post-process — clean noise, smooth edges, white background
            resultBlob = await putOnWhiteBackground(transparentBlob);

            updateStatus('Finalizing...', 'Almost done!', 95);

            updateStatus('Done!', '', 100);

            // Step 4: Show result
            setTimeout(() => showResult(), 300);

        } catch (err) {
            console.error('Background removal failed:', err);
            alert('Background removal failed. Please try a different image.\n\nTip: Works best with clear subjects (people, products, animals).');
            resetTool();
        }

        isProcessing = false;
    }

    // ===== Put transparent cutout onto white background with post-processing =====
    function putOnWhiteBackground(transparentBlob) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(transparentBlob);
            const img = new Image();

            img.onload = () => {
                URL.revokeObjectURL(url);

                const W = img.width;
                const H = img.height;
                const canvas = document.createElement('canvas');
                canvas.width = W;
                canvas.height = H;
                const ctx = canvas.getContext('2d');

                // Draw the transparent cutout to read its pixel data
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, W, H);
                const px = imageData.data; // [R,G,B,A, R,G,B,A, ...]

                // ============================
                // POST-PROCESSING PIPELINE
                // Cleans up noise, semi-transparent artifacts, and edge halos
                // ============================

                // --- Pass 1: Alpha threshold ---
                // Pixels below the threshold are fully transparent (background).
                // Pixels above are kept (foreground). This kills faint noise.
                const ALPHA_CUTOFF = 40;       // anything below this → make fully white
                const ALPHA_SEMI_CUTOFF = 180;  // below this but above ALPHA_CUTOFF → blend harder toward white

                for (let i = 0; i < px.length; i += 4) {
                    const a = px[i + 3]; // alpha

                    if (a < ALPHA_CUTOFF) {
                        // Fully transparent → pure white
                        px[i] = 255;     // R
                        px[i + 1] = 255; // G
                        px[i + 2] = 255; // B
                        px[i + 3] = 255; // A (opaque white)
                    } else if (a < ALPHA_SEMI_CUTOFF) {
                        // Semi-transparent edge pixel → blend with white more aggressively
                        // Use alpha-premultiplied blending: result = fg * (a/255) + white * (1 - a/255)
                        const t = a / 255;
                        px[i]     = Math.round(px[i] * t + 255 * (1 - t));
                        px[i + 1] = Math.round(px[i + 1] * t + 255 * (1 - t));
                        px[i + 2] = Math.round(px[i + 2] * t + 255 * (1 - t));
                        px[i + 3] = 255; // make fully opaque
                    } else {
                        // Solid foreground pixel — keep color, make fully opaque
                        px[i + 3] = 255;
                    }
                }

                // --- Pass 2: Remove isolated artifact pixels ---
                // Any opaque non-white pixel that is surrounded mostly by white
                // is likely noise — turn it white.
                const ISOLATION_RADIUS = 2;
                const MIN_NEIGHBORS = 5; // minimum non-white neighbors to survive
                const WHITE_THRESHOLD = 240; // pixel is "white" if R,G,B all above this

                // Create a copy so we read original while writing cleaned
                const cleaned = new Uint8ClampedArray(px);

                for (let y = ISOLATION_RADIUS; y < H - ISOLATION_RADIUS; y++) {
                    for (let x = ISOLATION_RADIUS; x < W - ISOLATION_RADIUS; x++) {
                        const idx = (y * W + x) * 4;
                        const r = px[idx], g = px[idx + 1], b = px[idx + 2];

                        // Skip if already white-ish
                        if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) continue;

                        // Count non-white neighbors in the radius
                        let nonWhiteCount = 0;
                        for (let dy = -ISOLATION_RADIUS; dy <= ISOLATION_RADIUS; dy++) {
                            for (let dx = -ISOLATION_RADIUS; dx <= ISOLATION_RADIUS; dx++) {
                                if (dx === 0 && dy === 0) continue;
                                const nIdx = ((y + dy) * W + (x + dx)) * 4;
                                const nr = px[nIdx], ng = px[nIdx + 1], nb = px[nIdx + 2];
                                if (nr < WHITE_THRESHOLD || ng < WHITE_THRESHOLD || nb < WHITE_THRESHOLD) {
                                    nonWhiteCount++;
                                }
                            }
                        }

                        // If this pixel is mostly surrounded by white, it's noise — kill it
                        if (nonWhiteCount < MIN_NEIGHBORS) {
                            cleaned[idx] = 255;
                            cleaned[idx + 1] = 255;
                            cleaned[idx + 2] = 255;
                            cleaned[idx + 3] = 255;
                        }
                    }
                }

                // --- Pass 3: Soften edges (light blur on edge pixels only) ---
                // Finds pixels at the boundary between subject and white, then
                // averages them with neighbors for smoother edges.
                const final = new Uint8ClampedArray(cleaned);

                for (let y = 1; y < H - 1; y++) {
                    for (let x = 1; x < W - 1; x++) {
                        const idx = (y * W + x) * 4;

                        // Check if this is an edge pixel (non-white next to white)
                        const isSubject = cleaned[idx] < WHITE_THRESHOLD || cleaned[idx + 1] < WHITE_THRESHOLD || cleaned[idx + 2] < WHITE_THRESHOLD;
                        if (!isSubject) continue;

                        let hasWhiteNeighbor = false;
                        for (let dy = -1; dy <= 1 && !hasWhiteNeighbor; dy++) {
                            for (let dx = -1; dx <= 1 && !hasWhiteNeighbor; dx++) {
                                if (dx === 0 && dy === 0) continue;
                                const nIdx = ((y + dy) * W + (x + dx)) * 4;
                                if (cleaned[nIdx] >= WHITE_THRESHOLD && cleaned[nIdx + 1] >= WHITE_THRESHOLD && cleaned[nIdx + 2] >= WHITE_THRESHOLD) {
                                    hasWhiteNeighbor = true;
                                }
                            }
                        }

                        if (hasWhiteNeighbor) {
                            // Average with 3x3 neighbors for softer edge
                            let sumR = 0, sumG = 0, sumB = 0, count = 0;
                            for (let dy = -1; dy <= 1; dy++) {
                                for (let dx = -1; dx <= 1; dx++) {
                                    const nIdx = ((y + dy) * W + (x + dx)) * 4;
                                    sumR += cleaned[nIdx];
                                    sumG += cleaned[nIdx + 1];
                                    sumB += cleaned[nIdx + 2];
                                    count++;
                                }
                            }
                            final[idx] = Math.round(sumR / count);
                            final[idx + 1] = Math.round(sumG / count);
                            final[idx + 2] = Math.round(sumB / count);
                        }
                    }
                }

                // Write the cleaned pixel data back
                const resultData = new ImageData(final, W, H);
                ctx.putImageData(resultData, 0, 0);

                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Failed to create result image'));
                }, 'image/png');
            };

            img.onerror = () => reject(new Error('Failed to load processed image'));
            img.src = url;
        });
    }

    // ===== Show Result =====
    function showResult() {
        showSection('result');

        // Original
        const origUrl = URL.createObjectURL(originalFile);
        document.getElementById('bgrOriginalImg').src = origUrl;

        // Result
        const resultUrl = URL.createObjectURL(resultBlob);
        document.getElementById('bgrResultImg').src = resultUrl;
    }

    // ===== Download =====
    function downloadResult() {
        if (!resultBlob || !originalFile) return;
        const baseName = originalFile.name.replace(/\.[^.]+$/, '');
        ToolUtils.downloadBlob(resultBlob, `${baseName}_white_bg.png`);
    }

    // ===== Reset =====
    function resetTool() {
        originalFile = null;
        resultBlob = null;
        isProcessing = false;
        showSection('upload');

        const fileInput = document.getElementById('bgrFileInput');
        if (fileInput) fileInput.value = '';
    }

    // ===== UI Helpers =====
    function showSection(section) {
        document.getElementById('bgrUploadSection').style.display = section === 'upload' ? 'block' : 'none';
        document.getElementById('bgrProcessingSection').style.display = section === 'processing' ? 'block' : 'none';
        document.getElementById('bgrResultSection').style.display = section === 'result' ? 'block' : 'none';
        document.getElementById('bgrInfoBanner').style.display = section === 'upload' ? 'flex' : 'none';
    }

    function updateStatus(title, subtitle, progress) {
        const titleEl = document.getElementById('bgrStatusTitle');
        const textEl = document.getElementById('bgrStatusText');
        const bar = document.getElementById('bgrProgressBar');
        if (titleEl) titleEl.textContent = title;
        if (textEl) textEl.textContent = subtitle;
        if (bar) bar.style.width = progress + '%';
    }

})();
