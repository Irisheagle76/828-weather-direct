import os
import json
import subprocess
import sys
import time
from datetime import datetime, timezone


BASE_DIR = os.path.dirname(__file__)

CAPTURE = os.path.join(BASE_DIR, "js/sky-cam/capture_frame.py")
SENSOR = os.path.join(BASE_DIR, "js/sky-cam/sky_sensor.py")
OUTPUT_JSON = os.path.join(BASE_DIR, "js/sky-cam/output.json")

INTERVAL = int(os.environ.get("SKYCAM_INTERVAL_SECONDS", "300"))
ALLOW_STALE_ON_ERROR = os.environ.get("SKYCAM_ALLOW_STALE_ON_ERROR") == "1"


def run_cycle():
    subprocess.run([sys.executable, CAPTURE], check=True)
    subprocess.run([sys.executable, SENSOR], check=True)


def write_stale_status(error):
    previous = {}

    if os.path.exists(OUTPUT_JSON):
        try:
            with open(OUTPUT_JSON, "r") as f:
                previous = json.load(f)
        except Exception:
            previous = {}

    output = {
        **previous,
        "lastAttemptedCapture": datetime.now(timezone.utc).isoformat(),
        "captureStatus": "stale",
        "captureError": str(error),
    }

    with open(OUTPUT_JSON, "w") as f:
        json.dump(output, f, indent=2)


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
            try:
                run_cycle()
                print("Sky cam one-shot capture complete.")
            except Exception as e:
                if not ALLOW_STALE_ON_ERROR:
                    raise
                print("Sky cam capture failed; preserving last good frame.")
                write_stale_status(e)
            return
    except Exception as e:
        print("Error:", e)
        raise

    run_service()


if __name__ == "__main__":
    main()
