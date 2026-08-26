import os
from urllib.request import Request, urlopen


BASE_DIR = os.path.dirname(__file__)
OUTPUT_PATH = os.path.join(BASE_DIR, "frame.jpg")

YOUTUBE_THUMBNAIL_URL = "https://i.ytimg.com/vi/QWfo671Na08/maxresdefault_live.jpg"
MIN_IMAGE_BYTES = 10000


def capture_frame():
    print("Capturing YouTube live thumbnail...")
    request = Request(
        YOUTUBE_THUMBNAIL_URL,
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
