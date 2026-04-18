/* =============================================
   ToolBox India — Core Application Logic
   Handles routing, theme, search, and tool registration
   ============================================= */

// ===== Tool Registry (Extensible Architecture) =====
const ToolRegistry = {
    tools: {},

    register(id, config) {
        this.tools[id] = {
            id,
            title: config.title,
            description: config.description,
            category: config.category,
            tags: config.tags || [],
            render: config.render,     // Function that returns HTML
            init: config.init,         // Function called after render
            destroy: config.destroy,   // Cleanup function
        };
        console.log(`[ToolBox] Registered tool: ${id}`);
    },

    get(id) {
        return this.tools[id];
    },

    getAll() {
        return Object.values(this.tools);
    },

    search(query) {
        const q = query.toLowerCase();
        return this.getAll().filter(tool =>
            tool.title.toLowerCase().includes(q) ||
            tool.description.toLowerCase().includes(q) ||
            tool.tags.some(tag => tag.toLowerCase().includes(q)) ||
            tool.category.toLowerCase().includes(q)
        );
    }
};

// Make globally available
window.ToolRegistry = ToolRegistry;

// ===== Theme Manager =====
const ThemeManager = {
    init() {
        const saved = localStorage.getItem('toolbox-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || 'dark';
        this.set(theme);

        document.getElementById('themeToggle').addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            this.set(current === 'dark' ? 'light' : 'dark');
        });
    },

    set(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('toolbox-theme', theme);
    }
};

// ===== View Router =====
const Router = {
    currentTool: null,

    showHome() {
        document.getElementById('homeView').classList.add('active');
        document.getElementById('toolView').classList.remove('active');

        // Cleanup current tool
        if (this.currentTool) {
            const tool = ToolRegistry.get(this.currentTool);
            if (tool && tool.destroy) tool.destroy();
            this.currentTool = null;
        }

        // Update URL
        history.pushState(null, '', 'index.html');
        document.title = 'ToolBox India — Free Online Tools | 100% Private';

        // Restore homepage SEO
        ToolSEO.restore();
    },

    showTool(toolId) {
        const tool = ToolRegistry.get(toolId);
        if (!tool) {
            console.error(`Tool not found: ${toolId}`);
            return;
        }

        // Switch views
        document.getElementById('homeView').classList.remove('active');
        document.getElementById('toolView').classList.add('active');

        // Set title
        document.getElementById('toolViewTitle').textContent = tool.title;
        document.title = `${tool.title} — ToolBox India`;

        // Apply tool-specific SEO (meta, OG, canonical, JSON-LD)
        ToolSEO.apply(toolId);

        // Render tool content
        const container = document.getElementById('toolContent');
        container.innerHTML = tool.render();

        // Initialize tool logic
        if (tool.init) {
            setTimeout(() => tool.init(), 50);
        }

        this.currentTool = toolId;

        // Update URL
        history.pushState({ tool: toolId }, '', `?tool=${toolId}`);

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// Global functions
function openTool(toolId) {
    Router.showTool(toolId);
}

function goHome() {
    Router.showHome();
}

// ===== Search =====
const SearchManager = {
    init() {
        const input = document.getElementById('toolSearch');
        if (!input) return;

        input.addEventListener('input', (e) => {
            this.filter(e.target.value);
        });

        // Ctrl+K shortcut
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                input.focus();
                input.select();
            }
            if (e.key === 'Escape') {
                input.value = '';
                this.filter('');
                input.blur();
            }
        });
    },

    filter(query) {
        const cards = document.querySelectorAll('.tool-card');
        const categories = document.querySelectorAll('.category');
        const q = query.toLowerCase().trim();

        if (!q) {
            cards.forEach(card => card.style.display = '');
            categories.forEach(cat => cat.style.display = '');
            return;
        }

        cards.forEach(card => {
            const title = card.querySelector('.tool-card-title')?.textContent.toLowerCase() || '';
            const desc = card.querySelector('.tool-card-desc')?.textContent.toLowerCase() || '';
            const tags = Array.from(card.querySelectorAll('.tag')).map(t => t.textContent.toLowerCase());
            const match = title.includes(q) || desc.includes(q) || tags.some(t => t.includes(q));
            card.style.display = match ? '' : 'none';
        });

        // Hide empty categories
        categories.forEach(cat => {
            const visibleCards = cat.querySelectorAll('.tool-card:not([style*="display: none"])');
            cat.style.display = visibleCards.length ? '' : 'none';
        });
    }
};

