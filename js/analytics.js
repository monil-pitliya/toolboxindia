// Google Analytics 4 — Replace GA_MEASUREMENT_ID with your actual ID
// Get your ID from: https://analytics.google.com
window.GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // TODO: Replace with your GA4 ID

// Load GA4
(function() {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${window.GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', window.GA_MEASUREMENT_ID, {
        page_title: document.title,
        page_location: window.location.href,
        cookie_flags: 'SameSite=None;Secure',
    });
})();

// Track tool usage events
window.trackToolOpen = function(toolId) {
    if (window.gtag) {
        gtag('event', 'tool_open', {
            event_category: 'engagement',
            event_label: toolId,
            tool_name: toolId
        });
    }
};

window.trackToolComplete = function(toolId, details) {
    if (window.gtag) {
        gtag('event', 'tool_complete', {
            event_category: 'conversion',
            event_label: toolId,
            tool_name: toolId,
            ...details
        });
    }
};

// Track social shares
window.trackShare = function(platform, toolId) {
    if (window.gtag) {
        gtag('event', 'share', {
            method: platform,
            content_type: 'tool',
            item_id: toolId
        });
    }
};

console.log('[ToolBox India] Analytics loaded. Remember to replace GA_MEASUREMENT_ID!');
