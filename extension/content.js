// ============================================================
// Aegis AI Shield v4.2 — Premium YouTube Ad Blocker
// Strategy: Zero-latency MutationObserver + CSS hiding + State Restore
// Bypasses ads in under 30ms with absolute zero user interaction.
// ============================================================

(function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // 1. INJECT PRE-RENDERING CSS RULES
    //    Hides ad containers, banners, and overlays before they render.
    // ─────────────────────────────────────────────────────────────────────────
    const AEGIS_STYLE = `
        /* Hide ad video frames during ad-showing state */
        .ad-showing video,
        .ad-interrupting video {
            opacity: 0 !important;
            visibility: hidden !important;
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
        .ytp-ad-text-overlay,
        .ytp-ad-progress,
        .ytp-ad-progress-list,
        .ytp-ad-simple-ad-badge,
        .ytp-ad-preview-container,
        .ytp-ad-preview-text-modern,
        .ytp-ad-button-icon,
        .ytp-ad-visit-advertiser-button { 
            display: none !important; 
            opacity: 0 !important;
            visibility: hidden !important;
        }

        /* Hide sidebar ads and homepage promoted layouts */
        #player-ads, ytd-companion-ad-renderer, #masthead-ad,
        ytd-ad-slot-renderer, ytd-banner-promo-renderer,
        ytd-statement-banner-renderer, .ytd-banner-promo-renderer-background,
        ytd-rich-item-renderer:has(ytd-ad-slot-renderer),
        ytd-display-ad-renderer, ytd-promoted-sparkles-web-renderer,
        ytd-promoted-video-renderer, ytd-search-pyv-renderer,
        ytd-in-feed-ad-layout-renderer { 
            display: none !important; 
        }
    `;

    function injectCSS() {
        if (document.getElementById('aegis-shield-v42')) return;
        const s = document.createElement('style');
        s.id = 'aegis-shield-v42';
        s.textContent = AEGIS_STYLE;
        (document.head || document.documentElement).appendChild(s);
    }
    injectCSS();
    document.addEventListener('DOMContentLoaded', injectCSS, { once: true });

    // ─────────────────────────────────────────────────────────────────────────
    // 2. DOM CLEANUP RULES — Removes promotional and sponsored content
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
            document.querySelectorAll(sel).forEach(node => node.remove());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. AUTO-CLICK SKIP BUTTONS
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
            const btns = document.querySelectorAll(sel);
            for (const btn of btns) {
                if (btn) {
                    btn.click();
                    return true;
                }
            }
        }
        return false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. SMART STATE TRACKING & RESTORATION
    //    Saves user preferences (mute state and volume) before ad playback
    //    and recovers them exactly when the ad terminates.
    // ─────────────────────────────────────────────────────────────────────────
    let savedMuteState = false;
    let savedVolume = 1.0;
    let isAdActive = false;

    function saveUserState(video) {
        if (!isAdActive && video) {
            savedMuteState = video.muted;
            savedVolume = video.volume;
        }
    }

    function restoreVideoState() {
        const video = document.querySelector('video');
        if (!video) return;

        // Reset speed and volume/mute back to pre-ad settings
        video.playbackRate = 1.0;
        video.muted = savedMuteState;
        video.volume = savedVolume;
        isAdActive = false;
        console.log('[Aegis v4.2] Clean restore: Mute =', savedMuteState, 'Volume =', savedVolume);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. HIGH-SPEED AD ATTACK ENGINE
    // ─────────────────────────────────────────────────────────────────────────
    let killTimer = null;

    function killAd() {
        const player = document.querySelector('.html5-video-player');
        const video = document.querySelector('video');
        if (!player || !video) return;

        const adShowing = player.classList.contains('ad-showing') || 
                           player.classList.contains('ad-interrupting');

        if (!adShowing) {
            if (isAdActive) {
                restoreVideoState();
            }
            return;
        }

        // We are now in an ad
        saveUserState(video);
        isAdActive = true;

        // 1. Instantly Mute the ad
        video.muted = true;
        video.volume = 0;

        // 2. Play at 16x speed to bypass countdown instantly
        video.playbackRate = 16.0;

        // 3. Jump to the very end of the ad to trigger YouTube's skip event
        if (video.duration && isFinite(video.duration) && video.duration > 0) {
            video.currentTime = video.duration - 0.01;
        }

        // 4. Click the skip button immediately
        clickSkipButton();

        // 5. Fast retry loop (every 30ms for 2 seconds) to handle delays
        clearTimeout(killTimer);
        let retries = 0;
        function retry() {
            if (retries++ > 60) {
                restoreVideoState();
                return;
            }

            const activePlayer = document.querySelector('.html5-video-player');
            const stillAd = activePlayer && (
                activePlayer.classList.contains('ad-showing') ||
                activePlayer.classList.contains('ad-interrupting')
            );

            if (!stillAd) {
                restoreVideoState();
                return;
            }

            const v = document.querySelector('video');
            if (v) {
                v.muted = true;
                v.volume = 0;
                v.playbackRate = 16.0;
                if (v.duration && isFinite(v.duration) && v.duration > 0) {
                    v.currentTime = v.duration - 0.01;
                }
            }
            clickSkipButton();
            killTimer = setTimeout(retry, 30);
        }
        killTimer = setTimeout(retry, 30);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. EVENT-DRIVEN MUTATION OBSERVER
    // ─────────────────────────────────────────────────────────────────────────
    function startObserver() {
        const observer = new MutationObserver((mutations) => {
            let adTriggered = false;

            for (const m of mutations) {
                // Class state check (player transitions)
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    const el = m.target;
                    if (el.classList.contains('ad-showing') || el.classList.contains('ad-interrupting')) {
                        adTriggered = true;
                    } else if (
                        el.classList.contains('html5-video-player') && 
                        !el.classList.contains('ad-showing') && 
                        !el.classList.contains('ad-interrupting')
                    ) {
                        restoreVideoState();
                    }
                }

                // Node insertion check (skip button or promotional banners injected)
                if (m.type === 'childList') {
                    for (const node of m.addedNodes) {
                        if (node.nodeType !== 1) continue;
                        const tag = String(node.tagName || '').toLowerCase();
                        const cls = String(node.className || '');

                        if (
                            (tag.startsWith('ytd-') && (tag.includes('ad') || tag.includes('promo'))) ||
                            cls.includes('ytp-ad') ||
                            cls.includes('skip-button') ||
                            cls.includes('skip-ad')
                        ) {
                            adTriggered = true;
                            removeAdNodes();
                        }
                    }
                }
            }

            if (adTriggered) {
                killAd();
            }
        });

        observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class'],
        });

        console.log('[Aegis AI Shield v4.2] High-frequency observers active.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. MULTI-LAYERED TRIGGERS & BOOTSTRAP
    // ─────────────────────────────────────────────────────────────────────────
    function attachListeners() {
        const video = document.querySelector('video');
        if (!video || video._aegisV42) return;
        video._aegisV42 = true;
        video.addEventListener('play', killAd, { passive: true });
        video.addEventListener('timeupdate', killAd, { passive: true });
        video.addEventListener('loadedmetadata', killAd, { passive: true });
    }

    function boot() {
        removeAdNodes();
        killAd();
        startObserver();
        attachListeners();

        // YouTube SPA Page navigation listener
        document.addEventListener('yt-navigate-finish', () => {
            removeAdNodes();
            attachListeners();
            setTimeout(() => {
                const player = document.querySelector('.html5-video-player');
                if (player && !player.classList.contains('ad-showing')) {
                    restoreVideoState();
                } else {
                    killAd();
                }
            }, 200);
        });

        // Periodic maintenance check (safety net)
        setInterval(() => {
            removeAdNodes();
            attachListeners();
            const player = document.querySelector('.html5-video-player');
            if (player && !player.classList.contains('ad-showing') && !player.classList.contains('ad-interrupting')) {
                const v = document.querySelector('video');
                if (v && v.playbackRate > 1.0) {
                    restoreVideoState();
                }
            }
        }, 1000);

        console.log('[Aegis AI Shield v4.2] Fully booted. Enjoy YouTube Premium simulation.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

})();