// ===== Mobile Menu =====
const MobileMenu = {
    init() {
        const btn = document.getElementById('mobileMenuBtn');
        const nav = document.getElementById('mainNav');
        if (!btn || !nav) return;

        btn.addEventListener('click', () => {
            nav.classList.toggle('mobile-open');
            btn.classList.toggle('active');
        });
    }
};

// ===== Nav Active Highlighter =====
const NavHighlighter = {
    init() {
        const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
        if (!navLinks.length) return;

        // Click handler — smooth scroll + immediate highlight
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').slice(1);
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });

        // Scroll-based highlighting via IntersectionObserver
        const sections = [];
        navLinks.forEach(link => {
            const id = link.getAttribute('href').slice(1);
            const el = document.getElementById(id);
            if (el) sections.push({ el, link });
        });

        if (!sections.length) return;

        const observer = new IntersectionObserver((entries) => {
            // Find the section that is most visible
            let bestEntry = null;
            let bestRatio = 0;
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
                    bestRatio = entry.intersectionRatio;
                    bestEntry = entry;
                }
            });

            if (bestEntry) {
                const id = bestEntry.target.id;
                navLinks.forEach(l => l.classList.remove('active'));
                const match = sections.find(s => s.el.id === id);
                if (match) match.link.classList.add('active');
            }
        }, {
            rootMargin: '-80px 0px -40% 0px',
            threshold: [0, 0.1, 0.25, 0.5]
        });

        sections.forEach(s => observer.observe(s.el));

        // Also handle scroll to top — when near top, highlight "All Tools"
        window.addEventListener('scroll', () => {
            if (window.scrollY < 200) {
                navLinks.forEach(l => l.classList.remove('active'));
                const allToolsLink = document.querySelector('.nav-link[href="#tools"]');
                if (allToolsLink) allToolsLink.classList.add('active');
            }
        }, { passive: true });
    }
};

