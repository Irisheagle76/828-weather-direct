import subprocess
import os

BASE_DIR = os.path.dirname(__file__)
OUTPUT_PATH = os.path.join(BASE_DIR, "frame.jpg")

YOUTUBE_URL = "https://www.youtube.com/watch?v=UxUU3Fc1vBw"


def get_stream_url():
    result = subprocess.run(
        ["python", "-m", "yt_dlp", "-g", YOUTUBE_URL],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        raise Exception("Failed to get stream URL")

    return result.stdout.strip()


def capture_frame():
    print("🎥 Getting stream URL...")
    stream_url = get_stream_url()

    print("📸 Capturing frame...")
    subprocess.run([
        "ffmpeg",
        "-y",
        "-i", stream_url,
        "-frames:v", "1",
        "-q:v", "2",
        OUTPUT_PATH
    ])

    print("✅ Frame saved:", OUTPUT_PATH)


if __name__ == "__main__":
    capture_frame()