(function () {
    'use strict';

    let qrLib = null;   // QRCodeStyling
    let jsQR = null;     // jsQR scanner lib
    let qrInstance = null;
    let cameraStream = null;
    let scanAnimFrame = null;
    let currentMode = 'generate'; // 'generate' | 'scan'
    let currentType = 'url';
    let logoDataUrl = null;

    const QR_TYPES = [
        { id: 'url',       icon: '🔗', label: 'URL' },
        { id: 'text',      icon: '📝', label: 'Text' },
        { id: 'wifi',      icon: '📶', label: 'WiFi' },
        { id: 'upi',       icon: '₹',  label: 'UPI Pay' },
        { id: 'vcard',     icon: '👤', label: 'Contact' },
        { id: 'email',     icon: '✉️', label: 'Email' },
        { id: 'phone',     icon: '📞', label: 'Phone' },
        { id: 'whatsapp',  icon: '💬', label: 'WhatsApp' },
        { id: 'sms',       icon: '💬', label: 'SMS' },
    ];

    const DOT_STYLES = ['square', 'dots', 'rounded', 'extra-rounded', 'classy-rounded'];
    const CORNER_STYLES = ['square', 'dot', 'extra-rounded'];
    const ERROR_LEVELS = ['L', 'M', 'Q', 'H'];

    // ===== Register Tool =====
    ToolRegistry.register('qr-code', {
        title: 'QR Code Generator & Scanner',
        description: 'Generate beautiful QR codes for URLs, UPI, WiFi, contacts & more. Scan QR codes from camera or images.',
        category: 'Utility Tools',
        tags: ['qr code', 'qr generator', 'qr scanner', 'upi qr', 'wifi qr', 'vcard qr'],

        render() {
            return `
                <div id="qrRoot" class="qr-root">
                    <!-- Hero -->
                    <div class="qr-hero">
                        <h2>QR Code Generator & Scanner</h2>
                        <p>Create stunning QR codes for anything — or scan existing ones. 100% in your browser, completely free.</p>
                    </div>

                    <!-- Mode Tabs -->
                    <div class="qr-mode-tabs">
                        <button class="qr-mode-btn active" data-mode="generate">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><line x1="21" y1="14" x2="21" y2="17"/><line x1="14" y1="21" x2="17" y2="21"/></svg>
                            Generate
                        </button>
                        <button class="qr-mode-btn" data-mode="scan">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>
                            Scan
                        </button>
                    </div>

                    <!-- ===== GENERATE MODE ===== -->
                    <div class="qr-generate-panel" id="qrGeneratePanel">
                        <div class="qr-gen-layout">
                            <!-- Left: Input -->
                            <div class="qr-gen-left">
                                <!-- Type selector -->
                                <div class="qr-type-grid" id="qrTypeGrid">
                                    ${QR_TYPES.map(t => `
                                        <button class="qr-type-btn ${t.id === 'url' ? 'active' : ''}" data-type="${t.id}">
                                            <span class="qr-type-icon">${t.icon}</span>
                                            <span class="qr-type-label">${t.label}</span>
                                        </button>
                                    `).join('')}
                                </div>

                                <!-- Dynamic input forms -->
                                <div class="qr-input-area" id="qrInputArea">
                                    ${buildInputForm('url')}
                                </div>

                                <!-- Customization -->
                                <div class="qr-customize">
                                    <h4 class="qr-section-title">Customize</h4>
                                    <div class="qr-custom-grid">
                                        <div class="qr-custom-row">
                                            <label class="qr-label">Foreground</label>
                                            <div class="qr-color-wrap">
                                                <input type="color" id="qrFgColor" value="#000000" class="qr-color-input">
                                                <span class="qr-color-hex" id="qrFgHex">#000000</span>
                                            </div>
                                        </div>
                                        <div class="qr-custom-row">
                                            <label class="qr-label">Background</label>
                                            <div class="qr-color-wrap">
                                                <input type="color" id="qrBgColor" value="#FFFFFF" class="qr-color-input">
                                                <span class="qr-color-hex" id="qrBgHex">#FFFFFF</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="qr-custom-row" style="margin-top:12px;">
                                        <label class="qr-label">Dot Style</label>
                                        <div class="qr-style-options" id="qrDotStyle">
                                            ${DOT_STYLES.map((s, i) => `<button class="qr-style-btn ${i === 0 ? 'active' : ''}" data-value="${s}" title="${s}">${dotStylePreview(s)}</button>`).join('')}
                                        </div>
                                    </div>
                                    <div class="qr-custom-row" style="margin-top:10px;">
                                        <label class="qr-label">Corner Style</label>
                                        <div class="qr-style-options" id="qrCornerStyle">
                                            ${CORNER_STYLES.map((s, i) => `<button class="qr-style-btn ${i === 0 ? 'active' : ''}" data-value="${s}" title="${s}">${cornerStylePreview(s)}</button>`).join('')}
                                        </div>
                                    </div>
                                    <div class="qr-custom-row" style="margin-top:10px;">
                                        <label class="qr-label">Error Correction</label>
                                        <div class="qr-style-options" id="qrErrorLevel">
                                            ${ERROR_LEVELS.map((l, i) => `<button class="qr-style-btn ${i === 1 ? 'active' : ''}" data-value="${l}">${l}</button>`).join('')}
                                        </div>
                                    </div>
                                    <div class="qr-custom-row" style="margin-top:10px;">
                                        <label class="qr-label">Logo (optional)</label>
                                        <div class="qr-logo-area">
                                            <button class="qr-logo-btn" id="qrLogoBtn">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                                Upload Logo
                                            </button>
                                            <button class="qr-logo-clear" id="qrLogoClear" style="display:none;">✕ Remove</button>
                                            <input type="file" id="qrLogoInput" accept="image/*" style="display:none;">
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Right: Preview & Download -->
                            <div class="qr-gen-right">
                                <div class="qr-preview-card">
                                    <div class="qr-preview-area" id="qrPreviewArea">
                                        <div class="qr-placeholder-msg">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><circle cx="17.5" cy="17.5" r="3.5"/></svg>
                                            <p>Enter content to generate QR code</p>
                                        </div>
                                    </div>
                                    <div class="qr-download-row" id="qrDownloadRow" style="display:none;">
                                        <button class="qr-dl-btn qr-dl-png" id="qrDlPng">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                            PNG
                                        </button>
                                        <button class="qr-dl-btn qr-dl-svg" id="qrDlSvg">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                            SVG
                                        </button>
                                        <button class="qr-dl-btn qr-dl-copy" id="qrCopyBtn" title="Copy to clipboard">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                            Copy
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- ===== SCAN MODE ===== -->
                    <div class="qr-scan-panel" id="qrScanPanel" style="display:none;">
                        <div class="qr-scan-layout">
                            <div class="qr-scan-options">
                                <button class="qr-scan-method active" data-method="upload" id="qrScanUploadBtn">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                    Upload Image
                                </button>
                                <button class="qr-scan-method" data-method="camera" id="qrScanCameraBtn">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                                    Camera
                                </button>
                            </div>

                            <!-- Upload scan area -->
                            <div class="qr-scan-upload-area" id="qrScanUploadArea">
                                <div class="drop-zone" id="qrScanDropZone">
                                    <span class="drop-zone-icon">🔍</span>
                                    <h3 class="drop-zone-title">Drop an image with a QR code</h3>
                                    <p class="drop-zone-subtitle">We'll scan it and show you the content</p>
                                    <button class="drop-zone-btn" id="qrScanFileBtn">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                        Choose Image
                                    </button>
                                    <input type="file" id="qrScanFileInput" accept="image/*" style="display:none;">
                                    <p class="drop-zone-info">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                        JPG, PNG, or any image &bull; 100% private
                                    </p>
                                </div>
                            </div>

                            <!-- Camera scan area -->
                            <div class="qr-scan-camera-area" id="qrScanCameraArea" style="display:none;">
                                <div class="qr-camera-box">
                                    <video id="qrCameraVideo" autoplay playsinline muted></video>
                                    <canvas id="qrCameraCanvas" style="display:none;"></canvas>
                                    <div class="qr-camera-overlay">
                                        <div class="qr-scan-frame"></div>
                                    </div>
                                    <p class="qr-camera-hint">Point camera at a QR code</p>
                                </div>
                                <button class="qr-stop-camera-btn" id="qrStopCamera">Stop Camera</button>
                            </div>

                            <!-- Scan result -->
                            <div class="qr-scan-result" id="qrScanResult" style="display:none;">
                                <div class="qr-result-card">
                                    <div class="qr-result-icon">✅</div>
                                    <h3>QR Code Detected!</h3>
                                    <div class="qr-result-content" id="qrResultContent"></div>
                                    <div class="qr-result-actions">
                                        <button class="qr-result-btn qr-result-copy" id="qrResultCopy">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                            Copy
                                        </button>
                                        <a class="qr-result-btn qr-result-open" id="qrResultOpen" href="#" target="_blank" rel="noopener" style="display:none;">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                            Open Link
                                        </a>
                                        <button class="qr-result-btn" id="qrScanAnother">Scan Another</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Features info -->
                    <div class="qr-info-section">
                        <div class="qr-info-grid">
                            <div class="qr-info-card">
                                <span class="qr-info-icon">🔒</span>
                                <strong>100% Private</strong>
                                <p>Nothing leaves your browser. No servers, no uploads, no tracking.</p>
                            </div>
                            <div class="qr-info-card">
                                <span class="qr-info-icon">⚡</span>
                                <strong>Instant</strong>
                                <p>QR codes generate in real-time as you type. No waiting.</p>
                            </div>
                            <div class="qr-info-card">
                                <span class="qr-info-icon">🎨</span>
                                <strong>Customizable</strong>
                                <p>Colors, dot styles, corner styles, add your logo — make it yours.</p>
                            </div>
                            <div class="qr-info-card">
                                <span class="qr-info-icon">📱</span>
                                <strong>9 QR Types</strong>
                                <p>URL, Text, WiFi, UPI Pay, Contact, Email, Phone, WhatsApp, SMS.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        init() {
            initModeTabs();
            initTypeSelector();
            initInputListeners();
            initCustomization();
            initLogoUpload();
            initDownloads();
            initScanner();
        },

        destroy() {
            stopCamera();
            qrInstance = null;
            logoDataUrl = null;
            currentMode = 'generate';
            currentType = 'url';
        }
    });

    // ===== Input Form Builders =====
    function buildInputForm(type) {
        const forms = {
            url: `
                <div class="qr-field">
                    <label class="qr-label">Website URL</label>
                    <input type="url" class="qr-input" id="qrDataUrl" placeholder="https://example.com" autocomplete="off">
                </div>`,
            text: `
                <div class="qr-field">
                    <label class="qr-label">Text Content</label>
                    <textarea class="qr-textarea" id="qrDataText" placeholder="Enter any text..." rows="4"></textarea>
                </div>`,
            wifi: `
                <div class="qr-field">
                    <label class="qr-label">Network Name (SSID)</label>
                    <input type="text" class="qr-input" id="qrWifiSsid" placeholder="MyWiFi" autocomplete="off">
                </div>
                <div class="qr-field">
                    <label class="qr-label">Password</label>
                    <div class="qr-input-group">
                        <input type="password" class="qr-input" id="qrWifiPass" placeholder="Password" autocomplete="off">
                        <button class="qr-toggle-pass" id="qrWifiTogglePass" title="Show password">👁</button>
                    </div>
                </div>
                <div class="qr-field">
                    <label class="qr-label">Encryption</label>
                    <div class="qr-radio-group" id="qrWifiEnc">
                        <button class="qr-radio-btn active" data-value="WPA">WPA/WPA2</button>
                        <button class="qr-radio-btn" data-value="WEP">WEP</button>
                        <button class="qr-radio-btn" data-value="nopass">None</button>
                    </div>
                </div>
                <div class="qr-field">
                    <label class="qr-check-label">
                        <input type="checkbox" id="qrWifiHidden"> Hidden network
                    </label>
                </div>`,
            upi: `
                <div class="qr-field">
                    <label class="qr-label">UPI ID <span class="qr-required">*</span></label>
                    <input type="text" class="qr-input" id="qrUpiId" placeholder="name@upi or name@bank" autocomplete="off">
                </div>
                <div class="qr-field">
                    <label class="qr-label">Payee Name</label>
                    <input type="text" class="qr-input" id="qrUpiName" placeholder="John Doe" autocomplete="off">
                </div>
                <div class="qr-field-row">
                    <div class="qr-field">
                        <label class="qr-label">Amount (₹)</label>
                        <input type="number" class="qr-input" id="qrUpiAmount" placeholder="Optional" min="0" step="0.01">
                    </div>
                    <div class="qr-field">
                        <label class="qr-label">Note</label>
                        <input type="text" class="qr-input" id="qrUpiNote" placeholder="Optional" autocomplete="off">
                    </div>
                </div>
                <p class="qr-hint">💡 Works with Google Pay, PhonePe, Paytm, BHIM & all UPI apps</p>`,
            vcard: `
                <div class="qr-field-row">
                    <div class="qr-field">
                        <label class="qr-label">First Name <span class="qr-required">*</span></label>
                        <input type="text" class="qr-input" id="qrVcardFirst" placeholder="John" autocomplete="off">
                    </div>
                    <div class="qr-field">
                        <label class="qr-label">Last Name</label>
                        <input type="text" class="qr-input" id="qrVcardLast" placeholder="Doe" autocomplete="off">
                    </div>
                </div>
                <div class="qr-field">
                    <label class="qr-label">Phone</label>
                    <input type="tel" class="qr-input" id="qrVcardPhone" placeholder="+91 98765 43210" autocomplete="off">
                </div>
                <div class="qr-field">
                    <label class="qr-label">Email</label>
                    <input type="email" class="qr-input" id="qrVcardEmail" placeholder="john@example.com" autocomplete="off">
                </div>
                <div class="qr-field-row">
                    <div class="qr-field">
                        <label class="qr-label">Organization</label>
                        <input type="text" class="qr-input" id="qrVcardOrg" placeholder="Company" autocomplete="off">
                    </div>
                    <div class="qr-field">
                        <label class="qr-label">Title</label>
                        <input type="text" class="qr-input" id="qrVcardTitle" placeholder="Job title" autocomplete="off">
                    </div>
                </div>
                <div class="qr-field">
                    <label class="qr-label">Website</label>
                    <input type="url" class="qr-input" id="qrVcardUrl" placeholder="https://..." autocomplete="off">
                </div>`,
            email: `
                <div class="qr-field">
                    <label class="qr-label">Email Address <span class="qr-required">*</span></label>
                    <input type="email" class="qr-input" id="qrEmailAddr" placeholder="hello@example.com" autocomplete="off">
                </div>
                <div class="qr-field">
                    <label class="qr-label">Subject</label>
                    <input type="text" class="qr-input" id="qrEmailSubject" placeholder="Optional" autocomplete="off">
                </div>
                <div class="qr-field">
                    <label class="qr-label">Body</label>
                    <textarea class="qr-textarea" id="qrEmailBody" placeholder="Optional message..." rows="3"></textarea>
                </div>`,
            phone: `
                <div class="qr-field">
                    <label class="qr-label">Phone Number</label>
                    <input type="tel" class="qr-input" id="qrPhoneNum" placeholder="+91 98765 43210" autocomplete="off">
                </div>`,
            whatsapp: `
                <div class="qr-field">
                    <label class="qr-label">Phone Number (with country code)</label>
                    <input type="tel" class="qr-input" id="qrWaPhone" placeholder="919876543210" autocomplete="off">
                    <span class="qr-hint-sm">No + or spaces. E.g. 919876543210 for India</span>
                </div>
                <div class="qr-field">
                    <label class="qr-label">Pre-filled Message</label>
                    <textarea class="qr-textarea" id="qrWaMsg" placeholder="Hello! I'd like to..." rows="3"></textarea>
                </div>`,
            sms: `
                <div class="qr-field">
                    <label class="qr-label">Phone Number</label>
                    <input type="tel" class="qr-input" id="qrSmsPhone" placeholder="+919876543210" autocomplete="off">
                </div>
                <div class="qr-field">
                    <label class="qr-label">Message</label>
                    <textarea class="qr-textarea" id="qrSmsMsg" placeholder="Optional message..." rows="3"></textarea>
                </div>`,
        };
        return forms[type] || '';
    }

    // ===== Data Builders =====
    function buildQRData() {
        switch (currentType) {
            case 'url':
                return (document.getElementById('qrDataUrl')?.value || '').trim();
            case 'text':
                return (document.getElementById('qrDataText')?.value || '').trim();
            case 'wifi': {
                const ssid = (document.getElementById('qrWifiSsid')?.value || '').trim();
                const pass = (document.getElementById('qrWifiPass')?.value || '').trim();
                const enc = document.querySelector('#qrWifiEnc .qr-radio-btn.active')?.dataset.value || 'WPA';
                const hidden = document.getElementById('qrWifiHidden')?.checked ? 'true' : 'false';
                if (!ssid) return '';
                return `WIFI:T:${enc};S:${escWifi(ssid)};P:${escWifi(pass)};H:${hidden};;`;
            }
            case 'upi': {
                const pa = (document.getElementById('qrUpiId')?.value || '').trim();
                if (!pa) return '';
                let url = `upi://pay?pa=${encodeURIComponent(pa)}&cu=INR`;
                const pn = (document.getElementById('qrUpiName')?.value || '').trim();
                const am = (document.getElementById('qrUpiAmount')?.value || '').trim();
                const tn = (document.getElementById('qrUpiNote')?.value || '').trim();
                if (pn) url += `&pn=${encodeURIComponent(pn)}`;
                if (am && parseFloat(am) > 0) url += `&am=${parseFloat(am).toFixed(2)}`;
                if (tn) url += `&tn=${encodeURIComponent(tn)}`;
                return url;
            }
            case 'vcard': {
                const first = (document.getElementById('qrVcardFirst')?.value || '').trim();
                if (!first) return '';
                const last = (document.getElementById('qrVcardLast')?.value || '').trim();
                const phone = (document.getElementById('qrVcardPhone')?.value || '').trim();
                const email = (document.getElementById('qrVcardEmail')?.value || '').trim();
                const org = (document.getElementById('qrVcardOrg')?.value || '').trim();
                const title = (document.getElementById('qrVcardTitle')?.value || '').trim();
                const url = (document.getElementById('qrVcardUrl')?.value || '').trim();
                let card = `BEGIN:VCARD\nVERSION:3.0\nN:${last};${first};;;\nFN:${first}${last ? ' ' + last : ''}`;
                if (phone) card += `\nTEL;TYPE=CELL:${phone}`;
                if (email) card += `\nEMAIL:${email}`;
                if (org) card += `\nORG:${org}`;
                if (title) card += `\nTITLE:${title}`;
                if (url) card += `\nURL:${url}`;
                card += `\nEND:VCARD`;
                return card;
            }
            case 'email': {
                const addr = (document.getElementById('qrEmailAddr')?.value || '').trim();
                if (!addr) return '';
                let mailto = `mailto:${addr}`;
                const subj = (document.getElementById('qrEmailSubject')?.value || '').trim();
                const body = (document.getElementById('qrEmailBody')?.value || '').trim();
                const params = [];
                if (subj) params.push(`subject=${encodeURIComponent(subj)}`);
                if (body) params.push(`body=${encodeURIComponent(body)}`);
                if (params.length) mailto += '?' + params.join('&');
                return mailto;
            }
            case 'phone': {
                const num = (document.getElementById('qrPhoneNum')?.value || '').trim();
                return num ? `tel:${num}` : '';
            }
            case 'whatsapp': {
                const phone = (document.getElementById('qrWaPhone')?.value || '').trim();
                if (!phone) return '';
                const msg = (document.getElementById('qrWaMsg')?.value || '').trim();
                let url = `https://wa.me/${phone.replace(/[^0-9]/g, '')}`;
                if (msg) url += `?text=${encodeURIComponent(msg)}`;
                return url;
            }
            case 'sms': {
                const phone = (document.getElementById('qrSmsPhone')?.value || '').trim();
                if (!phone) return '';
                const msg = (document.getElementById('qrSmsMsg')?.value || '').trim();
                return msg ? `sms:${phone}?body=${encodeURIComponent(msg)}` : `sms:${phone}`;
            }
            default: return '';
        }
    }

    function escWifi(str) {
        return str.replace(/[\\;,:""]/g, '\\$&');
    }

    // ===== Style Preview Helpers =====
    function dotStylePreview(style) {
        const map = { 'square': '■', 'dots': '●', 'rounded': '◼', 'extra-rounded': '◉', 'classy-rounded': '◆' };
        return map[style] || '■';
    }
    function cornerStylePreview(style) {
        const map = { 'square': '▣', 'dot': '◎', 'extra-rounded': '◙' };
        return map[style] || '▣';
    }

    // ===== Load Libraries =====
    async function ensureLibs(need = {}) {
        if (need.qr && !qrLib) {
            await loadScript('https://cdn.jsdelivr.net/npm/qr-code-styling@1.6.0-rc.1/lib/qr-code-styling.js');
            qrLib = window.QRCodeStyling;
        }
        if (need.scanner && !jsQR) {
            await loadScript('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js');
            jsQR = window.jsQR;
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

    // ===== Initialize Functions =====
    function initModeTabs() {
        document.querySelectorAll('.qr-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.qr-mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentMode = btn.dataset.mode;
                document.getElementById('qrGeneratePanel').style.display = currentMode === 'generate' ? 'block' : 'none';
                document.getElementById('qrScanPanel').style.display = currentMode === 'scan' ? 'block' : 'none';
                if (currentMode === 'generate') stopCamera();
            });
        });
    }

    function initTypeSelector() {
        document.getElementById('qrTypeGrid')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.qr-type-btn');
            if (!btn) return;
            document.querySelectorAll('.qr-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentType = btn.dataset.type;
            const area = document.getElementById('qrInputArea');
            if (area) area.innerHTML = buildInputForm(currentType);
            initInputListeners();
            // Reset QR preview
            showQRPlaceholder();

            // Re-init wifi-specific listeners
            if (currentType === 'wifi') initWifiExtras();
        });
    }

    function initWifiExtras() {
        const toggle = document.getElementById('qrWifiTogglePass');
        const passInput = document.getElementById('qrWifiPass');
        if (toggle && passInput) {
            toggle.addEventListener('click', () => {
                passInput.type = passInput.type === 'password' ? 'text' : 'password';
                toggle.textContent = passInput.type === 'password' ? '👁' : '🙈';
            });
        }
        document.getElementById('qrWifiEnc')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.qr-radio-btn');
            if (!btn) return;
            document.querySelectorAll('#qrWifiEnc .qr-radio-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            debounceGenerate();
        });
        document.getElementById('qrWifiHidden')?.addEventListener('change', debounceGenerate);
    }

    let generateTimeout = null;
    function debounceGenerate() {
        clearTimeout(generateTimeout);
        generateTimeout = setTimeout(() => generateQR(), 300);
    }

    function initInputListeners() {
        // Attach input/change listeners to all fields in qrInputArea
        document.querySelectorAll('#qrInputArea input, #qrInputArea textarea').forEach(el => {
            el.addEventListener('input', debounceGenerate);
        });
        // WiFi extras
        if (currentType === 'wifi') initWifiExtras();
    }

    function initCustomization() {
        // Color pickers
        const fgColor = document.getElementById('qrFgColor');
        const bgColor = document.getElementById('qrBgColor');
        const fgHex = document.getElementById('qrFgHex');
        const bgHex = document.getElementById('qrBgHex');

        fgColor?.addEventListener('input', () => { fgHex.textContent = fgColor.value.toUpperCase(); debounceGenerate(); });
        bgColor?.addEventListener('input', () => { bgHex.textContent = bgColor.value.toUpperCase(); debounceGenerate(); });

        // Dot style
        document.getElementById('qrDotStyle')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.qr-style-btn');
            if (!btn) return;
            document.querySelectorAll('#qrDotStyle .qr-style-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            debounceGenerate();
        });

        // Corner style
        document.getElementById('qrCornerStyle')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.qr-style-btn');
            if (!btn) return;
            document.querySelectorAll('#qrCornerStyle .qr-style-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            debounceGenerate();
        });

        // Error level
        document.getElementById('qrErrorLevel')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.qr-style-btn');
            if (!btn) return;
            document.querySelectorAll('#qrErrorLevel .qr-style-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            debounceGenerate();
        });
    }

    function initLogoUpload() {
        const btn = document.getElementById('qrLogoBtn');
        const input = document.getElementById('qrLogoInput');
        const clear = document.getElementById('qrLogoClear');

        btn?.addEventListener('click', () => input?.click());
        input?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                logoDataUrl = ev.target.result;
                btn.innerHTML = '✅ Logo loaded';
                clear.style.display = 'inline-flex';
                debounceGenerate();
            };
            reader.readAsDataURL(file);
        });
        clear?.addEventListener('click', () => {
            logoDataUrl = null;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Upload Logo`;
            clear.style.display = 'none';
            if (input) input.value = '';
            debounceGenerate();
        });
    }

    function initDownloads() {
        document.getElementById('qrDlPng')?.addEventListener('click', () => downloadQR('png'));
        document.getElementById('qrDlSvg')?.addEventListener('click', () => downloadQR('svg'));
        document.getElementById('qrCopyBtn')?.addEventListener('click', copyQRToClipboard);
    }

    // ===== Generate QR Code =====
    async function generateQR() {
        const data = buildQRData();
        const preview = document.getElementById('qrPreviewArea');
        const dlRow = document.getElementById('qrDownloadRow');

        if (!data) {
            showQRPlaceholder();
            return;
        }

        try {
            await ensureLibs({ qr: true });

            const fgColor = document.getElementById('qrFgColor')?.value || '#000000';
            const bgColor = document.getElementById('qrBgColor')?.value || '#FFFFFF';
            const dotStyle = document.querySelector('#qrDotStyle .qr-style-btn.active')?.dataset.value || 'square';
            const cornerStyle = document.querySelector('#qrCornerStyle .qr-style-btn.active')?.dataset.value || 'square';
            const errorLevel = document.querySelector('#qrErrorLevel .qr-style-btn.active')?.dataset.value || 'M';

            const options = {
                width: 300,
                height: 300,
                data: data,
                dotsOptions: { color: fgColor, type: dotStyle },
                backgroundOptions: { color: bgColor },
                cornersSquareOptions: { type: cornerStyle, color: fgColor },
                cornersDotOptions: { type: cornerStyle === 'extra-rounded' ? 'dot' : undefined, color: fgColor },
                qrOptions: { errorCorrectionLevel: errorLevel },
            };

            if (logoDataUrl) {
                options.image = logoDataUrl;
                options.imageOptions = { crossOrigin: 'anonymous', margin: 6, imageSize: 0.35 };
            }

            if (qrInstance) {
                qrInstance.update(options);
            } else {
                qrInstance = new qrLib(options);
            }

            preview.innerHTML = '';
            qrInstance.append(preview);
            dlRow.style.display = 'flex';
        } catch (err) {
            console.error('QR generation error:', err);
            preview.innerHTML = '<p class="qr-error">Error generating QR code. Try different content.</p>';
        }
    }

    function showQRPlaceholder() {
        const preview = document.getElementById('qrPreviewArea');
        const dlRow = document.getElementById('qrDownloadRow');
        if (preview) preview.innerHTML = `
            <div class="qr-placeholder-msg">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><circle cx="17.5" cy="17.5" r="3.5"/></svg>
                <p>Enter content to generate QR code</p>
            </div>`;
        if (dlRow) dlRow.style.display = 'none';
        qrInstance = null;
    }

    async function downloadQR(format) {
        if (!qrInstance) return;
        try {
            const ext = format === 'svg' ? 'svg' : 'png';
            const name = `qr-${currentType}-${Date.now()}.${ext}`;
            await qrInstance.download({ name: name.replace(`.${ext}`, ''), extension: ext });
        } catch (err) {
            console.error('Download error:', err);
        }
    }

    async function copyQRToClipboard() {
        if (!qrInstance) return;
        try {
            const blob = await qrInstance.getRawData('png');
            if (blob && navigator.clipboard && window.ClipboardItem) {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                const btn = document.getElementById('qrCopyBtn');
                if (btn) {
                    const orig = btn.innerHTML;
                    btn.innerHTML = '✅ Copied!';
                    setTimeout(() => { btn.innerHTML = orig; }, 1500);
                }
            }
        } catch (err) {
            console.error('Copy error:', err);
        }
    }

    // ===== Scanner =====
    function initScanner() {
        // Method toggle
        document.querySelectorAll('.qr-scan-method').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.qr-scan-method').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const method = btn.dataset.method;
                document.getElementById('qrScanUploadArea').style.display = method === 'upload' ? 'block' : 'none';
                document.getElementById('qrScanCameraArea').style.display = method === 'camera' ? 'block' : 'none';
                document.getElementById('qrScanResult').style.display = 'none';
                if (method === 'camera') startCamera();
                else stopCamera();
            });
        });

        // File upload
        const fileBtn = document.getElementById('qrScanFileBtn');
        const fileInput = document.getElementById('qrScanFileInput');
        fileBtn?.addEventListener('click', () => fileInput?.click());
        fileInput?.addEventListener('change', (e) => {
            if (e.target.files[0]) scanFromImage(e.target.files[0]);
        });

        // Drop zone
        const dropZone = document.getElementById('qrScanDropZone');
        if (dropZone) {
            ['dragenter', 'dragover'].forEach(evt => {
                dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
            });
            ['dragleave', 'drop'].forEach(evt => {
                dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
            });
            dropZone.addEventListener('drop', (e) => {
                const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
                if (file) scanFromImage(file);
            });
        }

        // Stop camera
        document.getElementById('qrStopCamera')?.addEventListener('click', () => {
            stopCamera();
            document.getElementById('qrScanCameraArea').style.display = 'none';
            document.getElementById('qrScanUploadArea').style.display = 'block';
            document.querySelectorAll('.qr-scan-method').forEach(b => b.classList.remove('active'));
            document.getElementById('qrScanUploadBtn')?.classList.add('active');
        });

        // Result actions
        document.getElementById('qrResultCopy')?.addEventListener('click', () => {
            const text = document.getElementById('qrResultContent')?.textContent || '';
            navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById('qrResultCopy');
                if (btn) { const orig = btn.innerHTML; btn.textContent = '✅ Copied!'; setTimeout(() => { btn.innerHTML = orig; }, 1500); }
            });
        });

        document.getElementById('qrScanAnother')?.addEventListener('click', () => {
            document.getElementById('qrScanResult').style.display = 'none';
            const activeMethod = document.querySelector('.qr-scan-method.active')?.dataset.method || 'upload';
            if (activeMethod === 'upload') {
                document.getElementById('qrScanUploadArea').style.display = 'block';
            } else {
                document.getElementById('qrScanCameraArea').style.display = 'block';
                startCamera();
            }
        });
    }

    async function scanFromImage(file) {
        try {
            await ensureLibs({ scanner: true });
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                URL.revokeObjectURL(url);
                if (code) {
                    showScanResult(code.data);
                } else {
                    alert('No QR code found in this image. Try a clearer image.');
                }
            };
            img.src = url;
        } catch (err) {
            console.error('Scan error:', err);
            alert('Could not scan image.');
        }
    }

    async function startCamera() {
        try {
            await ensureLibs({ scanner: true });
            const video = document.getElementById('qrCameraVideo');
            if (!video) return;

            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
            });
            video.srcObject = cameraStream;
            video.play();

            const canvas = document.getElementById('qrCameraCanvas');
            const ctx = canvas.getContext('2d');

            function scanFrame() {
                if (!cameraStream || video.readyState !== video.HAVE_ENOUGH_DATA) {
                    scanAnimFrame = requestAnimationFrame(scanFrame);
                    return;
                }
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
                if (code) {
                    stopCamera();
                    document.getElementById('qrScanCameraArea').style.display = 'none';
                    showScanResult(code.data);
                } else {
                    scanAnimFrame = requestAnimationFrame(scanFrame);
                }
            }
            scanAnimFrame = requestAnimationFrame(scanFrame);
        } catch (err) {
            console.error('Camera error:', err);
            alert('Could not access camera. Please check permissions or try the upload method.');
            document.getElementById('qrScanCameraArea').style.display = 'none';
            document.getElementById('qrScanUploadArea').style.display = 'block';
            document.querySelectorAll('.qr-scan-method').forEach(b => b.classList.remove('active'));
            document.getElementById('qrScanUploadBtn')?.classList.add('active');
        }
    }

    function stopCamera() {
        if (scanAnimFrame) { cancelAnimationFrame(scanAnimFrame); scanAnimFrame = null; }
        if (cameraStream) {
            cameraStream.getTracks().forEach(t => t.stop());
            cameraStream = null;
        }
        const video = document.getElementById('qrCameraVideo');
        if (video) video.srcObject = null;
    }

    function showScanResult(data) {
        const resultEl = document.getElementById('qrScanResult');
        const contentEl = document.getElementById('qrResultContent');
        const openBtn = document.getElementById('qrResultOpen');

        if (contentEl) contentEl.textContent = data;
        if (resultEl) resultEl.style.display = 'block';

        // If it looks like a URL, show the "Open Link" button
        const isUrl = /^https?:\/\//i.test(data) || /^upi:\/\//i.test(data);
        if (openBtn) {
            if (isUrl) {
                openBtn.style.display = 'inline-flex';
                openBtn.href = data;
            } else {
                openBtn.style.display = 'none';
            }
        }

        // Hide upload/camera areas
        document.getElementById('qrScanUploadArea').style.display = 'none';
        document.getElementById('qrScanCameraArea').style.display = 'none';
    }

})();