// ===== Tool SEO (Dynamic Meta Tags per Tool) =====
const ToolSEO = {
    BASE_URL: 'https://toolboxindia.com',

    // Homepage SEO (stored for restoration)
    homeSEO: {
        title: 'ToolBox India 🇮🇳 — Free Online Tools | 100% Private',
        description: 'Free online tools that run 100% in your browser. Compress images, merge PDFs, generate QR codes and more. Your files never leave your device.',
        canonical: 'https://toolboxindia.com/',
        ogTitle: 'ToolBox India — Free Online Tools | 100% Private, No Upload',
        ogDescription: 'Free online tools that run 100% in your browser. Compress images, remove backgrounds, merge PDFs, generate QR codes. Your files NEVER leave your device.',
    },

    // Per-tool SEO data — each key matches the tool ID
    toolData: {
        'image-compressor': {
            title: 'Image Compressor — Reduce Image Size Up to 90% | Free Online | ToolBox India',
            description: 'Compress JPG, PNG, WebP images up to 90% smaller without losing quality. 100% in your browser, no upload, no signup. Batch compress multiple images instantly — free forever.',
            keywords: 'image compressor, compress image online, reduce image size, jpg compressor, png compressor, image size reducer, compress photo online free, bulk image compressor',
            ogTitle: 'Free Image Compressor — Reduce Image Size Up to 90%',
            ogDescription: 'Compress JPG, PNG, WebP images instantly. No upload, no signup, 100% private. Reduce file size up to 90% without quality loss.',
            schemaType: 'WebApplication',
            schemaName: 'Image Compressor — ToolBox India',
            faq: [
                { q: 'How much can I compress my images?', a: 'ToolBox India\'s Image Compressor can reduce file sizes by up to 90% while maintaining visual quality. You can adjust the compression level to find the perfect balance between size and quality.' },
                { q: 'Is my image uploaded to any server?', a: 'No! Everything runs 100% in your browser using JavaScript. Your images never leave your device. There are no servers, no uploads, no tracking.' },
                { q: 'Can I compress multiple images at once?', a: 'Yes! You can drag and drop or select multiple images and compress them all in one batch. Each image is processed individually in your browser.' },
            ],
        },
        'image-resizer': {
            title: 'Image Resizer — Resize Images for Instagram, Facebook, YouTube & More | Free Online | ToolBox India',
            description: 'Resize images to exact dimensions, percentage, or 30+ social media presets (Instagram, Facebook, YouTube, LinkedIn). Batch resize, maintain aspect ratio — 100% free, no upload.',
            keywords: 'image resizer, resize image online, resize image for instagram, resize image for facebook, social media image size, batch resize images, change image dimensions, resize photo online free',
            ogTitle: 'Free Image Resizer — 30+ Social Media Presets',
            ogDescription: 'Resize images for Instagram, Facebook, YouTube & more. 30+ presets, exact dimensions, batch resize — 100% in your browser.',
            schemaType: 'WebApplication',
            schemaName: 'Image Resizer — ToolBox India',
            faq: [
                { q: 'What social media presets are available?', a: 'ToolBox India\'s Image Resizer includes 30+ presets: Instagram (post, story, reel, profile), Facebook (post, cover, event), YouTube (thumbnail, channel art, banner), Twitter/X, LinkedIn, WhatsApp, and more.' },
                { q: 'Can I resize multiple images at once?', a: 'Yes! Batch resize is supported. Upload multiple images and resize them all to the same dimensions or preset in one go.' },
            ],
        },
        'background-remover': {
            title: 'Background Remover — AI-Powered, 100% Free & Private | ToolBox India',
            description: 'Remove background from images instantly using AI — 100% in your browser, no upload, no signup. Get transparent PNG output. Works on people, products, animals, logos.',
            keywords: 'background remover, remove background, remove bg online free, background eraser, transparent background, remove image background, ai background remover free, cut out background',
            ogTitle: 'Free AI Background Remover — 100% Private',
            ogDescription: 'Remove backgrounds from images instantly using AI. No upload, no signup. Get transparent PNG output — 100% in your browser.',
            schemaType: 'WebApplication',
            schemaName: 'Background Remover — ToolBox India',
            faq: [
                { q: 'How does the AI background removal work?', a: 'ToolBox India uses an AI model that runs entirely in your browser. It detects the main subject (person, product, animal) and removes the background, giving you a clean transparent PNG.' },
                { q: 'Is my image sent to any server?', a: 'No. The AI model runs locally in your browser. Your images never leave your device — complete privacy guaranteed.' },
            ],
        },
        'image-to-pdf': {
            title: 'Image to PDF Converter — Convert JPG/PNG to PDF Online Free | ToolBox India',
            description: 'Convert one or multiple images (JPG, PNG, WebP) into a single PDF. Reorder pages, choose A4/Letter size, landscape/portrait. 100% in your browser — free, no upload.',
            keywords: 'image to pdf, jpg to pdf, png to pdf, convert image to pdf, photo to pdf, multiple images to pdf, combine images to pdf, image to pdf converter online free',
            ogTitle: 'Free Image to PDF Converter — JPG, PNG to PDF',
            ogDescription: 'Convert images to PDF instantly. Merge multiple images, reorder, choose page size. 100% in your browser.',
            schemaType: 'WebApplication',
            schemaName: 'Image to PDF Converter — ToolBox India',
            faq: [
                { q: 'Can I convert multiple images into one PDF?', a: 'Yes! Upload multiple JPG, PNG, or WebP images, drag to reorder them, choose page size (A4, Letter, Legal) and orientation (portrait/landscape), then download a single merged PDF.' },
            ],
        },
        'word-to-pdf': {
            title: 'Word to PDF Converter — Convert DOCX to PDF Online Free | ToolBox India',
            description: 'Convert Word documents (.docx) to high-quality PDF for free. Preserves text formatting, images, tables & lists. 100% in your browser — no upload, no signup, no watermark.',
            keywords: 'word to pdf, docx to pdf, convert word to pdf online free, word to pdf converter, doc to pdf, convert docx to pdf free, document to pdf, word document to pdf',
            ogTitle: 'Free Word to PDF Converter — DOCX to PDF',
            ogDescription: 'Convert Word (.docx) to PDF instantly. Text, images, tables preserved. No upload, no signup — 100% in your browser.',
            schemaType: 'WebApplication',
            schemaName: 'Word to PDF Converter — ToolBox India',
            faq: [
                { q: 'Does it preserve formatting from my Word document?', a: 'Yes! Text formatting (bold, italic, fonts, colors), images, tables, lists (numbered & bulleted), headings, and page breaks are preserved in the PDF output.' },
                { q: 'Is there a file size limit?', a: 'The converter handles typical Word documents up to 50MB. Since everything runs in your browser, the limit depends on your device\'s available memory.' },
            ],
        },
        'ppt-to-pdf': {
            title: 'PPT to PDF Converter — Convert PowerPoint to PDF Online Free | ToolBox India',
            description: 'Convert PowerPoint presentations (.pptx) to PDF for free. Preserves text, images, shapes & formatting. 100% in your browser — no upload, no signup, no watermark.',
            keywords: 'ppt to pdf, pptx to pdf, convert powerpoint to pdf, powerpoint to pdf online free, ppt to pdf converter online, convert pptx to pdf free, presentation to pdf, slides to pdf',
            ogTitle: 'Free PPT to PDF Converter — PowerPoint to PDF',
            ogDescription: 'Convert PowerPoint (.pptx) to PDF instantly. Text, images, shapes preserved. No upload — 100% in your browser.',
            schemaType: 'WebApplication',
            schemaName: 'PPT to PDF Converter — ToolBox India',
            faq: [
                { q: 'Does it work with .ppt files?', a: 'The converter works best with .pptx files (PowerPoint 2007 and later format). Older .ppt files may need to be saved as .pptx first in PowerPoint or LibreOffice.' },
            ],
        },
        'pdf-toolkit': {
            title: 'PDF Toolkit — 13 Free PDF Tools: Merge, Split, Compress, Convert & More | ToolBox India',
            description: 'All-in-one PDF toolkit with 13 tools: Merge, Split, Compress, PDF to Word, PDF to Images, Extract Pages, Delete Pages, Rotate, Reorder, Page Numbers, Watermark, Protect & PDF Playground. 100% free, no upload.',
            keywords: 'pdf toolkit, merge pdf online, split pdf, compress pdf, pdf to word, pdf to image, extract pdf pages, delete pdf pages, rotate pdf, reorder pdf, add watermark pdf, add page numbers pdf, protect pdf, pdf playground, combine pages from multiple pdfs',
            ogTitle: 'Free PDF Toolkit — 13 Tools in One (Merge, Split, Compress & More)',
            ogDescription: '13 PDF tools in one: Merge, Split, Compress, Convert, Extract, Rotate, Reorder, Watermark, Protect & PDF Playground. 100% in your browser.',
            schemaType: 'WebApplication',
            schemaName: 'PDF Toolkit — ToolBox India',
            faq: [
                { q: 'How many PDF tools does this include?', a: 'The toolkit includes 13 tools: Merge PDFs, Split PDF, Compress PDF (with target file size), PDF to Word, PDF to Images, Extract Pages, Delete Pages, Rotate Pages, Reorder Pages, Add Page Numbers, Add Watermark, Protect PDF with password, and PDF Playground.' },
                { q: 'What is PDF Playground?', a: 'PDF Playground lets you upload multiple PDFs, see all pages as visual thumbnails, select/deselect pages, drag to reorder, rotate individual pages, and build a single PDF from your selection — all in one workspace without downloading between steps.' },
                { q: 'Can I compress a PDF to a specific file size?', a: 'Yes! The Compress tool offers both Smart compression (keeps text selectable) and Target Size mode where you can compress to an exact size like 200KB, 500KB, 1MB, 2MB, or any custom size.' },
            ],
        },
        'pdf-editor': {
            title: 'PDF Editor — Edit PDF Online Free, Add Text, Sign, Annotate | ToolBox India',
            description: 'Edit PDFs online for free — add text, images, signatures, shapes, highlights, freehand drawings. Edit existing text, erase content, whiteout. 100% in your browser, no upload needed.',
            keywords: 'pdf editor online, edit pdf online free, add text to pdf, add signature to pdf, annotate pdf, sign pdf online, draw on pdf, pdf editor free no watermark, edit pdf text, whiteout pdf, erase pdf content',
            ogTitle: 'Free PDF Editor — Edit, Sign, Annotate PDFs Online',
            ogDescription: 'Edit PDFs online for free. Add text, signatures, images, shapes, highlights. Edit existing text, erase content. No upload — 100% private.',
            schemaType: 'WebApplication',
            schemaName: 'PDF Editor — ToolBox India',
            faq: [
                { q: 'Can I edit existing text in a PDF?', a: 'Yes! ToolBox India\'s PDF Editor lets you click on existing text in a PDF and edit it directly. You can change the text, font, size, color, and alignment — similar to tools like Sejda and Adobe Acrobat.' },
                { q: 'Can I add my signature to a PDF?', a: 'Yes! You can draw your signature directly, type it, or upload a signature image. Place it anywhere on the PDF and resize as needed.' },
                { q: 'Is there a watermark added to my edited PDF?', a: 'No! ToolBox India is completely free with no watermarks, no limits, and no signup required. Your edited PDF is clean and professional.' },
            ],
        },
        'tax-calculator': {
            title: 'Income Tax Calculator India FY 2025-26 — Old vs New Regime Comparison | ToolBox India',
            description: 'Free income tax calculator for FY 2025-26 (AY 2026-27). Compare Old vs New regime instantly — see slab breakdowns, deductions (80C, 80D, HRA, NPS, home loan), take-home pay & personalized tax-saving tips.',
            keywords: 'income tax calculator india, income tax calculator FY 2025-26, old vs new regime calculator, tax slab calculator india, income tax comparison, 80C deduction calculator, HRA exemption calculator, take home salary calculator, tax calculator 2025-26',
            ogTitle: 'Free Income Tax Calculator — Old vs New Regime FY 2025-26',
            ogDescription: 'Compare Old vs New tax regime for FY 2025-26. Slab breakdowns, deductions (80C/80D/HRA), take-home pay. Instant, free, private.',
            schemaType: 'WebApplication',
            schemaName: 'Income Tax Calculator India — ToolBox India',
            faq: [
                { q: 'Is this calculator updated for FY 2025-26?', a: 'Yes! The calculator uses the latest tax slabs for FY 2025-26 (AY 2026-27) for both Old and New regime, including the new ₹12L exemption under New regime and all current deduction limits.' },
                { q: 'What deductions are supported?', a: 'Section 80C (₹1.5L), 80D health insurance (self + parents), HRA exemption, NPS (80CCD), home loan interest (Section 24), standard deduction (₹75K), and more.' },
                { q: 'Which tax regime is better for me?', a: 'The calculator shows a side-by-side comparison of both regimes with the exact tax amount, take-home pay, and tells you which regime saves you more. It also provides personalized tax-saving tips.' },
            ],
        },
        'sip-calculator': {
            title: 'SIP Calculator — Mutual Fund Returns, Lumpsum, SWP, Goal Planner | Free Online | ToolBox India',
            description: 'Free SIP & Investment Calculator with 6 modes: SIP, Lumpsum, Step-Up SIP, SWP, Goal-Based & SIP vs Lumpsum. LTCG tax, inflation adjustment, growth charts & year-wise breakdown.',
            keywords: 'sip calculator, sip calculator online, mutual fund calculator, sip return calculator, lumpsum calculator, step up sip calculator, swp calculator, systematic withdrawal plan, goal sip calculator, sip vs lumpsum, investment calculator india',
            ogTitle: 'Free SIP & Investment Calculator — 6 Modes with Tax & Inflation',
            ogDescription: 'SIP, Lumpsum, Step-Up, SWP, Goal-Based & SIP vs Lumpsum calculator. LTCG tax, inflation adjustment, growth charts. Free, instant, private.',
            schemaType: 'WebApplication',
            schemaName: 'SIP & Investment Calculator — ToolBox India',
            faq: [
                { q: 'What calculation modes are available?', a: 'Six modes: SIP (monthly investment), Lumpsum (one-time), Step-Up SIP (annual increment), SWP (systematic withdrawal), Goal-Based (reverse SIP to reach a target), and SIP vs Lumpsum (side-by-side comparison).' },
                { q: 'Does it account for taxes?', a: 'Yes! The calculator applies Long-Term Capital Gains (LTCG) tax at 12.5% on equity gains exceeding ₹1.25 lakh per financial year, as per Budget 2024 rules.' },
                { q: 'What does inflation-adjusted value mean?', a: 'It converts your future investment value into today\'s purchasing power using 6% average inflation. For example, ₹1 crore in 15 years equals approximately ₹41.7 lakh in today\'s rupees.' },
            ],
        },
        'qr-code': {
            title: 'QR Code Generator & Scanner — UPI, WiFi, vCard, Custom Colors & Logo | Free Online | ToolBox India',
            description: 'Generate beautiful QR codes for URLs, UPI payments (GPay/PhonePe/Paytm), WiFi, contacts (vCard), WhatsApp, Email, Phone & SMS. Custom colors, dot styles & logo. Scan from camera or image. 100% free.',
            keywords: 'qr code generator, qr code generator online free, upi qr code generator, wifi qr code, vcard qr code, whatsapp qr code, qr code with logo, custom qr code, qr code scanner online, scan qr code from image, qr code creator',
            ogTitle: 'Free QR Code Generator & Scanner — UPI, WiFi, vCard & More',
            ogDescription: 'Generate stunning QR codes for UPI, WiFi, contacts, WhatsApp. Custom colors, dot styles, logo. Scan from camera. 100% free & private.',
            schemaType: 'WebApplication',
            schemaName: 'QR Code Generator & Scanner — ToolBox India',
            faq: [
                { q: 'Can I generate a UPI QR code?', a: 'Yes! Enter your UPI ID, name, optional amount & note to create a payment QR code that works with Google Pay, PhonePe, Paytm, BHIM and all UPI apps.' },
                { q: 'Can I add my logo to the QR code?', a: 'Yes! Upload any image (your brand logo, photo, icon) and it will be centered inside the QR code. The error correction ensures the QR remains scannable.' },
                { q: 'Can I scan a QR code from a screenshot?', a: 'Yes! Upload any image (screenshot, photo, saved QR) and the scanner will detect and decode the QR code instantly. You can also scan live using your camera.' },
            ],
        },
    },

    // Apply tool-specific SEO when tool is opened
    apply(toolId) {
        const seo = this.toolData[toolId];
        if (!seo) return;

        const url = `${this.BASE_URL}/?tool=${toolId}`;

        // Title
        document.title = seo.title;

        // Meta description
        this._setMeta('name', 'description', seo.description);

        // Meta keywords
        this._setMeta('name', 'keywords', seo.keywords);

        // Canonical
        this._setLink('canonical', url);

        // Open Graph
        this._setMeta('property', 'og:title', seo.ogTitle);
        this._setMeta('property', 'og:description', seo.ogDescription);
        this._setMeta('property', 'og:url', url);

        // Twitter
        this._setMeta('name', 'twitter:title', seo.ogTitle);
        this._setMeta('name', 'twitter:description', seo.ogDescription);

        // Inject tool-specific JSON-LD
        this._injectJsonLd(toolId, seo, url);
    },

    // Restore homepage SEO when returning to home
    restore() {
        const h = this.homeSEO;
        document.title = h.title;
        this._setMeta('name', 'description', h.description);
        this._setLink('canonical', h.canonical);
        this._setMeta('property', 'og:title', h.ogTitle);
        this._setMeta('property', 'og:description', h.ogDescription);
        this._setMeta('property', 'og:url', h.canonical);
        this._setMeta('name', 'twitter:title', h.ogTitle);
        this._setMeta('name', 'twitter:description', h.ogDescription);

        // Remove tool-specific JSON-LD
        const el = document.getElementById('toolJsonLd');
        if (el) el.remove();
    },

    // Helpers
    _setMeta(attr, name, content) {
        let el = document.querySelector(`meta[${attr}="${name}"]`);
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute(attr, name);
            document.head.appendChild(el);
        }
        el.setAttribute('content', content);
    },

    _setLink(rel, href) {
        let el = document.querySelector(`link[rel="${rel}"]`);
        if (!el) {
            el = document.createElement('link');
            el.setAttribute('rel', rel);
            document.head.appendChild(el);
        }
        el.setAttribute('href', href);
    },

    _injectJsonLd(toolId, seo, url) {
        // Remove old tool JSON-LD if any
        let el = document.getElementById('toolJsonLd');
        if (el) el.remove();

        const jsonLd = {
            '@context': 'https://schema.org',
            '@type': seo.schemaType || 'WebApplication',
            'name': seo.schemaName || seo.ogTitle,
            'url': url,
            'description': seo.description,
            'applicationCategory': 'UtilitiesApplication',
            'operatingSystem': 'Any (Browser-based)',
            'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'INR' },
            'isAccessibleForFree': true,
            'browserRequirements': 'Requires a modern browser with JavaScript enabled',
            'creator': { '@type': 'Organization', 'name': 'ToolBox India', 'url': 'https://toolboxindia.com' },
        };

        // Add FAQ if present
        if (seo.faq && seo.faq.length) {
            const faqLd = {
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                'mainEntity': seo.faq.map(f => ({
                    '@type': 'Question',
                    'name': f.q,
                    'acceptedAnswer': { '@type': 'Answer', 'text': f.a },
                })),
            };
            // Use @graph to combine both
            const combined = {
                '@context': 'https://schema.org',
                '@graph': [jsonLd, faqLd],
            };
            el = document.createElement('script');
            el.type = 'application/ld+json';
            el.id = 'toolJsonLd';
            el.textContent = JSON.stringify(combined);
        } else {
            el = document.createElement('script');
            el.type = 'application/ld+json';
            el.id = 'toolJsonLd';
            el.textContent = JSON.stringify(jsonLd);
        }
        document.head.appendChild(el);
    },
};

// ===== URL Handler (Deep Linking) =====
function handleURL() {
    const params = new URLSearchParams(window.location.search);
    const toolId = params.get('tool');
    if (toolId && ToolRegistry.get(toolId)) {
        Router.showTool(toolId);
    }
}

// Handle browser back/forward
window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const toolId = params.get('tool');
    if (toolId) {
        Router.showTool(toolId);
    } else {
        Router.showHome();
    }
});

// ===== Utility Helpers (Available to all tools) =====
window.ToolUtils = {
    formatBytes(bytes, decimals = 1) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
    },

    formatPercentage(value, decimals = 1) {
        return value.toFixed(decimals) + '%';
    },

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    },

    debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }
};

// ===== Initialize App =====
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    SearchManager.init();
    MobileMenu.init();
    NavHighlighter.init();

    // Handle deep links after tools are registered
    setTimeout(() => handleURL(), 100);

    console.log('[ToolBox India] App initialized. Available tools:', Object.keys(ToolRegistry.tools));
});
