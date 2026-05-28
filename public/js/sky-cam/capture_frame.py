import os
import subprocess
import sys
import time
from urllib.request import Request, urlopen


BASE_DIR = os.path.dirname(__file__)
OUTPUT_PATH = os.path.join(BASE_DIR, "frame.jpg")

YOUTUBE_URL = "https://www.youtube.com/watch?v=UxUU3Fc1vBw"
YOUTUBE_THUMBNAIL_URL = "https://i.ytimg.com/vi/UxUU3Fc1vBw/maxresdefault_live.jpg"
MAX_ATTEMPTS = int(os.environ.get("SKYCAM_CAPTURE_ATTEMPTS", "3"))
YOUTUBE_COOKIES = os.environ.get("SKYCAM_YOUTUBE_COOKIES")
USE_THUMBNAIL_FALLBACK = os.environ.get("SKYCAM_USE_THUMBNAIL_FALLBACK", "1") == "1"
FORCE_THUMBNAIL = os.environ.get("SKYCAM_FORCE_THUMBNAIL") == "1"
YOUTUBE_CLIENT_STRATEGIES = [
    None,
    "youtube:player_client=web",
    "youtube:player_client=web_safari",
    "youtube:player_client=ios",
    "youtube:player_client=android",
    "youtube:player_client=tv_embedded",
    "youtube:player_client=default,ios",
]


def build_command(strategy):
    command = [
        sys.executable,
        "-m",
        "yt_dlp",
        "--no-warnings",
        "-g",
        YOUTUBE_URL
    ]

    if strategy:
        command[4:4] = ["--extractor-args", strategy]

    if YOUTUBE_COOKIES and os.path.exists(YOUTUBE_COOKIES):
        command[3:3] = ["--cookies", YOUTUBE_COOKIES]

    return command


def get_stream_url():
    failures = []

    for strategy in YOUTUBE_CLIENT_STRATEGIES:
        label = strategy or "yt-dlp default client"
        print(f"Resolving stream with {label}...")
        command = build_command(strategy)

        result = subprocess.run(
            command,
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            urls = [line.strip() for line in result.stdout.splitlines() if line.strip()]
            if urls:
                return urls[0]

            failures.append(f"{label}: yt-dlp returned no stream URLs")
            continue

        message = result.stderr.strip() or result.stdout.strip() or "unknown yt-dlp failure"
        failures.append(f"{label}: {message}")

    print("yt-dlp failed while resolving the YouTube livestream.")
    for failure in failures:
        print(failure)

    raise Exception("Failed to get stream URL")


def capture_thumbnail():
    print("Capturing YouTube live thumbnail fallback...")
    request = Request(
        YOUTUBE_THUMBNAIL_URL,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        }
    )

    with urlopen(request, timeout=20) as response:
        data = response.read()

    if len(data) < 10000:
        raise Exception("YouTube thumbnail fallback returned an unexpectedly small image")

    with open(OUTPUT_PATH, "wb") as f:
        f.write(data)

    print("Thumbnail fallback saved:", OUTPUT_PATH)


def capture_frame():
    last_error = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            if FORCE_THUMBNAIL:
                capture_thumbnail()
                return

            print(f"Getting stream URL, attempt {attempt} of {MAX_ATTEMPTS}...")
            stream_url = get_stream_url()

            print("Capturing frame...")

            subprocess.run([
                "ffmpeg",
                "-hide_banner",
                "-loglevel", "warning",
                "-y",
                "-i", stream_url,
                "-frames:v", "1",
                "-update", "1",
                "-q:v", "2",
                OUTPUT_PATH
            ], check=True)

            print("Frame saved:", OUTPUT_PATH)
            return

        except Exception as error:
            last_error = error
            print("Capture attempt failed:", error)
            if attempt < MAX_ATTEMPTS:
                time.sleep(10)

    if USE_THUMBNAIL_FALLBACK:
        capture_thumbnail()
        return

    raise last_error


if __name__ == "__main__":
    capture_frame()
