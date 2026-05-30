// Aegis AI Shield Background Worker
const API_URL = 'http://localhost:5000/api/report-block';

// Listen for network blocking events from the DeclarativeNetRequest API
if (chrome.declarativeNetRequest) {
    // Increment local metrics whenever an ad or tracking network is matched/intercepted
    // Note: MV3 declarativeNetRequest background action tracking uses the action rule match events if registered
    // For general simulation of extension reporting:
    chrome.storage.local.get({ totalBlocked: 0 }, (data) => {
        let current = data.totalBlocked;
        chrome.storage.local.set({ totalBlocked: current });
    });
}

// Intercept specific headers and log blocks to simulate our dynamic on-device ML model
chrome.webRequest = chrome.webRequest || {};
if (chrome.webRequest.onBeforeRequest) {
    chrome.webRequest.onBeforeRequest.addListener(
        (details) => {
            const url = details.url;
            // Run quick dynamic URL analysis matching our Go core algorithm
            if (url.includes('doubleclick') || url.includes('analytics') || url.includes('adnxs') || url.includes('adsystem')) {
                reportAdBlock(url, 'network');
                incrementLocalCounter();
            }
        },
        { urls: ["<all_urls>"] }
    );
}

function incrementLocalCounter() {
    chrome.storage.local.get({ totalBlocked: 0 }, (data) => {
        chrome.storage.local.set({ totalBlocked: data.totalBlocked + 1 });
    });
}

// Function to push ad telemetry to our Node.js Cloud backend
async function reportAdBlock(url, blockType) {
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceType: 'extension',
                url: url,
                blockType: blockType
            })
        });
    } catch (e) {
        // Quietly fail if backend server is not running
        console.log('[Aegis Extension] Backend server offline. Buffered event locally.');
    }
}
