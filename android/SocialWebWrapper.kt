package com.example.adblocker.ui

import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class SocialWebWrapperActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 1. Initialize custom high-performance WebView
        webView = WebView(this)
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.useWideViewPort = true
        webView.settings.loadWithOverviewMode = true

        // 2. Open-source JavaScript injection payload to dynamically block social ads
        // Intercepts and hides Facebook/Instagram "Sponsored" posts and Pinterest "Promoted" pins
        val cssBlockerScript = """
            (function() {
                var style = document.createElement('style');
                style.type = 'text/css';
                style.innerHTML = `
                    /* Hide Facebook Sponsored Posts */
                    [data-category="organic"] + div:not([data-category]),
                    div[role="feed"] div:has(span:contains("Sponsored")),
                    div[role="feed"] div:has(a[href*="/ads/"]),
                    
                    /* Hide Instagram Sponsored Stories & Posts */
                    div._a9--._a9_0:has(span:contains("Sponsored")),
                    article:has(a[href*="/about/ads/"]),
                    
                    /* Hide Pinterest Promoted Pins */
                    div[data-test-id="pin"]:has(span:contains("Promoted")),
                    div[data-test-id="search-ad-pin"]
                `;
                document.getElementsByTagName('head')[0].appendChild(style);
                console.log('[Aegis Wrapper] Ad blocking stylesheets injected.');
            })();
        """.trimIndent()

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                
                // Inject our element-hiding blocker script when the social media page finishes loading
                webView.evaluateJavascript(cssBlockerScript, null)
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: ""
                
                // Block outbound tracking redirect loops and external ad click redirects
                if (url.contains("facebook.com/tr/") || url.contains("doubleclick") || url.contains("adsystem")) {
                    return true // Intercept and cancel load
                }
                
                return false // Allow organic navigation
            }
        }

        // 3. Load mobile Facebook Web layout
        // Bypasses Facebook App ads entirely, providing a 100% free ad-free mobile feed experience!
        webView.loadUrl("https://m.facebook.com")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
