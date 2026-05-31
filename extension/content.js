// ============================================================
// Aegis AI Shield v4.0 — Zero-Ad YouTube Experience
// 3-Layer Strategy:
//   Layer 1 → Network: rules.json blocks ad servers (no download)
//   Layer 2 → DOM: Remove ad nodes before they render
//   Layer 3 → Player: Mute + seek-to-end + auto-click skip
// Result: Videos play instantly with ZERO ads, like YouTube Premium
// ============================================================

(function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // LAYER 2A: INJECT CSS — hide ad elements before any frame paints
    // ─────────────────────────────────────────────────────────────────────────
    const AEGIS_STYLE = `
        /* Hide ad video frame instantly */
        .ad-showing video,
        .ad-interrupting video {
            opacity: 0 !important;
            pointer-events: none !important;
        }
        /* Hide all known ad overlay elements */
        .ad-showing .ytp-ad-player-overlay,
        .ad-showing .ytp-ad-overlay-container,
        .ad-showing .ytp-ad-text-overlay,
        .ad-showing .ytp-ad-image-overlay,
        .ad-interrupting .ytp-ad-player-overlay,
        .ytp-ad-overlay-container,
        .ytp-ad-overlay-image,
        .ytp-ad-overlay-slot,
        .ytp-ad-text-overlay,
        .ytp-ad-progress,
        .ytp-ad-progress-list,
        .ytp-ad-simple-ad-badge,
        .ytp-ad-preview-container,
        .ytp-ad-preview-text-modern,
        .ytp-ad-button-icon,
        .ytp-ad-visit-advertiser-button { display: none !important; }
        /* Sidebar / companion / banner ads */
        #player-ads, ytd-companion-ad-renderer, #masthead-ad,
        ytd-ad-slot-renderer, ytd-banner-promo-renderer,
        ytd-statement-banner-renderer, .ytd-banner-promo-renderer-background,
        ytd-rich-item-renderer:has(ytd-ad-slot-renderer),
        ytd-display-ad-renderer, ytd-promoted-sparkles-web-renderer,
        ytd-promoted-video-renderer, ytd-search-pyv-renderer,
        ytd-in-feed-ad-layout-renderer { display: none !important; }
    `;

    function injectCSS() {
        if (document.getElementById('aegis-shield-v4')) return;
        const s = document.createElement('style');
        s.id = 'aegis-shield-v4';
        s.textContent = AEGIS_STYLE;
        (document.head || document.documentElement).appendChild(s);
    }
    injectCSS();
    document.addEventListener('DOMContentLoaded', injectCSS, { once: true });

    // ─────────────────────────────────────────────────────────────────────────
    // LAYER 2B: AD NODE REMOVER
    // These selectors match the actual ad container elements YouTube injects.
    // We remove them from the DOM entirely so the player never renders them.
    // ─────────────────────────────────────────────────────────────────────────
    const AD_NODE_SELECTORS = [
        'ytd-ad-slot-renderer',
        'ytd-display-ad-renderer',
        'ytd-promoted-sparkles-web-renderer',
        'ytd-promoted-video-renderer',
        'ytd-search-pyv-renderer',
        'ytd-in-feed-ad-layout-renderer',
        'ytd-companion-ad-renderer',
        'ytd-banner-promo-renderer',
        '#player-ads',
        '#masthead-ad',
    ];

    function removeAdNodes() {
        for (const sel of AD_NODE_SELECTORS) {
            document.querySelectorAll(sel).forEach(node => {
                node.remove();
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LAYER 3: SKIP BUTTON SELECTORS
    // ─────────────────────────────────────────────────────────────────────────
    const SKIP_SELECTORS = [
        '.ytp-ad-skip-button',
        '.ytp-ad-skip-button-modern',
        '.ytp-skip-ad-button',
        '.ytp-ad-skip-button-slot button',
        '[class*="skip-button"]',
        '[class*="skip-ad"]',
    ];

    function clickSkipButton() {
        for (const sel of SKIP_SELECTORS) {
            document.querySelectorAll(sel).forEach(btn => btn && btn.click());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LAYER 3: PLAYER-LEVEL AD KILLER
    // Called when an ad is detected in the player.
    // Mutes + seeks to end + clicks skip button instantly.
    // ─────────────────────────────────────────────────────────────────────────
    function killPlayerAd() {
        const player = document.querySelector('.html5-video-player');
        const video  = document.querySelector('video');
        if (!player || !video) return;

        const adActive =
            player.classList.contains('ad-showing') ||
            player.classList.contains('ad-interrupting');

        if (!adActive) return;

        // Mute immediately — no sound at all
        video.muted  = true;
        video.volume = 0;

        // Warp speed playback
        video.playbackRate = 16.0;

        // Seek to very end of ad (forces YouTube to enable the skip button)
        if (video.duration && isFinite(video.duration) && video.duration > 0) {
            video.currentTime = video.duration - 0.01;
        }

        // Click skip button
        clickSkipButton();

        // Retry for 3 seconds every 50ms (handles delayed skip button appearance)
        clearTimeout(window._aegisKillTimer);
        let attempts = 0;
        function retryKill() {
            if (attempts++ > 60) return;
            const still = document.querySelector('.html5-video-player.ad-showing') ||
                          document.querySelector('.html5-video-player.ad-interrupting');
            if (!still) return;
            const v = document.querySelector('video');
            if (v) {
                v.muted = true;
                v.volume = 0;
                v.playbackRate = 16.0;
                if (v.duration && isFinite(v.duration)) v.currentTime = v.duration - 0.01;
            }
            clickSkipButton();
            window._aegisKillTimer = setTimeout(retryKill, 50);
        }
        window._aegisKillTimer = setTimeout(retryKill, 50);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MASTER OBSERVER — watches for everything
    // One observer handles both DOM node insertion and class changes.
    // ─────────────────────────────────────────────────────────────────────────
    function startObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldKillAd = false;
            let shouldRemoveNodes = false;

            for (const m of mutations) {
                // Detect ad-showing class being added to player
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    const el = m.target;
                    if (el.classList.contains('ad-showing') ||
                        el.classList.contains('ad-interrupting')) {
                        shouldKillAd = true;
                    }
                }

                // Detect new nodes being added (ad containers or skip buttons)
                if (m.type === 'childList') {
                    for (const node of m.addedNodes) {
                        if (node.nodeType !== 1) continue;
                        const tag = node.tagName ? node.tagName.toLowerCase() : '';
                        const cls = String(node.className || '');

                        // Is it an ad container node? Remove it.
                        if (
                            tag.startsWith('ytd-') && (
                                tag.includes('ad') ||
                                tag.includes('promo') ||
                                tag.includes('promoted') ||
                                tag.includes('sponsored')
                            )
                        ) {
                            node.remove();
                            shouldRemoveNodes = true;
                        }

                        // Is it a skip button? Click it.
                        if (cls.includes('skip-button') || cls.includes('skip-ad') ||
                            cls.includes('ytp-ad')) {
                            shouldKillAd = true;
                        }
                    }
                }
            }

            if (shouldRemoveNodes) removeAdNodes();
            if (shouldKillAd) killPlayerAd();
        });

        observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class'],
        });

        console.log('[Aegis AI Shield v4] Observer active — Zero-Ad mode ON.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VIDEO EVENT LISTENERS — secondary triggers
    // ─────────────────────────────────────────────────────────────────────────
    function attachVideoListeners() {
        const video = document.querySelector('video');
        if (!video || video._aegisV4) return;
        video._aegisV4 = true;
        video.addEventListener('play',            killPlayerAd, { passive: true });
        video.addEventListener('timeupdate',      killPlayerAd, { passive: true });
        video.addEventListener('loadedmetadata',  killPlayerAd, { passive: true });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BOOT
    // ─────────────────────────────────────────────────────────────────────────
    function boot() {
        // Run immediately on boot
        removeAdNodes();
        killPlayerAd();
        startObserver();
        attachVideoListeners();

        // Re-run on YouTube SPA navigation (new video clicked)
        document.addEventListener('yt-navigate-finish', () => {
            removeAdNodes();
            killPlayerAd();
            attachVideoListeners();
        });

        document.addEventListener('yt-page-data-updated', () => {
            removeAdNodes();
            killPlayerAd();
        });

        // Safety net — every 800ms (low CPU, only for edge cases)
        setInterval(() => {
            removeAdNodes();
            killPlayerAd();
            attachVideoListeners();
        }, 800);

        console.log('[Aegis AI Shield v4] Booted. Videos play ad-free like YouTube Premium.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

})();
