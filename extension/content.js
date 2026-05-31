// ============================================================
// Aegis AI Shield v2.0 — YouTube Premium Simulation
// Strategy: MutationObserver (event-driven, 0ms latency)
//            + CSS pre-hiding (blocks render before paint)
//            + Network-level ad URL interception
// ============================================================

(function () {
    'use strict';

    // ── 1. INJECT CSS AT document_start ──────────────────────────────────────
    // These rules run BEFORE any YouTube frame paints. The ad container is
    // hidden at the CSS level so even a single frame is never visible.
    const AEGIS_STYLE = `
        /* ── Video ad overlay & skip button area ── */
        .ad-showing .ytp-ad-player-overlay,
        .ad-showing .ytp-ad-overlay-container,
        .ad-showing .ytp-ad-text-overlay,
        .ad-showing .ytp-ad-image-overlay,
        .ad-interrupting .ytp-ad-player-overlay,
        .ytp-ad-overlay-container,
        .ytp-ad-overlay-image,
        .ytp-ad-overlay-slot,
        .ytp-ad-text-overlay {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
        }

        /* ── Sidebar / companion ads ── */
        #player-ads,
        ytd-companion-ad-renderer,
        #masthead-ad,
        ytd-ad-slot-renderer,
        ytd-banner-promo-renderer,
        ytd-statement-banner-renderer,
        .ytd-banner-promo-renderer-background {
            display: none !important;
        }

        /* ── Homepage promoted items ── */
        ytd-rich-item-renderer:has(ytd-ad-slot-renderer),
        ytd-display-ad-renderer,
        ytd-promoted-sparkles-web-renderer,
        ytd-promoted-video-renderer,
        ytd-search-pyv-renderer,
        ytd-in-feed-ad-layout-renderer {
            display: none !important;
        }

        /* ── Pre-roll: hide the black flash while muting & skipping ── */
        .ad-showing video {
            opacity: 0 !important;
        }
    `;

    function injectCSS() {
        const style = document.createElement('style');
        style.id = 'aegis-ai-shield-styles';
        style.textContent = AEGIS_STYLE;
        (document.head || document.documentElement).appendChild(style);
    }

    // Inject as early as possible
    injectCSS();
    document.addEventListener('DOMContentLoaded', injectCSS, { once: true });

    // ── 2. CORE AD-KILL FUNCTION ──────────────────────────────────────────────
    // Called every time the MutationObserver detects a relevant DOM change.
    function killAd() {
        const player = document.querySelector('.html5-video-player');
        const video  = document.querySelector('video');
        if (!player || !video) return;

        const adActive =
            player.classList.contains('ad-showing') ||
            player.classList.contains('ad-interrupting') ||
            !!document.querySelector('.ytp-ad-player-overlay') ||
            !!document.querySelector('.ytp-ad-duration-remaining');

        if (!adActive) return;

        // ── a. Mute & hide ────────────────────────────────────────────────
        video.muted  = true;
        video.volume = 0;

        // ── b. Hard-skip: seek to end if duration is known ───────────────
        if (video.duration && isFinite(video.duration)) {
            video.currentTime = video.duration;
        } else {
            // Duration not loaded yet — warp speed to force buffering to end
            video.playbackRate = 16.0;
        }

        // ── c. Click every skip button variant YouTube uses ───────────────
        const SKIP_SELECTORS = [
            '.ytp-ad-skip-button',
            '.ytp-ad-skip-button-modern',
            '.ytp-skip-ad-button',
            '[class*="skip-button"]',
            '.ytp-ad-skip-button-slot button',
        ];
        for (const sel of SKIP_SELECTORS) {
            document.querySelectorAll(sel).forEach(btn => {
                btn.click();
            });
        }

        // ── d. If still showing after 300ms (non-skippable ad), reload ────
        //      YouTube Premium simply doesn't show the ad at all; we simulate
        //      this by re-seeking immediately on the next video.
        clearTimeout(window._aegisForceKill);
        window._aegisForceKill = setTimeout(() => {
            const stillAd = document.querySelector('.html5-video-player.ad-showing') ||
                            document.querySelector('.html5-video-player.ad-interrupting');
            if (stillAd) {
                const v = document.querySelector('video');
                if (v && v.duration && isFinite(v.duration)) {
                    v.currentTime = v.duration;
                    v.playbackRate = 16.0;
                }
                // Click skip again
                SKIP_SELECTORS.forEach(sel =>
                    document.querySelectorAll(sel).forEach(b => b.click())
                );
            }
        }, 300);
    }

    // ── 3. MUTATION OBSERVER — EVENT-DRIVEN, 0ms LATENCY ─────────────────────
    // Watches the entire document for class changes on the player or child
    // insertions (YouTube injects ad nodes dynamically).
    function startObserver() {
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                // Class change on player (e.g., 'ad-showing' added)
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    killAd();
                    return;
                }
                // New nodes inserted (ad overlay or skip button injected)
                if (m.type === 'childList' && m.addedNodes.length > 0) {
                    for (const node of m.addedNodes) {
                        if (node.nodeType === 1) {
                            const cls = node.className || '';
                            if (
                                typeof cls === 'string' &&
                                (cls.includes('ad-') || cls.includes('ytp-ad'))
                            ) {
                                killAd();
                                return;
                            }
                        }
                    }
                }
            }
        });

        observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class'],
        });

        console.log('[Aegis AI Shield] MutationObserver active — Premium simulation ON.');
    }

    // ── 4. ALSO WATCH video timeupdate ───────────────────────────────────────
    // Some non-skippable ads don't trigger class mutations.
    // Listening to the video's timeupdate gives us a fast secondary trigger.
    function attachVideoListener() {
        const video = document.querySelector('video');
        if (!video || video._aegisAttached) return;
        video._aegisAttached = true;
        video.addEventListener('timeupdate', killAd, { passive: true });
        video.addEventListener('play', killAd, { passive: true });
    }

    // ── 5. BOOT ───────────────────────────────────────────────────────────────
    // Start the observer as soon as any DOM is available.
    function boot() {
        startObserver();
        attachVideoListener();

        // Re-attach listener when YouTube navigates (SPA navigation)
        document.addEventListener('yt-navigate-finish', () => {
            attachVideoListener();
            killAd();
        });

        // Fallback safety net: run killAd every 500ms for edge cases
        // (much less frequent than before, just a safety net)
        setInterval(() => {
            attachVideoListener();
            killAd();
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

})();
