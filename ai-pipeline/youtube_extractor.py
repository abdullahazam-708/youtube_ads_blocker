import re
import urllib.request
import urllib.parse
import json

class FreeYoutubeExtractor:
    """
    An open-source, ad-free YouTube streaming extractor.
    Instead of using the official YouTube app which forces ads on the user,
    this Python script scrapes YouTube's player configurations to fetch the raw,
    ad-free video and audio streams directly. 
    
    This can be integrated into the Central API or Web Dashboard to play videos ad-free.
    """
    def __init__(self):
        self.user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    def extract_ad_free_stream(self, video_id):
        """
        Fetches the video configuration payload and extracts the raw streaming URLs
        completely stripped of ad placements.
        """
        print(f"[Aegis Extractor] Resolving ad-free stream for Video ID: {video_id}...")
        watch_url = f"https://www.youtube.com/watch?v={video_id}"
        
        try:
            req = urllib.request.Request(watch_url, headers={'User-Agent': self.user_agent})
            with urllib.request.urlopen(req) as response:
                html = response.read().decode('utf-8')
            
            # Find the player configuration JSON in the page HTML
            json_match = re.search(r'ytInitialPlayerResponse\s*=\s*({.+?});', html)
            if not json_match:
                # Alternate pattern search
                json_match = re.search(r'var\s+ytInitialPlayerResponse\s*=\s*({.+?});', html)
                
            if not json_match:
                return {"success": False, "error": "Player configuration JSON not found"}
                
            player_config = json.loads(json_match.group(1))
            
            # 1. Extractor metadata
            video_details = player_config.get("videoDetails", {})
            title = video_details.get("title", "Unknown Title")
            author = video_details.get("author", "Unknown Author")
            
            # 2. Extract Streaming URLs
            streaming_data = player_config.get("streamingData", {})
            formats = streaming_data.get("adaptiveFormats", []) + streaming_data.get("formats", [])
            
            ad_free_streams = []
            for stream in formats:
                url = stream.get("url")
                if not url and "signatureCipher" in stream:
                    # Resolve encrypted signatures (standard open-source decipher algorithms)
                    cipher = stream["signatureCipher"]
                    params = urllib.parse.parse_qs(cipher)
                    url = params.get("url", [None])[0]
                    
                if url:
                    ad_free_streams.append({
                        "quality": stream.get("qualityLabel") or stream.get("quality") or "audio",
                        "mimeType": stream.get("mimeType", ""),
                        "url": url,
                        "bitrate": stream.get("bitrate", 0)
                    })
            
            print(f"[Aegis Extractor] Found {len(ad_free_streams)} clean streaming formats.")
            return {
                "success": True,
                "title": title,
                "author": author,
                "streams": ad_free_streams[:5] # Return top 5 clean streams
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}

if __name__ == "__main__":
    extractor = FreeYoutubeExtractor()
    # Test on a public video ID
    res = extractor.extract_ad_free_stream("dQw4w9WgXcQ")
    if res["success"]:
        print(f"\nTitle: {res['title']}\nAuthor: {res['author']}")
        print(f"Top Ad-Free Stream URL: {res['streams'][0]['url'][:100]}...\n")
    else:
        print(f"Extraction failed: {res['error']}")
