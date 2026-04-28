import subprocess
import time
import os

BASE_DIR = os.path.dirname(__file__)

CAPTURE = os.path.join(BASE_DIR, "js/sky-cam/capture_frame.py")
SENSOR = os.path.join(BASE_DIR, "js/sky-cam/sky_sensor.py")

INTERVAL = 300

print("🚀 Sky cam service started...\n")

while True:
    try:
        print("📷 Capturing frame...")
        subprocess.run(["python", CAPTURE], check=True)

        print("🧠 Running sky analysis...")
        subprocess.run(["python", SENSOR], check=True)

        print(f"⏱ Waiting {INTERVAL} seconds...\n")
        time.sleep(INTERVAL)

    except Exception as e:
        print("❌ Error:", e)
        print("🔁 Retrying in 60 seconds...\n")
        time.sleep(60)