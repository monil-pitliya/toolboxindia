/* =============================================
   Free Toolbox — Cross-Tool Chaining
   
   After a tool produces output (PDF, image, etc.),
   show quick-action buttons to feed that output
   directly into another compatible tool — no
   download-then-re-upload needed.
   ============================================= */

window.ToolChain = (() => {
    'use strict';

    // ── Format → Compatible Tools Map ──
    const COMPAT = {
        pdf: [
            { id: 'pdf-toolkit',   icon: '📎', label: 'Merge PDFs',     feature: 'merge' },
            { id: 'pdf-toolkit',   icon: '✂️',  label: 'Split PDF',     feature: 'split' },
            { id: 'pdf-toolkit',   icon: '🗜️',  label: 'Compress PDF',  feature: 'compress' },
            { id: 'pdf-toolkit',   icon: '🔄', label: 'Rotate Pages',  feature: 'rotate' },
            { id: 'pdf-toolkit',   icon: '🔢', label: 'Add Page Nos.', feature: 'pagenums' },
            { id: 'pdf-toolkit',   icon: '💧', label: 'Watermark',     feature: 'watermark' },
            { id: 'pdf-toolkit',   icon: '🔒', label: 'Protect PDF',   feature: 'protect' },
            { id: 'pdf-toolkit',   icon: '🖼️',  label: 'PDF → Images',  feature: 'pdf2img' },
            { id: 'pdf-toolkit',   icon: '📝', label: 'PDF → Word',    feature: 'pdf2word' },
            { id: 'pdf-editor',    icon: '✏️',  label: 'Edit PDF' },
            { id: 'pdf-toolkit',   icon: '🎪', label: 'PDF Playground',feature: 'playground' },
        ],
        image: [
            { id: 'image-compressor',  icon: '🗜️',  label: 'Compress' },
            { id: 'image-resizer',     icon: '📐', label: 'Resize' },
            { id: 'background-remover',icon: '🖼️',  label: 'Remove BG' },
            { id: 'image-to-pdf',      icon: '📄', label: 'Image → PDF' },
        ],
        docx: [
            { id: 'word-to-pdf', icon: '📄', label: 'Convert to PDF' },
        ],
    };

    // ── Tool display names for the back button ──
    const TOOL_NAMES = {
        'pdf-toolkit':       'PDF Toolkit',
        'pdf-editor':        'PDF Editor',
        'image-compressor':  'Image Compressor',
        'image-resizer':     'Image Resizer',
        'background-remover':'Background Remover',
        'word-to-pdf':       'Word to PDF',
        'ppt-to-pdf':        'PPT to PDF',
        'image-to-pdf':      'Image to PDF',
        'qr-code':           'QR Code Generator',
    };

    // ── Pending chained file ──
    // { blob, name, feature, sourceToolId }
    let _pending = null;

    // ── Back navigation stack ──
    // { blob, name, sourceToolId, sourceFeature }
    let _backInfo = null;

    function setPending(blob, fileName, feature, sourceToolId) {
        _pending = { blob, name: fileName, feature: feature || null, sourceToolId: sourceToolId || null };
    }

    function consumePending() {
        const p = _pending;
        _pending = null;
        return p;
    }

    function hasPending() {
        return !!_pending;
    }

    /**
     * Get back info (for rendering back banner).
     */
    function getBackInfo() {
        return _backInfo;
    }

    /**
     * Clear back info (when user starts a fresh workflow).
     */
    function clearBackInfo() {
        _backInfo = null;
    }

    function detectType(blob, fileName) {
        const mime = (blob && blob.type) || '';
        const ext = (fileName || '').split('.').pop().toLowerCase();
        if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
        if (mime.startsWith('image/') || ['jpg','jpeg','png','webp','gif','bmp','svg'].includes(ext)) return 'image';
        if (mime.includes('wordprocessingml') || ext === 'docx') return 'docx';
        return null;
    }

    function renderActions(outputType, excludeToolId, excludeFeature) {
        const tools = COMPAT[outputType];
        if (!tools || !tools.length) return '';

        const buttons = tools
            .filter(t => {
                if (t.id === excludeToolId && !t.feature) return false;
                if (t.id === excludeToolId && t.feature === excludeFeature) return false;
                return true;
            })
            .map(t => {
                const dataFeature = t.feature ? `data-feature="${t.feature}"` : '';
                return `<button class="tc-action-btn" data-tool="${t.id}" ${dataFeature}>
                    <span class="tc-action-icon">${t.icon}</span>
                    <span class="tc-action-label">${t.label}</span>
                </button>`;
            })
            .join('');

        if (!buttons) return '';

        return `
            <div class="tc-chain-bar">
                <div class="tc-chain-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                    <span>Use this file in another tool</span>
                </div>
                <div class="tc-chain-actions">${buttons}</div>
            </div>`;
    }

    function bindActions(container, blob, fileName, sourceToolId, sourceFeature) {
        if (!container) return;
        container.querySelectorAll('.tc-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const toolId = btn.dataset.tool;
                const feature = btn.dataset.feature || null;

                // Save back-navigation info so the target tool can show a "Back" button
                _backInfo = {
                    blob: blob,
                    name: fileName,
                    sourceToolId: sourceToolId || null,
                    sourceFeature: sourceFeature || null,
                };

                // Store the blob for the target tool to pick up
                setPending(blob, fileName, feature, sourceToolId);

                // Navigate to the tool
                if (typeof openTool === 'function') {
                    openTool(toolId);
                } else if (typeof Router !== 'undefined' && Router.showTool) {
                    Router.showTool(toolId);
                }
            });
        });
    }

    /**
     * Render a "← Back to [source tool]" banner.
     * Returns HTML string or '' if no back info.
     */
    function renderBackBanner() {
        if (!_backInfo || !_backInfo.sourceToolId) return '';
        const toolName = TOOL_NAMES[_backInfo.sourceToolId] || _backInfo.sourceToolId;
        return `
            <div class="tc-back-banner" id="tcBackBanner">
                <button class="tc-back-btn" id="tcBackBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    <span>Back to <strong>${toolName}</strong></span>
                </button>
                <span class="tc-back-file">📄 ${_backInfo.name || 'file'}</span>
            </div>`;
    }

    /**
     * Inject back banner into a container and bind its click handler.
     * The back button re-sends the SAME file to the source tool.
     */
    function injectBackBanner(container) {
        if (!container || !_backInfo || !_backInfo.sourceToolId) return;

        const html = renderBackBanner();
        if (!html) return;

        // Remove any existing banner
        const existing = container.querySelector('.tc-back-banner');
        if (existing) existing.remove();

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        container.prepend(wrapper.firstElementChild);

        const backBtn = container.querySelector('#tcBackBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                const info = _backInfo;
                if (!info) return;

                // Set pending file for the source tool
                setPending(info.blob, info.name, info.sourceFeature, null);
                // Clear back info so we don't get infinite back loops
                _backInfo = null;

                if (typeof openTool === 'function') {
                    openTool(info.sourceToolId);
                } else if (typeof Router !== 'undefined' && Router.showTool) {
                    Router.showTool(info.sourceToolId);
                }
            });
        }
    }

    function inject(container, blob, fileName, excludeToolId, excludeFeature) {
        if (!container || !blob) return;

        const outputType = detectType(blob, fileName);
        if (!outputType) return;

        const html = renderActions(outputType, excludeToolId, excludeFeature);
        if (!html) return;

        const existing = container.querySelector('.tc-chain-bar');
        if (existing) existing.remove();

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        container.appendChild(wrapper.firstElementChild);

        bindActions(container, blob, fileName, excludeToolId, excludeFeature);
    }

    function blobToFile(blob, fileName) {
        return new File([blob], fileName, { type: blob.type, lastModified: Date.now() });
    }

    return {
        setPending,
        consumePending,
        hasPending,
        getBackInfo,
        clearBackInfo,
        detectType,
        renderActions,
        bindActions,
        inject,
        injectBackBanner,
        renderBackBanner,
        blobToFile,
        COMPAT,
        TOOL_NAMES,
    };
})();
