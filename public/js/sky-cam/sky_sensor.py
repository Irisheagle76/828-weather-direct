import cv2
import numpy as np
import json
import os
import tempfile
import urllib.request
from datetime import datetime, timezone

# -------- CONFIG --------
BASE_DIR = os.path.dirname(__file__)
IMAGE_PATH = os.path.join(BASE_DIR, "frame.jpg")
OUTPUT_PATH = os.path.join(BASE_DIR, "output.json")
SATELLITE_LOOP_URL = "https://cdn.star.nesdis.noaa.gov/WFO/gsp/GEOCOLOR/GOES19-GSP-GEOCOLOR-600x600.gif"

CROP_TOP_RATIO = 0.48  # top = sky, staying above most horizon/building clutter
# ------------------------


# ------------------------------------------------------------
# LOAD IMAGE
# ------------------------------------------------------------
def load_and_crop(image_path):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Image not found at {image_path}")

    h, w, _ = img.shape

    sky = img[0:int(h * CROP_TOP_RATIO), :]
    return sky, img  # return sky + full frame


# ------------------------------------------------------------
# MAIN METRICS
# ------------------------------------------------------------
def compute_metrics(sky_img, full_img):

    gray = cv2.cvtColor(sky_img, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(sky_img, cv2.COLOR_BGR2HSV)

    brightness = np.mean(gray) / 255.0
    contrast = np.std(gray) / 255.0

    is_night = brightness < 0.35

    # --------------------------------------------------------
    # ☁️ CLOUD DETECTION (color-aware)
    # --------------------------------------------------------
    b, g, r = cv2.split(sky_img)
    b_float = b.astype(np.float32)
    g_float = g.astype(np.float32)
    r_float = r.astype(np.float32)

    # Blue sky is open sky, not cloud. The previous adaptive threshold often
    # turned smooth blue sky white and counted it as cloud cover.
    blue_sky_mask = (
        (b_float > r_float * 1.04) &
        (b_float > g_float * 0.98) &
        (hsv[:, :, 1] > 22) &
        (hsv[:, :, 2] > 65)
    )

    bright_low_saturation_mask = (
        (hsv[:, :, 1] < 75) &
        (hsv[:, :, 2] > 125) &
        (r_float > b_float * 0.82) &
        (g_float > b_float * 0.82)
    )

    warm_gray_cloud_mask = (
        (r_float > b_float * 0.94) &
        (g_float > b_float * 0.88) &
        (gray > 120) &
        (hsv[:, :, 1] < 95)
    )

    cloud_mask = (bright_low_saturation_mask | warm_gray_cloud_mask) & ~blue_sky_mask
    valid_sky_mask = blue_sky_mask | cloud_mask

    valid_sky_pixels = np.sum(valid_sky_mask)
    if valid_sky_pixels > (valid_sky_mask.size * 0.25):
        cloud_cover = int(round((np.sum(cloud_mask) / valid_sky_pixels) * 100))
    else:
        cloud_cover = 0

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
        density = np.sum(edges > 0) / edges.size

        if density > 0.01:
            visibility_score += 1

    # --------------------------------------------------------
    # 🌈 SKY COLOR (BLUE SIGNAL)
    # --------------------------------------------------------
    if np.any(blue_sky_mask):
        blue_ratio = np.mean(b_float[blue_sky_mask]) / (np.mean(r_float[blue_sky_mask]) + 1e-5)
    else:
        blue_ratio = np.mean(b) / (np.mean(r) + 1e-5)
    sky_blue_signal = round(float(blue_ratio), 2)

    obscured_view = (
        visibility_score <= 2 and
        contrast <= 0.08 and
        brightness < 0.60
    )

    # --------------------------------------------------------
    # ☀️ SUNLIGHT DETECTION (GROUND-BASED)
    # --------------------------------------------------------
    full_gray = cv2.cvtColor(full_img, cv2.COLOR_BGR2GRAY)

    fh, fw = full_gray.shape
    ground = full_gray[int(fh * 0.5):fh, :]

    ground_brightness = np.mean(ground) / 255.0
    ground_contrast = np.std(ground) / 255.0
    soft_shadow_signal = contrast < 0.09 or (ground_contrast < 0.18 and contrast < 0.12)

    # more stable blend (less flicker)
    sunlight_strength = (ground_brightness * 0.6) + (ground_contrast * 0.4)

    if sunlight_strength > 0.12:
        sunlight_level = "strong"
    elif sunlight_strength > 0.07:
        sunlight_level = "moderate"
    else:
        sunlight_level = "weak"

    sunlight_detected = sunlight_strength > 0.07

    if obscured_view:
        sunlight_detected = False
        sunlight_level = "weak"

    # --------------------------------------------------------
    # 🌙 NIGHT HANDLING
    # --------------------------------------------------------
    if is_night:
        cloud_cover = None
        visibility_score = None
        sunlight_detected = False
        sunlight_level = "none"
        sky_blue_signal = None
        mode = "night"
    else:
        mode = "day"

    filtered_sunshine_signal = (
        mode == "day" and
        sunlight_detected and
        soft_shadow_signal and
        cloud_cover is not None and
        cloud_cover >= 20
    )

    # --------------------------------------------------------
    # OUTPUT
    # --------------------------------------------------------
    return {
    "cloudCoverWest": int(cloud_cover) if cloud_cover is not None else None,
    "brightness": float(round(brightness, 2)) if brightness is not None else None,
    "contrast": float(round(contrast, 2)) if contrast is not None else None,
    "visibilityScore": int(visibility_score) if visibility_score is not None else None,

    "sunlightDetected": bool(sunlight_detected),
    "sunlightStrength": float(round(sunlight_strength, 2)),
    "sunlightLevel": str(sunlight_level),
    "groundBrightness": float(round(ground_brightness, 2)),
    "groundContrast": float(round(ground_contrast, 2)),
    "softShadowSignal": bool(soft_shadow_signal),
    "filteredSunshineSignal": bool(filtered_sunshine_signal),

    "skyBlueSignal": float(sky_blue_signal) if sky_blue_signal is not None else None,
    "obscuredView": bool(obscured_view),

    "precipVisible": False,
    "mode": str(mode)
}


def analyze_satellite_high_clouds():
    tmp_path = None
    try:
        with urllib.request.urlopen(SATELLITE_LOOP_URL, timeout=15) as response:
            gif_bytes = response.read()

        fd, tmp_path = tempfile.mkstemp(suffix=".gif")
        os.close(fd)
        with open(tmp_path, "wb") as f:
            f.write(gif_bytes)

        cap = cv2.VideoCapture(tmp_path)
        frames = []
        while len(frames) < 10:
            ok, frame = cap.read()
            if not ok:
                break
            frames.append(frame)
        cap.release()

        if not frames:
            return {
                "satelliteHighCloudSignal": False,
                "satelliteCloudMotionSignal": False,
                "satelliteCloudFraction": None,
                "satelliteMotion": None
            }

        masks = []
        for frame in frames[-6:]:
            h, w, _ = frame.shape
            # Western NC / Asheville-area approximation within the GSP satellite loop.
            roi = frame[int(h * 0.28):int(h * 0.62), int(w * 0.12):int(w * 0.54)]
            hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            sat = hsv[:, :, 1]

            high_cloud_mask = (gray > 135) & (sat < 95)
            masks.append(high_cloud_mask.astype(np.uint8))

        cloud_fraction = float(np.mean(masks[-1]))
        if len(masks) > 1:
            motion = float(np.mean([
                np.mean(cv2.absdiff(masks[i], masks[i - 1]))
                for i in range(1, len(masks))
            ]))
        else:
            motion = 0.0

        return {
            "satelliteHighCloudSignal": bool(cloud_fraction >= 0.18),
            "satelliteCloudMotionSignal": bool(cloud_fraction >= 0.12 and motion >= 0.015),
            "satelliteCloudFraction": float(round(cloud_fraction, 2)),
            "satelliteMotion": float(round(motion, 2))
        }
    except Exception:
        return {
            "satelliteHighCloudSignal": False,
            "satelliteCloudMotionSignal": False,
            "satelliteCloudFraction": None,
            "satelliteMotion": None
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

# ------------------------------------------------------------
# 📈 TREND
# ------------------------------------------------------------
def compute_trend(current, previous):
    if not previous:
        return None

    def trend(now, prev, threshold):
        if now is None or prev is None:
            return "unknown"

        delta = now - prev

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
        metrics.update(analyze_satellite_high_clouds())

        previous = load_previous()
        trend = compute_trend(metrics, previous)

        output = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
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
