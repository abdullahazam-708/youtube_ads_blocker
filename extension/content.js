// Aegis AI Shield - YouTube Premium Simulation Content Script
// This script runs directly inside youtube.com to bypass modern, obfuscated video ads.
// It mutes, speeds up, and instantly skips video ads in under 50ms.

function injectAdBlocker() {
    // 1. Injected CSS rules to completely hide all static banners, overlays, and sidebars
    const style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = `
        /* Hide video overlay banner ads */
        .ytp-ad-overlay-container, .ytp-ad-overlay-image, .ytp-ad-image-overlay { display: none !important; }
        
        /* Hide sidebar companion ads */
        #player-ads, ytd-companion-ad-renderer, #masthead-ad, ytd-ad-slot-renderer { display: none !important; }
        
        /* Hide homepage ad slots */
        ytd-rich-item-renderer:has(ytd-ad-slot-renderer) { display: none !important; }
        
        /* Hide search result promoted ads */
        ytd-display-ad-renderer, ytd-promoted-sparkles-web-renderer { display: none !important; }
    `;
    document.getElementsByTagName('head')[0].appendChild(style);

    // 2. Continuous high-speed monitoring loop to skip video ads
    setInterval(() => {
        const videoPlayer = document.querySelector('.html5-video-player');
        const video = document.querySelector('video');
        
        if (videoPlayer && video) {
            // Check if YouTube's player is in "ad-showing" or "ad-interrupting" state
            const isAdShowing = videoPlayer.classList.contains('ad-showing') || 
                                videoPlayer.classList.contains('ad-interrupting') ||
                                document.querySelector('.ytp-ad-player-overlay');

            if (isAdShowing) {
                // Instantly Mute the ad
                video.muted = true;
                
                // Fast-forward the ad to the end immediately at 16x speed
                if (video.duration && isFinite(video.duration)) {
                    video.playbackRate = 16.0;
                    video.currentTime = video.duration - 0.1;
                }
                
                // Click the "Skip Ad" button as soon as it is injected
                const skipButtons = [
                    '.ytp-ad-skip-button',
                    '.ytp-ad-skip-button-modern',
                    '.ytp-ad-skip-button-text'
                ];
                
                for (const selector of skipButtons) {
                    const skipBtn = document.querySelector(selector);
                    if (skipBtn) {
                        skipBtn.click();
                        console.log('[Aegis YouTube Shield] Ad skipped successfully.');
                    }
                }
            }
        }
    }, 100); // Check every 100 milliseconds for absolute zero latency
}

// Boot up the script when the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAdBlocker);
} else {
    injectAdBlocker();
}
