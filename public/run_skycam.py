import os
import subprocess
import sys
import time


BASE_DIR = os.path.dirname(__file__)

CAPTURE = os.path.join(BASE_DIR, "js/sky-cam/capture_frame.py")
SENSOR = os.path.join(BASE_DIR, "js/sky-cam/sky_sensor.py")

INTERVAL = int(os.environ.get("SKYCAM_INTERVAL_SECONDS", "300"))


def run_cycle():
    subprocess.run([sys.executable, CAPTURE], check=True)
    subprocess.run([sys.executable, SENSOR], check=True)


def run_service():
    print("Sky cam service running...\n")

    while True:
        try:
            start = time.time()

            run_cycle()

            elapsed = time.time() - start
            time.sleep(max(0, INTERVAL - elapsed))

        except Exception as e:
            print("Error:", e)
            time.sleep(60)


def main():
    run_once = "--once" in sys.argv or os.environ.get("SKYCAM_RUN_ONCE") == "1"

    try:
        if run_once:
            print("Sky cam one-shot capture running...")
            run_cycle()
            print("Sky cam one-shot capture complete.")
            return
    except Exception as e:
        print("Error:", e)
        raise

    run_service()


if __name__ == "__main__":
    main()
