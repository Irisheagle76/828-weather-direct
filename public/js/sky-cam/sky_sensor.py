import cv2
import numpy as np
import json
from datetime import datetime

# -------- CONFIG --------
IMAGE_PATH = "frame.jpg"
CROP_TOP_RATIO = 0.5   # keep top 50% (sky + ridges)
BRIGHTNESS_THRESHOLD = 145
# ------------------------

def load_and_crop(image_path):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError("Image not found")

    h, w, _ = img.shape
    cropped = img[0:int(h * CROP_TOP_RATIO), :]
    return cropped

def compute_metrics(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    brightness = np.mean(gray) / 255.0
    contrast = np.std(gray) / 255.0

    # Cloud cover (simple threshold)
    _, thresh = cv2.threshold(gray, BRIGHTNESS_THRESHOLD, 255, cv2.THRESH_BINARY)
    cloud_pixels = np.sum(thresh == 255)
    cloud_cover = int((cloud_pixels / thresh.size) * 100)

    # Visibility score (edge detection)
    h, w = gray.shape
    bands = [
        gray[int(h*0.6):h, :],
        gray[int(h*0.3):int(h*0.6), :],
        gray[0:int(h*0.3), :]
    ]

    visibility_score = 0

    for band in bands:
        edges = cv2.Canny(band, 50, 150)
        edge_density = np.sum(edges > 0) / edges.size
        if edge_density > 0.015:
            visibility_score += 1

    return {
        "cloudCoverWest": cloud_cover,
        "brightness": round(float(brightness), 2),
        "contrast": round(float(contrast), 2),
        "visibilityScore": visibility_score,
        "precipVisible": False
    }

def main():
    img = load_and_crop(IMAGE_PATH)
    metrics = compute_metrics(img)

    output = {
        "timestamp": datetime.now().isoformat(),
        "metrics": metrics
    }

    print(json.dumps(output, indent=2))

if __name__ == "__main__":
    main()
