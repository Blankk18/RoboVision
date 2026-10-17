"""main.py — Application entry point.

Usage:
    python main.py            Launch the GUI.
    python main.py --cli      Run the original command-line menu.
    python main.py --batch    Run batch pipeline and print results, then exit.
    python main.py --part N   Inspect part N (1–10) on the command line.

The GUI is the primary interface.  The CLI modes are kept for compatibility
with the original Stage 2 demonstration workflow.
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Ensure the project root is on the Python path so that src.* imports work
# whether the user launches from the project root or from a different directory.
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Set up logging early so all modules can use it.
log_dir = ROOT / "outputs"
log_dir.mkdir(parents=True, exist_ok=True)
import io as _io

# On Windows the default console encoding may be cp1252; use UTF-8 to be safe.
_stdout_handler = logging.StreamHandler(
    _io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    if hasattr(sys.stdout, "buffer") else sys.stdout
)
_stdout_handler.setFormatter(
    logging.Formatter("%(asctime)s  %(levelname)-8s  %(name)s - %(message)s")
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s - %(message)s",
    handlers=[
        _stdout_handler,
        logging.FileHandler(log_dir / "robot_vision.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)


def _check_dependencies() -> None:
    """Verify required packages are installed before importing any module."""
    missing = []
    for pkg in ["cv2", "numpy", "matplotlib"]:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    try:
        from PySide6 import QtCore  # noqa: F401
    except ImportError:
        missing.append("PySide6")
    if missing:
        print("ERROR: Missing required packages:", ", ".join(missing))
        print("Install them with:  pip install -r requirements.txt")
        sys.exit(1)


def _run_gui() -> None:
    """Launch the PySide6 desktop application."""
    from PySide6.QtWidgets import QApplication
    from PySide6.QtCore import Qt
    from src.ui import MainWindow
    from src.vision_pipeline import ensure_sample_images

    log.info("Starting Robot Vision GUI…")
    ensure_sample_images()

    app = QApplication.instance() or QApplication(sys.argv)
    app.setApplicationName("Robot Vision Inspection")
    app.setOrganizationName("SAKEC")

    window = MainWindow()
    window.show()
    log.info("GUI launched.")
    sys.exit(app.exec())


def _run_cli() -> None:
    """Command-line interactive menu (preserves Stage 2 workflow)."""
    from src.vision_pipeline import (
        ensure_sample_images, run_one_part, run_batch,
        save_summary_csv, save_summary_json,
    )
    from src.analytics import save_all_charts

    ensure_sample_images()
    print("\nAUTOMATED OBJECT DETECTION & QUALITY INSPECTION — ROBOT VISION")
    print("Educational simulation | synthetic test images | OpenCV pipeline")
    print("Sections:  1–10 = inspect a part,  B = batch,  Q = quit\n")

    while True:
        choice = input("Enter part number 1-10, B for batch, or Q to quit: ").strip().lower()
        if choice == "q":
            print("Output files saved to the outputs/ folder. Goodbye.")
            break
        if choice == "b":
            results = run_batch()
            save_summary_csv(results)
            save_summary_json(results)
            save_all_charts(results)
            passed = sum(1 for r in results if r["status"] == "PASS")
            print(f"\nBatch complete — PASS: {passed} / FAIL: {len(results) - passed}")
        else:
            try:
                part_id = int(choice)
                if 1 <= part_id <= 10:
                    r = run_one_part(part_id)
                    print(f"\nPART {r['part']:02d} — {r['status']}")
                    print(f"  Width:   {r['width_mm']:.2f} mm  ({'OK' if r['width_ok'] else 'FAIL'})")
                    print(f"  Height:  {r['height_mm']:.2f} mm  ({'OK' if r['height_ok'] else 'FAIL'})")
                    print(f"  Defects: {r['defect_percent']:.3f}%  ({'OK' if r['defect_ok'] else 'FAIL'})")
                    print(f"  Pick:    X={r['pick_x']:+.2f}  Y={r['pick_y']:+.2f}  Z={r['pick_z']:.1f} mm")
                    print(f"  Reason:  {r['failure_reason']}")
                else:
                    print("Enter 1–10, B, or Q.")
            except ValueError:
                print("Enter 1–10, B, or Q.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Robot Vision Quality Inspection — Stage 3"
    )
    parser.add_argument("--cli",    action="store_true", help="Run the command-line menu")
    parser.add_argument("--batch",  action="store_true", help="Run batch pipeline and exit")
    parser.add_argument("--part",   type=int,            help="Inspect one part (1–10) and exit")
    parser.add_argument("--benchmark", action="store_true", help="Run processing benchmark and exit")
    args = parser.parse_args()

    _check_dependencies()

    if args.benchmark:
        from src.vision_pipeline import ensure_sample_images, benchmark
        ensure_sample_images()
        print("Running benchmark (3 warm-up + 20 measured iterations on Part 3)…")
        bm = benchmark()
        print(f"  Average:  {bm['avg_ms']:.2f} ms/image")
        print(f"  Median:   {bm['median_ms']:.2f} ms/image")
        print(f"  Pipeline FPS (processing only): {bm['fps']:.1f}")
        print("Note: image loading, UI updates, and file I/O are NOT included.")
        return

    if args.part is not None:
        from src.vision_pipeline import ensure_sample_images, run_one_part
        ensure_sample_images()
        r = run_one_part(args.part)
        print(f"\nPART {r['part']:02d} — {r['status']}")
        print(f"  Width:   {r['width_mm']:.2f} mm  ({'OK' if r['width_ok'] else 'FAIL'})")
        print(f"  Height:  {r['height_mm']:.2f} mm  ({'OK' if r['height_ok'] else 'FAIL'})")
        print(f"  Defects: {r['defect_percent']:.3f}%  ({'OK' if r['defect_ok'] else 'FAIL'})")
        print(f"  Pick:    X={r['pick_x']:+.2f}  Y={r['pick_y']:+.2f}  Z={r['pick_z']:.1f} mm")
        print(f"  Reason:  {r['failure_reason']}")
        return

    if args.batch:
        from src.vision_pipeline import ensure_sample_images, run_batch, save_summary_csv, save_summary_json
        from src.analytics import save_all_charts
        ensure_sample_images()
        results = run_batch()
        save_summary_csv(results)
        save_summary_json(results)
        save_all_charts(results)
        passed = sum(1 for r in results if r["status"] == "PASS")
        print(f"\nBatch complete — PASS: {passed}  FAIL: {len(results) - passed}  "
              f"Total: {len(results)}")
        return

    if args.cli:
        _run_cli()
        return

    _run_gui()


if __name__ == "__main__":
    main()
