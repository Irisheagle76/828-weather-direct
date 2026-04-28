# run_skycam.py

import subprocess
import time
import os

BASE_DIR = os.path.dirname(__file__)

CAPTURE = os.path.join(BASE_DIR, "js/sky-cam/capture_frame.py")
SENSOR = os.path.join(BASE_DIR, "js/sky-cam/sky_sensor.py")

INTERVAL = 300

print("🚀 Sky cam service running...\n")

while True:
    try:
        start = time.time()

        subprocess.run(["python", CAPTURE], check=True)
        subprocess.run(["python", SENSOR], check=True)

        elapsed = time.time() - start
        time.sleep(max(0, INTERVAL - elapsed))

    except Exception as e:
        print("❌ Error:", e)
        time.sleep(60)