import subprocess
import os

YOUTUBE_URL = "https://www.youtube.com/watch?v=UxUU3Fc1vBw"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "frame.jpg")

def get_stream_url():
    result = subprocess.run(
        ["python", "-m", "yt_dlp", "-g", YOUTUBE_URL],
        capture_output=True,
        text=True
    )
    return result.stdout.splitlines()[0]

def capture_frame():
    stream_url = get_stream_url()

subprocess.run([
    "ffmpeg",
    "-y",
    "-i", stream_url,
    "-frames:v", "1",
    "-update", "1",
    OUTPUT_PATH
])

if __name__ == "__main__":
    capture_frame()