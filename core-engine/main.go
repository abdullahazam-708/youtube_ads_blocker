package main

import (
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

// List of known bad sub-strings (used as static fallback rules)
var blacklist = []string{
	"doubleclick.net",
	"googlesyndication.com",
	"google-analytics.com",
	"amazon-adsystem.com",
	"adnxs.com",
	"facebook.com/tr",
	"analytics.tiktok.com",
	"telemetry.reddit.com",
}

// Simple heuristic character-based entropy score to simulate local ML-based URL checking in Go
func getUrlAnomalyScore(url string) float64 {
	// Real-world dynamic URL detection (Go-native simulation of our character bag-of-words model)
	// Higher numbers of parameters and random sub-tokens trigger higher anomaly index
	score := 0.0
	if strings.Contains(url, "?") {
		score += 0.25
	}
	params := strings.Count(url, "&")
	score += float64(params) * 0.15

	// Check lengths of sub-tokens (often randomized tracking tokens have lengths > 32 characters)
	tokens := strings.Split(url, "/")
	for _, token := range tokens {
		if len(token) > 32 {
			score += 0.35
		}
	}
	return score
}

func isAdOrTracker(url string) bool {
	// 1. Static rule matching
	lowerURL := strings.ToLower(url)
	for _, domain := range blacklist {
		if strings.Contains(lowerURL, domain) {
			return true
		}
	}

	// 2. Dynamic heuristic/ML-inspired rule matching
	score := getUrlAnomalyScore(lowerURL)
	if score > 0.85 {
		return true
	}

	return false
}

// Core Proxy Handler
type ProxyHandler struct{}

func (p *ProxyHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	requestURL := req.URL.String()
	if req.URL.Host == "" {
		requestURL = req.Host + req.URL.Path
	}

	// Check if this connection matches our blocker
	if isAdOrTracker(requestURL) {
		fmt.Printf("[\033[31mBLOCKED\033[0m] %s %s (Dynamic AI Score: %0.2f)\n", req.Method, requestURL, getUrlAnomalyScore(requestURL))
		
		// Serve empty response or 204 No Content for pixels / scripts
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// If clean, log and forward request
	fmt.Printf("[\033[32mPASSED\033[0m]  %s %s\n", req.Method, requestURL)

	if req.Method == http.MethodConnect {
		handleTunneling(w, req)
	} else {
		handleHTTP(w, req)
	}
}

func handleHTTP(w http.ResponseWriter, req *http.Request) {
	// Standard forwarding logic
	transport := http.DefaultTransport
	outReq := new(http.Request)
	*outReq = *req

	// Set headers
	outReq.RequestURI = ""
	resp, err := transport.RoundTrip(outReq)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Copy headers
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

func handleTunneling(w http.ResponseWriter, req *http.Request) {
	// Establish raw TCP tunnel for HTTPS
	destConn, err := net.DialTimeout("tcp", req.Host, 10*time.Second)
	if err != nil {
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}
	w.WriteHeader(http.StatusOK)
	
	hijacker, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "Hijacking not supported", http.StatusInternalServerError)
		return
	}
	
	clientConn, _, err := hijacker.Hijack()
	if err != nil {
		destConn.Close()
		return
	}

	// Double pipe (bidirectional channel bridging)
	go transfer(destConn, clientConn)
	go transfer(clientConn, destConn)
}

func transfer(destination io.WriteCloser, source io.ReadCloser) {
	defer destination.Close()
	defer source.Close()
	io.Copy(destination, source)
}

func main() {
	port := ":8080"
	fmt.Println(`
    ___                _        _   ___   ____  _     _      _     _ 
   / _ \              (_)      / | / _ \ / ___|| |   (_)    | |   | |
  / /_\ \ ___  __ _ _  _  ___  | || | | | |    | |___ _  ___| | __| |
  |  _  |/ _ \/ _' || | |/ __| | || | | | |    |  _  | |/ _ \ |/ _' |
  | | | |  __/ (_| || | |\__ \ | || |_| | |___ | | | | |  __/ | (_| |
  \_| |_/\___|\__, ||_|_||___/ |_| \___/ \____||_| |_|_|\___|_|\__,_|
              |___/                                                  
  `)
	fmt.Printf("[Aegis Core] Starting High-Performance AI Blocker Proxy on port %s...\n", port)
	fmt.Println("[Aegis Core] Proxy intercept mode is fully armed and running.")
	
	server := &http.Server{
		Addr: port,
		Handler: &ProxyHandler{},
		TLSConfig: &tls.Config{InsecureSkipVerify: true},
	}
	
	err := server.ListenAndServe()
	if err != nil {
		fmt.Printf("[Aegis Core] Proxy Server Error: %v\n", err)
	}
}
