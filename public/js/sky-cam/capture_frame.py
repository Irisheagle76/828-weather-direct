import os
import subprocess
import sys
import time


BASE_DIR = os.path.dirname(__file__)
OUTPUT_PATH = os.path.join(BASE_DIR, "frame.jpg")

YOUTUBE_URL = "https://www.youtube.com/watch?v=UxUU3Fc1vBw"
MAX_ATTEMPTS = int(os.environ.get("SKYCAM_CAPTURE_ATTEMPTS", "3"))


def get_stream_url():
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "yt_dlp",
            "--no-warnings",
            "--extractor-args",
            "youtube:player_client=default,ios",
            "-g",
            YOUTUBE_URL
        ],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print("yt-dlp failed while resolving the YouTube livestream.")
        if result.stdout.strip():
            print("yt-dlp stdout:")
            print(result.stdout.strip())
        if result.stderr.strip():
            print("yt-dlp stderr:")
            print(result.stderr.strip())
        raise Exception("Failed to get stream URL")

    urls = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if not urls:
        raise Exception("yt-dlp did not return a stream URL")

    return urls[0]


def capture_frame():
    last_error = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
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

    raise last_error


if __name__ == "__main__":
    capture_frame()
