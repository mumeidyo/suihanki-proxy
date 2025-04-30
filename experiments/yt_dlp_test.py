#!/usr/bin/env python3
import json
import subprocess
import sys

def get_video_info(video_id):
    """yt-dlpを使ってYouTube動画情報を取得する"""
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    try:
        # yt-dlpコマンドを実行して情報を取得
        cmd = [
            "bin/yt-dlp", 
            "--dump-json",
            "--no-playlist",
            "--no-warnings",
            "--no-check-certificate",
            url
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"Error: {result.stderr}", file=sys.stderr)
            return None
            
        # JSONをパースして必要な情報を抽出
        info = json.loads(result.stdout)
        
        video_data = {
            "title": info.get("title", "Unknown Title"),
            "description": info.get("description", ""),
            "duration": info.get("duration", 0),
            "formats": [],
            "thumbnail": info.get("thumbnail", ""),
            "channel": info.get("channel", "Unknown Channel"),
            "view_count": info.get("view_count", 0),
        }
        
        # フォーマット情報を抽出
        for format_info in info.get("formats", []):
            if not format_info.get("url"):
                continue
                
            format_data = {
                "url": format_info.get("url", ""),
                "format_id": format_info.get("format_id", ""),
                "ext": format_info.get("ext", ""),
                "resolution": format_info.get("resolution", ""),
                "format_note": format_info.get("format_note", ""),
                "filesize": format_info.get("filesize", 0),
                "tbr": format_info.get("tbr", 0),
                "acodec": format_info.get("acodec", ""),
                "vcodec": format_info.get("vcodec", ""),
            }
            
            # ビデオコーデックとオーディオコーデックから形式を判断
            has_video = format_info.get("vcodec", "none") != "none"
            has_audio = format_info.get("acodec", "none") != "none"
            
            format_data["has_video"] = has_video
            format_data["has_audio"] = has_audio
            
            video_data["formats"].append(format_data)
        
        return video_data
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        return None

if __name__ == "__main__":
    # テスト用の動画ID (猫の動画など)
    video_id = "dQw4w9WgXcQ"  # かわいい猫の動画
    
    info = get_video_info(video_id)
    
    if info:
        print(f"Title: {info['title']}")
        print(f"Channel: {info['channel']}")
        print(f"Duration: {info['duration']} seconds")
        print(f"Thumbnail: {info['thumbnail']}")
        print(f"View Count: {info['view_count']}")
        
        print("\nAvailable formats:")
        for i, fmt in enumerate(info["formats"][:5]):  # 最初の5つのフォーマットのみ表示
            print(f"{i+1}. {fmt['format_note']} ({fmt['resolution']}) - Audio: {fmt['has_audio']}, Video: {fmt['has_video']}")
            print(f"   URL: {fmt['url'][:100]}...")  # URLは長いので一部だけ表示
            
        print(f"\nTotal ormats: {len(info['formats'])}")
    else:
        print("Failed to retrieve video information")
