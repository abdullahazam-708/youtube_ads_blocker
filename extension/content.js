// ============================================================
// Aegis AI Shield v4.1 — Zero-Ad YouTube Experience
// FIX: Restores video (unmute, normal speed, full opacity)
//      after ad is killed so main video plays normally.
// ============================================================

(function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // CSS — ONLY hides ad overlays/banners, NOT the video element itself
    // (Removed opacity:0 on video — that was causing the black screen bug)
    // ─────────────────────────────────────────────────────────────────────────
    const AEGIS_STYLE = `
        /* Hide ad overlays/info — NOT the video element */
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
        if (document.getElementById('aegis-shield-v41')) return;
        const s = document.createElement('style');
        s.id = 'aegis-shield-v41';
        s.textContent = AEGIS_STYLE;
        (document.head || document.documentElement).appendChild(s);
    }
    injectCSS();
    document.addEventListener('DOMContentLoaded', injectCSS, { once: true });

    // ─────────────────────────────────────────────────────────────────────────
    // AD NODE SELECTORS — elements to physically remove from DOM
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
            document.querySelectorAll(sel).forEach(n => n.remove());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SKIP BUTTON SELECTORS
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
    // RESTORE MAIN VIDEO
    // Called after the ad is gone — resets video to normal playback.
    // This fixes the black screen + muted + 16x speed bug.
    // ─────────────────────────────────────────────────────────────────────────
    function restoreVideo() {
        const video = document.querySelector('video');
        if (!video) return;
        video.muted        = false;
        video.volume       = 1.0;
        video.playbackRate = 1.0;
        // Do NOT touch currentTime here — let YouTube manage it
        console.log('[Aegis v4.1] Video restored — unmuted, 1x speed.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // KILL AD — mute + seek-to-end + click skip
    // ─────────────────────────────────────────────────────────────────────────
    let _adKillTimer = null;
    let _restoreTimer = null;

    function killPlayerAd() {
        const player = document.querySelector('.html5-video-player');
        const video  = document.querySelector('video');
        if (!player || !video) return;

        const adActive =
            player.classList.contains('ad-showing') ||
            player.classList.contains('ad-interrupting');

        if (!adActive) return;

        // Mute ad audio
        video.muted  = true;
        video.volume = 0;

        // Speed up so skip button unlocks faster
        video.playbackRate = 16.0;

        // Seek to end to force skip button to appear
        if (video.duration && isFinite(video.duration) && video.duration > 0) {
            video.currentTime = video.duration - 0.01;
        }

        // Try to click skip button
        clickSkipButton();

        // Retry every 50ms for up to 3 seconds
        clearTimeout(_adKillTimer);
        let attempts = 0;

        function retryKill() {
            if (attempts++ > 60) {
                // Gave up — restore video anyway
                restoreVideo();
                return;
            }

            const player = document.querySelector('.html5-video-player');
            const stillAd = player && (
                player.classList.contains('ad-showing') ||
                player.classList.contains('ad-interrupting')
            );

            if (!stillAd) {
                // Ad is gone! Restore video to normal
                restoreVideo();
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
            _adKillTimer = setTimeout(retryKill, 50);
        }

        _adKillTimer = setTimeout(retryKill, 50);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MASTER OBSERVER
    // ─────────────────────────────────────────────────────────────────────────
    function startObserver() {
        const observer = new MutationObserver((mutations) => {
            let adDetected = false;

            for (const m of mutations) {
                // Watch for ad-showing class change on player
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    const el = m.target;
                    if (
                        el.classList.contains('ad-showing') ||
                        el.classList.contains('ad-interrupting')
                    ) {
                        adDetected = true;
                    } else if (
                        el.classList.contains('html5-video-player') &&
                        !el.classList.contains('ad-showing') &&
                        !el.classList.contains('ad-interrupting')
                    ) {
                        // ad-showing class was REMOVED — ad is over, restore video
                        clearTimeout(_restoreTimer);
                        _restoreTimer = setTimeout(restoreVideo, 100);
                    }
                }

                // Watch for new ad nodes inserted
                if (m.type === 'childList') {
                    for (const node of m.addedNodes) {
                        if (node.nodeType !== 1) continue;
                        const tag = String(node.tagName || '').toLowerCase();
                        const cls = String(node.className || '');

                        if (
                            (tag.startsWith('ytd-') && (
                                tag.includes('ad') ||
                                tag.includes('promo') ||
                                tag.includes('promoted')
                            )) ||
                            cls.includes('ytp-ad') ||
                            cls.includes('skip-button') ||
                            cls.includes('skip-ad')
                        ) {
                            adDetected = true;
                            removeAdNodes();
                        }
                    }
                }
            }

            if (adDetected) killPlayerAd();
        });

        observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class'],
        });

        console.log('[Aegis AI Shield v4.1] Observer active.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VIDEO LISTENERS
    // ─────────────────────────────────────────────────────────────────────────
    function attachVideoListeners() {
        const video = document.querySelector('video');
        if (!video || video._aegisV41) return;
        video._aegisV41 = true;
        video.addEventListener('play',           killPlayerAd, { passive: true });
        video.addEventListener('loadedmetadata', killPlayerAd, { passive: true });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BOOT
    // ─────────────────────────────────────────────────────────────────────────
    function boot() {
        removeAdNodes();
        killPlayerAd();
        startObserver();
        attachVideoListeners();

        // Re-run on YouTube SPA page navigation
        document.addEventListener('yt-navigate-finish', () => {
            removeAdNodes();
            attachVideoListeners();
            // Small delay to let YouTube load the new video
            setTimeout(() => {
                killPlayerAd();
                // Always restore video after navigation in case it was mid-ad
                const player = document.querySelector('.html5-video-player');
                if (player && !player.classList.contains('ad-showing')) {
                    restoreVideo();
                }
            }, 500);
        });

        document.addEventListener('yt-page-data-updated', () => {
            removeAdNodes();
        });

        // Safety net — every 1 second
        setInterval(() => {
            removeAdNodes();
            attachVideoListeners();
            killPlayerAd();
        }, 1000);

        console.log('[Aegis AI Shield v4.1] Booted. Ad-free + Video Restore active.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

})();
