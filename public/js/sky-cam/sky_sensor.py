import cv2
import numpy as np
import json
import os
from datetime import datetime

# -------- CONFIG --------
BASE_DIR = os.path.dirname(__file__)
IMAGE_PATH = os.path.join(BASE_DIR, "frame.jpg")
OUTPUT_PATH = os.path.join(BASE_DIR, "output.json")

CROP_TOP_RATIO = 0.5  # top half = sky
# ------------------------


# ------------------------------------------------------------
# LOAD IMAGE
# ------------------------------------------------------------
def load_and_crop(image_path):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Image not found at {image_path}")

    h, w, _ = img.shape
    return img[0:int(h * CROP_TOP_RATIO), :], img  # return BOTH sky + full image


# ------------------------------------------------------------
# MAIN METRICS
# ------------------------------------------------------------
def compute_metrics(sky_img, full_img):

    gray = cv2.cvtColor(sky_img, cv2.COLOR_BGR2GRAY)

    brightness = np.mean(gray) / 255.0
    contrast = np.std(gray) / 255.0

    is_night = brightness < 0.35

    # --------------------------------------------------------
    # ☁️ CLOUD DETECTION (adaptive)
    # --------------------------------------------------------
    gray_blur = cv2.GaussianBlur(gray, (5, 5), 0)

    thresh = cv2.adaptiveThreshold(
        gray_blur,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        11,
        2
    )

    cloud_pixels = np.sum(thresh == 255)
    cloud_cover = int((cloud_pixels / thresh.size) * 100)

    # --------------------------------------------------------
    # 🌄 VISIBILITY (ridge detection)
    # --------------------------------------------------------
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

        if edge_density > 0.01:
            visibility_score += 1

    # --------------------------------------------------------
    # ☀️ SUNLIGHT DETECTION (NEW)
    # --------------------------------------------------------
    full_gray = cv2.cvtColor(full_img, cv2.COLOR_BGR2GRAY)

    fh, fw = full_gray.shape
    ground = full_gray[int(fh * 0.5):fh, :]  # bottom half

    ground_brightness = np.mean(ground) / 255.0
    ground_contrast = np.std(ground) / 255.0

    sunlight_strength = ground_brightness * ground_contrast

    if sunlight_strength > 0.12:
        sunlight_level = "strong"
    elif sunlight_strength > 0.07:
        sunlight_level = "moderate"
    else:
        sunlight_level = "weak"

    sunlight_detected = sunlight_strength > 0.07

    # --------------------------------------------------------
    # 🌙 NIGHT MODE HANDLING
    # --------------------------------------------------------
    if is_night:
        cloud_cover = None
        visibility_score = None
        sunlight_detected = False
        sunlight_level = "none"
        mode = "night"
    else:
        mode = "day"

    # --------------------------------------------------------
    # OUTPUT
    # --------------------------------------------------------
    return {
        "cloudCoverWest": cloud_cover,
        "brightness": round(float(brightness), 2),
        "contrast": round(float(contrast), 2),
        "visibilityScore": visibility_score,

        "sunlightDetected": sunlight_detected,
        "sunlightStrength": round(float(sunlight_strength), 2),
        "sunlightLevel": sunlight_level,

        "precipVisible": False,
        "mode": mode
    }


# ------------------------------------------------------------
# 📈 TREND LOGIC
# ------------------------------------------------------------
def compute_trend(current, previous):
    if not previous:
        return None

    def trend(val_now, val_prev, threshold):
        if val_now is None or val_prev is None:
            return "unknown"

        delta = val_now - val_prev

        if delta > threshold:
            return "increasing"
        elif delta < -threshold:
            return "decreasing"
        else:
            return "steady"

    cloud_trend = trend(
        current["cloudCoverWest"],
        previous["metrics"].get("cloudCoverWest"),
        5
    )

    brightness_trend = trend(
        current["brightness"],
        previous["metrics"].get("brightness"),
        0.03
    )

    if cloud_trend == "decreasing" and brightness_trend == "increasing":
        overall = "improving"
    elif cloud_trend == "increasing" and brightness_trend == "decreasing":
        overall = "deteriorating"
    else:
        overall = "steady"

    return {
        "cloudTrend": cloud_trend,
        "brightnessTrend": brightness_trend,
        "overallTrend": overall
    }


# ------------------------------------------------------------
# LOAD PREVIOUS
# ------------------------------------------------------------
def load_previous():
    if not os.path.exists(OUTPUT_PATH):
        return None

    try:
        with open(OUTPUT_PATH, "r") as f:
            return json.load(f)
    except:
        return None


# ------------------------------------------------------------
# MAIN
# ------------------------------------------------------------
def main():
    try:
        sky_img, full_img = load_and_crop(IMAGE_PATH)

        metrics = compute_metrics(sky_img, full_img)

        previous = load_previous()
        trend = compute_trend(metrics, previous)

        output = {
            "timestamp": datetime.now().isoformat(),
            "metrics": metrics,
            "trend": trend
        }

        print(json.dumps(output, indent=2))

        with open(OUTPUT_PATH, "w") as f:
            json.dump(output, f, indent=2)

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()