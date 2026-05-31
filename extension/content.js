// ============================================================
// Aegis AI Shield v3.0 — YouTube Premium Simulation
// New in v3: Auto-clicks skip button the INSTANT it appears.
//            Bypasses "wait 5s then skip" by seeking video to end.
//            Zero manual interaction required.
// ============================================================

(function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // 1. INJECT CSS AT document_start
    //    Hides the ad video frame before it ever paints on screen.
    // ─────────────────────────────────────────────────────────────────────────
    const AEGIS_STYLE = `
        /* Hide ad video frame completely so there's no flash */
        .ad-showing video,
        .ad-interrupting video {
            opacity: 0 !important;
            pointer-events: none !important;
        }

        /* Hide all overlay banner ads */
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

        /* Hide sidebar / companion ads */
        #player-ads,
        ytd-companion-ad-renderer,
        #masthead-ad,
        ytd-ad-slot-renderer,
        ytd-banner-promo-renderer,
        ytd-statement-banner-renderer,
        .ytd-banner-promo-renderer-background {
            display: none !important;
        }

        /* Hide homepage and search promoted items */
        ytd-rich-item-renderer:has(ytd-ad-slot-renderer),
        ytd-display-ad-renderer,
        ytd-promoted-sparkles-web-renderer,
        ytd-promoted-video-renderer,
        ytd-search-pyv-renderer,
        ytd-in-feed-ad-layout-renderer {
            display: none !important;
        }
    `;

    function injectCSS() {
        if (document.getElementById('aegis-ai-shield-styles')) return;
        const style = document.createElement('style');
        style.id = 'aegis-ai-shield-styles';
        style.textContent = AEGIS_STYLE;
        (document.head || document.documentElement).appendChild(style);
    }

    // Run immediately — before the page renders
    injectCSS();
    document.addEventListener('DOMContentLoaded', injectCSS, { once: true });

    // ─────────────────────────────────────────────────────────────────────────
    // 2. ALL KNOWN SKIP BUTTON SELECTORS
    //    YouTube changes these frequently — we cover every variant.
    // ─────────────────────────────────────────────────────────────────────────
    const SKIP_SELECTORS = [
        '.ytp-ad-skip-button',
        '.ytp-ad-skip-button-modern',
        '.ytp-skip-ad-button',
        '.ytp-ad-skip-button-slot button',
        'button.ytp-ad-skip-button',
        '[class*="skip-button"]',
        '[class*="skip-ad"]',
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // 3. AUTO-CLICK SKIP BUTTON
    //    Finds any visible skip button and clicks it immediately.
    //    Returns true if a button was clicked.
    // ─────────────────────────────────────────────────────────────────────────
    function clickSkipButton() {
        for (const sel of SKIP_SELECTORS) {
            const btns = document.querySelectorAll(sel);
            for (const btn of btns) {
                if (btn) {
                    btn.click();
                    console.log('[Aegis v3] Skip button auto-clicked:', sel);
                    return true;
                }
            }
        }
        return false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. BYPASS "WAIT X SECONDS" — seek the ad video to its end
    //    YouTube only enables the skip button after N seconds.
    //    We skip that wait by seeking the ad video to its end instantly,
    //    which forces YouTube to mark the ad as "watched" and enable skip.
    // ─────────────────────────────────────────────────────────────────────────
    function bypassSkipCountdown() {
        const video = document.querySelector('video');
        if (!video) return;

        // Mute immediately so no audio plays
        video.muted  = true;
        video.volume = 0;

        // If duration is known, jump to end — this triggers the skip button
        if (video.duration && isFinite(video.duration) && video.duration > 0) {
            video.currentTime = video.duration - 0.01;
            video.playbackRate = 16.0;
        } else {
            // Duration not loaded yet — set max speed and retry shortly
            video.playbackRate = 16.0;
            setTimeout(bypassSkipCountdown, 200);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. CORE AD KILL — runs every time an ad is detected
    // ─────────────────────────────────────────────────────────────────────────
    function killAd() {
        const player = document.querySelector('.html5-video-player');
        if (!player) return;

        const adActive =
            player.classList.contains('ad-showing') ||
            player.classList.contains('ad-interrupting') ||
            !!document.querySelector('.ytp-ad-player-overlay') ||
            !!document.querySelector('.ytp-ad-duration-remaining');

        if (!adActive) return;

        // Step 1: Try to click skip button right now
        const skipped = clickSkipButton();

        // Step 2: If no skip button yet, bypass the countdown
        // (seek video to end so YouTube enables the skip button sooner)
        if (!skipped) {
            bypassSkipCountdown();
        }

        // Step 3: Schedule aggressive re-attempts every 50ms for 3 seconds
        // to handle the window where the skip button appears after countdown
        clearTimeout(window._aegisRetryTimer);
        let retries = 0;
        function retryKill() {
            retries++;
            if (retries > 60) return; // Stop after 3 seconds of retries

            const stillAd = document.querySelector('.html5-video-player.ad-showing') ||
                            document.querySelector('.html5-video-player.ad-interrupting');
            if (!stillAd) return; // Ad is gone, we're done

            bypassSkipCountdown();
            clickSkipButton();

            window._aegisRetryTimer = setTimeout(retryKill, 50);
        }
        window._aegisRetryTimer = setTimeout(retryKill, 50);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. DEDICATED SKIP BUTTON OBSERVER
    //    Watches ONLY for skip button elements being added to the DOM.
    //    This fires the instant YouTube injects the skip button node,
    //    even mid-countdown. We click it immediately.
    // ─────────────────────────────────────────────────────────────────────────
    function startSkipButtonObserver() {
        const skipObserver = new MutationObserver(() => {
            // Check if any skip button is now in DOM
            for (const sel of SKIP_SELECTORS) {
                const btn = document.querySelector(sel);
                if (btn) {
                    btn.click();
                    console.log('[Aegis v3] Skip button appeared & auto-clicked via observer.');
                }
            }
        });

        skipObserver.observe(document.documentElement, {
            subtree: true,
            childList: true,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. MAIN PLAYER OBSERVER
    //    Watches for 'ad-showing' class being added to the player element.
    //    This is the primary trigger for killAd().
    // ─────────────────────────────────────────────────────────────────────────
    function startPlayerObserver() {
        const playerObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    const target = m.target;
                    if (
                        target.classList.contains('ad-showing') ||
                        target.classList.contains('ad-interrupting')
                    ) {
                        killAd();
                        return;
                    }
                }
                // Also watch for ad nodes being inserted
                if (m.type === 'childList') {
                    for (const node of m.addedNodes) {
                        if (node.nodeType === 1) {
                            const cls = String(node.className || '');
                            if (cls.includes('ytp-ad') || cls.includes('ad-showing')) {
                                killAd();
                                return;
                            }
                        }
                    }
                }
            }
        });

        playerObserver.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class'],
        });

        console.log('[Aegis AI Shield v3] Player observer active.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. VIDEO EVENT LISTENER
    //    Secondary trigger via video element events.
    // ─────────────────────────────────────────────────────────────────────────
    function attachVideoListeners() {
        const video = document.querySelector('video');
        if (!video || video._aegisV3Attached) return;
        video._aegisV3Attached = true;
        video.addEventListener('play',       killAd, { passive: true });
        video.addEventListener('timeupdate', killAd, { passive: true });
        video.addEventListener('loadedmetadata', () => {
            // When ad metadata loads, we know the duration — seek to end
            const player = document.querySelector('.html5-video-player');
            if (player && (
                player.classList.contains('ad-showing') ||
                player.classList.contains('ad-interrupting')
            )) {
                bypassSkipCountdown();
                clickSkipButton();
            }
        }, { passive: true });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. BOOT
    // ─────────────────────────────────────────────────────────────────────────
    function boot() {
        startPlayerObserver();
        startSkipButtonObserver();
        attachVideoListeners();

        // Re-attach on YouTube SPA navigation (clicking a new video)
        document.addEventListener('yt-navigate-finish', () => {
            attachVideoListeners();
            killAd();
        });

        // Safety net fallback — runs every 500ms (slower = less CPU waste)
        setInterval(() => {
            attachVideoListeners();
            killAd();
        }, 500);

        console.log('[Aegis AI Shield v3] Booted — Zero-touch Premium simulation active.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

})();
