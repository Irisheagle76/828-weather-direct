import subprocess
import time

INTERVAL = 60  # seconds between updates

while True:
    print("📷 Capturing frame...")

    subprocess.run([
        "python",
        "public/js/sky-cam/capture_frame.py"
    ])

    print("🧠 Running sky analysis...")

    subprocess.run([
        "python",
        "public/js/sky-cam/sky_sensor.py"
    ])

    print(f"⏱ Waiting {INTERVAL} seconds...\n")

    time.sleep(INTERVAL)