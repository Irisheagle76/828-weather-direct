import subprocess
import time
import os

BASE_DIR = os.path.dirname(__file__)

CAPTURE = os.path.join(BASE_DIR, "js/sky-cam/capture_frame.py")
SENSOR = os.path.join(BASE_DIR, "js/sky-cam/sky_sensor.py")

INTERVAL = 300  # 5 minutes

print("🚀 Sky cam service started...\n")

while True:
    print("📷 Capturing frame...")
    subprocess.run(["python", CAPTURE])

    print("🧠 Running sky analysis...")
    subprocess.run(["python", SENSOR])

    print(f"⏱ Waiting {INTERVAL} seconds...\n")

    time.sleep(INTERVAL)