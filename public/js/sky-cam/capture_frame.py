import os
import re
from urllib.request import Request, urlopen


BASE_DIR = os.path.dirname(__file__)
OUTPUT_PATH = os.path.join(BASE_DIR, "frame.jpg")

YOUTUBE_LIVE_URL = "https://www.youtube.com/@tballisty/live"
YOUTUBE_CANONICAL_PATTERN = re.compile(
    r'<link rel="canonical" href="https://www\.youtube\.com/watch\?v=([A-Za-z0-9_-]{11})"'
)
MIN_IMAGE_BYTES = 10000


def resolve_thumbnail_url():
    request = Request(
        YOUTUBE_LIVE_URL,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "text/html,application/xhtml+xml",
        },
    )

    with urlopen(request, timeout=20) as response:
        page = response.read().decode("utf-8", errors="replace")

    match = YOUTUBE_CANONICAL_PATTERN.search(page)
    if not match:
        raise RuntimeError("Could not resolve the current video from the permanent YouTube Live URL")

    return f"https://i.ytimg.com/vi/{match.group(1)}/maxresdefault_live.jpg"


def capture_frame():
    print("Capturing YouTube live thumbnail...")
    thumbnail_url = resolve_thumbnail_url()
    request = Request(
        thumbnail_url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        }
    )

    with urlopen(request, timeout=20) as response:
        content_type = response.headers.get("Content-Type", "")
        data = response.read()

    if "image" not in content_type.lower():
        raise Exception(f"YouTube thumbnail returned unexpected content type: {content_type}")

    if len(data) < MIN_IMAGE_BYTES:
        raise Exception("YouTube thumbnail returned an unexpectedly small image")

    with open(OUTPUT_PATH, "wb") as f:
        f.write(data)

    print("Thumbnail saved:", OUTPUT_PATH)


if __name__ == "__main__":
    capture_frame()
