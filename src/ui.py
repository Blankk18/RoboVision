"""ui.py — PySide6 desktop application for the Robot Vision Micro-Project.

Layout:
  Left sidebar navigation → Main content area (stacked pages).

Pages:
  A. Overview          – Project info, statistics, quick-launch buttons.
  B. Inspect Component – Per-part pipeline images + result panel.
  C. Batch Analytics   – Results table, five charts, export controls.
  D. How It Works      – Educational explanation of the pipeline.
  E. Demo Mode         – Full-screen recording-friendly presentation.

All measurements come from the actual vision pipeline; nothing is hardcoded.
"""
from __future__ import annotations

import io
import logging
import sys
import threading
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np

# PySide6
from PySide6.QtCore import (
    Qt, QSize, QThread, Signal, QTimer, QObject, Slot,
)
from PySide6.QtGui import (
    QColor, QFont, QFontDatabase, QImage, QPixmap, QPalette,
    QAction, QIcon,
)
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QStackedWidget,
    QVBoxLayout, QHBoxLayout, QGridLayout, QScrollArea,
    QLabel, QPushButton, QComboBox, QTableWidget, QTableWidgetItem,
    QHeaderView, QProgressBar, QFrame, QSizePolicy, QSplitter,
    QMessageBox, QFileDialog, QTextEdit, QGroupBox, QSpacerItem,
    QTabWidget,
)

# Matplotlib embedding
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg as FigureCanvas

# Project modules
from src import vision_pipeline as vp
from src import analytics

log = logging.getLogger(__name__)

# ── Colour palette (engineering software, clean light theme) ──────────────────
C_NAVY        = "#0d2240"   # primary headings / sidebar background
C_SIDEBAR_TXT = "#c8d8f0"   # sidebar text on navy
C_SIDEBAR_SEL = "#1c4e8a"   # selected nav item
C_ACCENT      = "#1c4e8a"   # blue accent buttons
C_ACCENT_HOVER= "#1560b8"
C_PASS        = "#2a9d5c"   # green
C_FAIL        = "#c0392b"   # red
C_BG          = "#f4f6fa"   # main content background
C_CARD        = "#ffffff"   # card / panel background
C_BORDER      = "#d0d8e8"   # subtle separator
C_TEXT        = "#1a1a2e"   # primary text
C_TEXT_MUTED  = "#5a6a7e"   # secondary text
C_WARN        = "#d4850a"   # orange warning

FONT_TITLE    = ("Segoe UI", 16, QFont.Weight.Bold)
FONT_SUBTITLE = ("Segoe UI", 10, QFont.Weight.Normal)
FONT_BODY     = ("Segoe UI",  9, QFont.Weight.Normal)
FONT_MONO     = ("Consolas",  9, QFont.Weight.Normal)
FONT_CARD_HDR = ("Segoe UI", 10, QFont.Weight.Bold)


# ── Utility helpers ────────────────────────────────────────────────────────────

def _qfont(family: str, size: int, weight: QFont.Weight = QFont.Weight.Normal) -> QFont:
    f = QFont(family, size)
    f.setWeight(weight)
    return f


def _label(text: str = "", family: str = "Segoe UI", size: int = 9,
           weight: QFont.Weight = QFont.Weight.Normal,
           color: str = C_TEXT, wrap: bool = False) -> QLabel:
    lbl = QLabel(text)
    lbl.setFont(_qfont(family, size, weight))
    lbl.setStyleSheet(f"color:{color};background:transparent;")
    if wrap:
        lbl.setWordWrap(True)
    return lbl


def _button(text: str, bg: str = C_ACCENT, fg: str = "#ffffff",
            height: int = 34, bold: bool = True) -> QPushButton:
    btn = QPushButton(text)
    btn.setFixedHeight(height)
    w = QFont.Weight.Bold if bold else QFont.Weight.Normal
    btn.setFont(_qfont("Segoe UI", 9, w))
    btn.setStyleSheet(f"""
        QPushButton {{
            background-color: {bg};
            color: {fg};
            border: none;
            border-radius: 5px;
            padding: 0 16px;
        }}
        QPushButton:hover {{
            background-color: {C_ACCENT_HOVER if bg == C_ACCENT else bg};
            opacity: 0.9;
        }}
        QPushButton:pressed {{
            background-color: #0d3370;
        }}
        QPushButton:disabled {{
            background-color: #b0bcc8;
            color: #7a8898;
        }}
    """)
    return btn


def _card(parent: QWidget | None = None) -> QFrame:
    """A white rounded card with subtle border."""
    card = QFrame(parent)
    card.setStyleSheet(f"""
        QFrame {{
            background-color: {C_CARD};
            border: 1px solid {C_BORDER};
            border-radius: 8px;
        }}
    """)
    return card


def _separator(orientation: Qt.Orientation = Qt.Orientation.Horizontal) -> QFrame:
    line = QFrame()
    if orientation == Qt.Orientation.Horizontal:
        line.setFrameShape(QFrame.Shape.HLine)
    else:
        line.setFrameShape(QFrame.Shape.VLine)
    line.setStyleSheet(f"color:{C_BORDER};")
    return line


def _numpy_to_pixmap(img: np.ndarray, max_w: int = 320, max_h: int = 280) -> QPixmap:
    """Convert a NumPy image (grayscale or BGR) to a QPixmap, scaled to fit."""
    if img is None:
        return QPixmap()
    if img.ndim == 2:
        # Grayscale → QImage
        h, w = img.shape
        qimg = QImage(img.data, w, h, w, QImage.Format.Format_Grayscale8)
    else:
        # BGR → RGB
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        h, w, ch = rgb.shape
        qimg = QImage(rgb.data, w, h, w * ch, QImage.Format.Format_RGB888)
    pix = QPixmap.fromImage(qimg)
    return pix.scaled(max_w, max_h, Qt.AspectRatioMode.KeepAspectRatio,
                      Qt.TransformationMode.SmoothTransformation)


def _status_badge(status: str) -> QLabel:
    lbl = QLabel(f"  {status}  ")
    lbl.setFont(_qfont("Segoe UI", 14, QFont.Weight.Bold))
    bg = C_PASS if status == "PASS" else C_FAIL
    lbl.setStyleSheet(f"""
        QLabel {{
            background-color: {bg};
            color: #ffffff;
            border-radius: 6px;
            padding: 6px 18px;
        }}
    """)
    lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
    return lbl


# ── Worker thread helpers ─────────────────────────────────────────────────────

class _InspectWorker(QObject):
    finished = Signal(dict)
    error = Signal(str)

    def __init__(self, part_id: int) -> None:
        super().__init__()
        self.part_id = part_id

    @Slot()
    def run(self) -> None:
        try:
            result = vp.run_one_part(self.part_id)
            self.finished.emit(result)
        except Exception as exc:
            log.exception("Inspection error for part %d", self.part_id)
            self.error.emit(str(exc))


class _BatchWorker(QObject):
    progress = Signal(int, int)   # (done, total)
    finished = Signal(list)
    error = Signal(str)

    @Slot()
    def run(self) -> None:
        try:
            results: list[dict[str, Any]] = []
            total = len(vp.TEST_PARTS)
            for i, part in enumerate(vp.TEST_PARTS):
                self.progress.emit(i + 1, total)
                img = vp.DATA_DIR / f"part_{part.part_id:02d}.png"
                if not img.exists():
                    vp.generate_synthetic_part(part)
                r = vp.inspect_image(img, part)
                results.append(r)
            self.finished.emit(results)
        except Exception as exc:
            log.exception("Batch processing error")
            self.error.emit(str(exc))


class _BenchmarkWorker(QObject):
    finished = Signal(dict)
    error = Signal(str)

    @Slot()
    def run(self) -> None:
        try:
            result = vp.benchmark()
            self.finished.emit(result)
        except Exception as exc:
            self.error.emit(str(exc))


# ── Sidebar navigation ────────────────────────────────────────────────────────

class _NavButton(QPushButton):
    def __init__(self, text: str) -> None:
        super().__init__(text)
        self.setCheckable(True)
        self.setFont(_qfont("Segoe UI", 9, QFont.Weight.Normal))
        self.setFixedHeight(40)
        self.setStyleSheet(f"""
            QPushButton {{
                background: transparent;
                color: {C_SIDEBAR_TXT};
                border: none;
                border-radius: 4px;
                text-align: left;
                padding-left: 18px;
            }}
            QPushButton:hover {{
                background: rgba(255,255,255,0.10);
            }}
            QPushButton:checked {{
                background: {C_SIDEBAR_SEL};
                color: #ffffff;
                font-weight: bold;
            }}
        """)


class Sidebar(QWidget):
    page_changed = Signal(int)

    ITEMS = [
        ("Overview",           0),
        ("Inspect Component",  1),
        ("Batch Analytics",    2),
        ("How It Works",       3),
        ("Demo Mode",          4),
    ]

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setFixedWidth(185)
        self.setStyleSheet(f"background-color:{C_NAVY};")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 16, 8, 16)
        layout.setSpacing(4)

        # Logo / title block.
        logo_lbl = _label("ROBOT VISION", "Segoe UI", 11, QFont.Weight.Bold, "#ffffff")
        logo_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(logo_lbl)
        sub_lbl = _label("Quality Inspection", "Segoe UI", 8,
                         color=C_SIDEBAR_TXT)
        sub_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(sub_lbl)
        layout.addWidget(_separator())

        self._buttons: list[_NavButton] = []
        for text, idx in self.ITEMS:
            btn = _NavButton(text)
            btn.clicked.connect(lambda checked, i=idx: self._select(i))
            layout.addWidget(btn)
            self._buttons.append(btn)

        layout.addStretch()

        # Simulation mode badge at bottom.
        sim_lbl = QLabel("SIMULATION MODE\nSYNTHETIC IMAGES")
        sim_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        sim_lbl.setFont(_qfont("Segoe UI", 7, QFont.Weight.Bold))
        sim_lbl.setStyleSheet("""
            QLabel {
                color: #f0c040;
                background: rgba(240,192,64,0.12);
                border: 1px solid #f0c040;
                border-radius: 4px;
                padding: 4px;
            }
        """)
        layout.addWidget(sim_lbl)
        self._select(0)

    def _select(self, idx: int) -> None:
        for i, btn in enumerate(self._buttons):
            btn.setChecked(i == idx)
        self.page_changed.emit(idx)

    def go_to(self, idx: int) -> None:
        self._select(idx)


# ── Page A — Overview ─────────────────────────────────────────────────────────

class OverviewPage(QWidget):
    run_inspection_requested = Signal()
    run_batch_requested = Signal()
    demo_requested = Signal()

    def __init__(self) -> None:
        super().__init__()
        self.setStyleSheet(f"background:{C_BG};")
        root = QVBoxLayout(self)
        root.setContentsMargins(28, 24, 28, 24)
        root.setSpacing(16)

        # Title block.
        title = _label("AUTOMATED OBJECT DETECTION & QUALITY INSPECTION",
                       "Segoe UI", 16, QFont.Weight.Bold, C_NAVY)
        title.setWordWrap(True)
        root.addWidget(title)

        sub = _label("Robot Vision Micro-Project | Stage 3 Comprehensive Review",
                     "Segoe UI", 10, color=C_TEXT_MUTED)
        root.addWidget(sub)

        sim_banner = QLabel(
            "⚠  SIMULATION MODE — SYNTHETIC TEST IMAGES  "
            "  This application does not control a physical robot or live camera."
        )
        sim_banner.setFont(_qfont("Segoe UI", 9, QFont.Weight.Bold))
        sim_banner.setStyleSheet(f"""
            QLabel {{
                background:{C_WARN};
                color:#ffffff;
                border-radius:5px;
                padding:8px 14px;
            }}
        """)
        sim_banner.setWordWrap(True)
        root.addWidget(sim_banner)

        # Info row: project details + action buttons side by side.
        row = QHBoxLayout()
        row.setSpacing(16)

        # Project details card.
        details_card = _card()
        dl = QVBoxLayout(details_card)
        dl.setContentsMargins(16, 14, 16, 14)
        dl.setSpacing(6)
        dl.addWidget(_label("Project Information", "Segoe UI", 10,
                            QFont.Weight.Bold, C_NAVY))
        dl.addWidget(_separator())
        for line in [
            "Institution: Shah & Anchor Kutchhi Engineering College",
            "Department:  Electronics & Computer Science",
            "Course:      Essentials of CS for Robotics (ECCOR2MD201)",
            "Developer:   Om Nathwani (Roll 34)",
        ]:
            dl.addWidget(_label(line, "Segoe UI", 9))
        row.addWidget(details_card, stretch=3)

        # Quick-launch card.
        launch_card = _card()
        ll = QVBoxLayout(launch_card)
        ll.setContentsMargins(16, 14, 16, 14)
        ll.setSpacing(10)
        ll.addWidget(_label("Quick Launch", "Segoe UI", 10,
                            QFont.Weight.Bold, C_NAVY))
        ll.addWidget(_separator())

        btn_insp = _button("▶  Run Component Inspection")
        btn_insp.clicked.connect(self.run_inspection_requested)
        ll.addWidget(btn_insp)

        btn_batch = _button("▶  Run Batch Analysis", bg="#2a6496")
        btn_batch.clicked.connect(self.run_batch_requested)
        ll.addWidget(btn_batch)

        btn_demo = _button("▶  Demo Presentation Mode", bg="#5a3fa0")
        btn_demo.clicked.connect(self.demo_requested)
        ll.addWidget(btn_demo)
        ll.addStretch()
        row.addWidget(launch_card, stretch=2)
        root.addLayout(row)

        # Objective card.
        obj_card = _card()
        ol = QVBoxLayout(obj_card)
        ol.setContentsMargins(16, 12, 16, 12)
        ol.addWidget(_label("Project Objective", "Segoe UI", 10,
                            QFont.Weight.Bold, C_NAVY))
        ol.addWidget(_separator())
        obj_text = _label(
            "Demonstrate an automated quality-inspection pipeline for square aluminium "
            "components using classical computer vision. A synthetic 800×800 pixel camera "
            "feed (5 px/mm calibration) is processed to measure dimensions, detect surface "
            "defects, classify each part as PASS or FAIL, and calculate illustrative robot "
            "pick coordinates — all without a physical camera, robot, or network connection.",
            wrap=True, color=C_TEXT,
        )
        ol.addWidget(obj_text)
        root.addWidget(obj_card)

        # Workflow stages.
        wf_card = _card()
        wl = QVBoxLayout(wf_card)
        wl.setContentsMargins(16, 12, 16, 12)
        wl.setSpacing(6)
        wl.addWidget(_label("Seven-Stage Inspection Workflow",
                            "Segoe UI", 10, QFont.Weight.Bold, C_NAVY))
        wl.addWidget(_separator())
        stages = [
            ("1", "Image Acquisition",      "Load synthetic 800×800 px greyscale image"),
            ("2", "Gaussian Blur",           "5×5 kernel, σ=1.4 — noise reduction"),
            ("3", "Otsu Thresholding",       "Automatic global binarisation"),
            ("4", "Morphological Ops",       "Close (fill gaps) then Open (remove noise)"),
            ("5", "Contour Detection",       "Largest external contour + bounding rectangle"),
            ("6", "Defect Scoring",          "Lower-tail method: pixels < mean − 2σ"),
            ("7", "PASS / FAIL Decision",    "115–125 mm ∩ defect < 2% → PASS"),
        ]
        grid = QGridLayout()
        grid.setHorizontalSpacing(12)
        grid.setVerticalSpacing(4)
        for row_idx, (num, name, desc) in enumerate(stages):
            badge = QLabel(num)
            badge.setFixedSize(22, 22)
            badge.setAlignment(Qt.AlignmentFlag.AlignCenter)
            badge.setFont(_qfont("Segoe UI", 8, QFont.Weight.Bold))
            badge.setStyleSheet(f"background:{C_ACCENT};color:#fff;border-radius:11px;")
            grid.addWidget(badge, row_idx, 0)
            grid.addWidget(_label(name, "Segoe UI", 9, QFont.Weight.Bold), row_idx, 1)
            grid.addWidget(_label(desc, color=C_TEXT_MUTED), row_idx, 2)
        wl.addLayout(grid)
        root.addWidget(wf_card)

        # Summary stats.
        self._stats_card = _card()
        sl = QVBoxLayout(self._stats_card)
        sl.setContentsMargins(16, 12, 16, 12)
        self._stats_lbl = _label(
            "Run batch analysis to see summary statistics.",
            color=C_TEXT_MUTED,
        )
        sl.addWidget(_label("Last Batch Run Summary", "Segoe UI", 10,
                            QFont.Weight.Bold, C_NAVY))
        sl.addWidget(_separator())
        sl.addWidget(self._stats_lbl)
        root.addWidget(self._stats_card)

        # Acceptance criteria indicators.
        crit_row = QHBoxLayout()
        for label_text, value_text, color in [
            ("Width range",    "115–125 mm",  C_ACCENT),
            ("Height range",   "115–125 mm",  C_ACCENT),
            ("Max defect",     "< 2.0 %",     C_FAIL),
            ("Calibration",    "5 px / mm",   C_TEXT_MUTED),
            ("Image size",     "800×800 px",  C_TEXT_MUTED),
        ]:
            c = _card()
            vl = QVBoxLayout(c)
            vl.setContentsMargins(10, 8, 10, 8)
            vl.addWidget(_label(label_text, color=C_TEXT_MUTED, size=8))
            vl.addWidget(_label(value_text, "Segoe UI", 11, QFont.Weight.Bold, color))
            crit_row.addWidget(c)
        root.addLayout(crit_row)
        root.addStretch()

    def update_stats(self, results: list[dict[str, Any]]) -> None:
        if not results:
            return
        passed = sum(1 for r in results if r["status"] == "PASS")
        failed = len(results) - passed
        self._stats_lbl.setText(
            f"Parts tested: {len(results)}    "
            f"PASS: {passed}    "
            f"FAIL: {failed}    "
            f"Pass rate: {passed/len(results)*100:.0f}%"
        )
        self._stats_lbl.setStyleSheet("color:#1a1a2e;background:transparent;")


# ── Page B — Inspect Component ────────────────────────────────────────────────

class _PipelineImageCell(QWidget):
    """A labelled, fixed-size image cell for the pipeline grid."""

    def __init__(self, title: str, max_w: int = 220, max_h: int = 200) -> None:
        super().__init__()
        self._max_w = max_w
        self._max_h = max_h
        layout = QVBoxLayout(self)
        layout.setContentsMargins(4, 4, 4, 4)
        layout.setSpacing(3)

        self._title = _label(title, "Segoe UI", 8, QFont.Weight.Bold, C_NAVY)
        self._title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self._title)

        self._img_lbl = QLabel()
        self._img_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._img_lbl.setFixedSize(max_w, max_h)
        self._img_lbl.setStyleSheet(f"background:#e8ecf4;border:1px solid {C_BORDER};border-radius:4px;")
        layout.addWidget(self._img_lbl)

    def set_image(self, img: np.ndarray | None) -> None:
        if img is None:
            self._img_lbl.clear()
            self._img_lbl.setText("No image")
            return
        pix = _numpy_to_pixmap(img, self._max_w, self._max_h)
        self._img_lbl.setPixmap(pix)

    def set_title(self, text: str) -> None:
        self._title.setText(text)


class InspectPage(QWidget):
    def __init__(self) -> None:
        super().__init__()
        self.setStyleSheet(f"background:{C_BG};")
        self._current_result: dict[str, Any] | None = None
        self._thread: QThread | None = None
        self._worker: _InspectWorker | None = None

        root = QVBoxLayout(self)
        root.setContentsMargins(20, 16, 20, 16)
        root.setSpacing(12)

        # Header bar.
        hdr_row = QHBoxLayout()
        hdr_row.addWidget(_label("Inspect a Component", "Segoe UI", 14,
                                 QFont.Weight.Bold, C_NAVY))
        hdr_row.addStretch()

        self._part_combo = QComboBox()
        self._part_combo.setFixedSize(140, 32)
        self._part_combo.setFont(_qfont("Segoe UI", 9))
        for i in range(1, 11):
            ref = vp.STAGE2_REFERENCE[i]
            self._part_combo.addItem(f"Part {i:02d}  [{ref['status']}]", i)
        hdr_row.addWidget(_label("Select:  ", color=C_TEXT_MUTED))
        hdr_row.addWidget(self._part_combo)

        self._btn_prev = _button("◀ Prev", bg="#607080", height=32)
        self._btn_prev.setFixedWidth(70)
        self._btn_prev.clicked.connect(self._prev_part)
        hdr_row.addWidget(self._btn_prev)

        self._btn_next = _button("Next ▶", bg="#607080", height=32)
        self._btn_next.setFixedWidth(70)
        self._btn_next.clicked.connect(self._next_part)
        hdr_row.addWidget(self._btn_next)

        self._btn_run = _button("▶  Run Inspection", height=34)
        self._btn_run.setFixedWidth(160)
        self._btn_run.clicked.connect(self._run_inspection)
        hdr_row.addWidget(self._btn_run)
        root.addLayout(hdr_row)

        root.addWidget(_separator())

        # Main splitter: pipeline images | results panel.
        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.setHandleWidth(1)
        splitter.setStyleSheet(f"QSplitter::handle{{background:{C_BORDER};}}")

        # ── Left: pipeline grid ───────────────────────────────────────────────
        pipeline_widget = QWidget()
        pipeline_widget.setStyleSheet(f"background:{C_BG};")
        pg_layout = QVBoxLayout(pipeline_widget)
        pg_layout.setContentsMargins(0, 0, 8, 0)
        pg_layout.setSpacing(6)
        pg_layout.addWidget(_label("Processing Pipeline", "Segoe UI", 10,
                                   QFont.Weight.Bold, C_NAVY))

        grid = QGridLayout()
        grid.setSpacing(6)
        stage_info = [
            ("1. Original Input",          "image"),
            ("2. Gaussian Blur",            "blurred"),
            ("3. Otsu Threshold",           "otsu"),
            ("4. Morphological Mask",       "refined"),
            ("5. Contour + Bounding Box",   "contour_view"),
            ("6. Defect Detection",         "defect_view"),
            ("7. Final Result",             None),      # text card
        ]
        self._cells: dict[str, _PipelineImageCell] = {}
        for idx, (title, key) in enumerate(stage_info):
            row_i, col_i = divmod(idx, 4)
            if key is None:
                # Final status image cell placeholder.
                cell = _PipelineImageCell(title, max_w=220, max_h=200)
                self._cells["final_cell"] = cell
            else:
                cell = _PipelineImageCell(title, max_w=220, max_h=200)
                self._cells[key] = cell
            grid.addWidget(cell, row_i, col_i)
        pg_layout.addLayout(grid)
        pg_layout.addStretch()

        pipeline_scroll = QScrollArea()
        pipeline_scroll.setWidget(pipeline_widget)
        pipeline_scroll.setWidgetResizable(True)
        pipeline_scroll.setStyleSheet(f"QScrollArea{{border:none;background:{C_BG};}}")
        splitter.addWidget(pipeline_scroll)

        # ── Right: results panel ──────────────────────────────────────────────
        results_widget = QWidget()
        results_widget.setStyleSheet(f"background:{C_BG};")
        results_widget.setFixedWidth(290)
        rl = QVBoxLayout(results_widget)
        rl.setContentsMargins(8, 0, 0, 0)
        rl.setSpacing(10)
        rl.addWidget(_label("Inspection Results", "Segoe UI", 10,
                            QFont.Weight.Bold, C_NAVY))

        self._status_lbl = QLabel("—")
        self._status_lbl.setFont(_qfont("Segoe UI", 18, QFont.Weight.Bold))
        self._status_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._status_lbl.setFixedHeight(50)
        self._status_lbl.setStyleSheet(f"background:{C_BORDER};border-radius:6px;color:{C_TEXT_MUTED};")
        rl.addWidget(self._status_lbl)

        self._reason_lbl = _label("Run inspection to see results.", wrap=True,
                                  color=C_TEXT_MUTED, size=8)
        rl.addWidget(self._reason_lbl)
        rl.addWidget(_separator())

        # Measurements table inside a card.
        meas_card = _card()
        ml = QVBoxLayout(meas_card)
        ml.setContentsMargins(12, 10, 12, 10)
        ml.setSpacing(5)
        ml.addWidget(_label("Measurements (computed)", "Segoe UI", 9,
                            QFont.Weight.Bold, C_NAVY))
        self._meas_rows: dict[str, QLabel] = {}
        for row_name in [
            "Width", "Height", "Defect %", "Centroid",
            "Pick X", "Pick Y", "Pick Z",
            "Threshold",
        ]:
            rw = QHBoxLayout()
            rw.addWidget(_label(f"{row_name}:", color=C_TEXT_MUTED, size=8))
            rw.addStretch()
            val_lbl = _label("—", color=C_TEXT, size=9)
            val_lbl.setFont(_qfont("Consolas", 9))
            self._meas_rows[row_name] = val_lbl
            rw.addWidget(val_lbl)
            ml.addLayout(rw)
        rl.addWidget(meas_card)

        # Stage 2 reference card.
        ref_card = _card()
        refl = QVBoxLayout(ref_card)
        refl.setContentsMargins(12, 10, 12, 10)
        refl.setSpacing(5)
        refl.addWidget(_label("Stage 2 Reference (doc.)", "Segoe UI", 9,
                              QFont.Weight.Bold, C_NAVY))
        self._ref_rows: dict[str, QLabel] = {}
        for row_name in ["Ref Width", "Ref Height", "Ref Defect %", "Ref Status"]:
            rw = QHBoxLayout()
            rw.addWidget(_label(f"{row_name}:", color=C_TEXT_MUTED, size=8))
            rw.addStretch()
            val_lbl = _label("—", color=C_TEXT, size=9)
            val_lbl.setFont(_qfont("Consolas", 9))
            self._ref_rows[row_name] = val_lbl
            rw.addWidget(val_lbl)
            refl.addLayout(rw)
        rl.addWidget(ref_card)

        self._progress = QProgressBar()
        self._progress.setRange(0, 0)
        self._progress.setFixedHeight(6)
        self._progress.setVisible(False)
        self._progress.setStyleSheet(f"""
            QProgressBar{{border:none;background:{C_BORDER};border-radius:3px;}}
            QProgressBar::chunk{{background:{C_ACCENT};border-radius:3px;}}
        """)
        rl.addWidget(self._progress)
        rl.addStretch()

        splitter.addWidget(results_widget)
        splitter.setSizes([750, 290])
        root.addWidget(splitter)

    # ── Navigation ────────────────────────────────────────────────────────────
    def _current_part_id(self) -> int:
        return self._part_combo.currentData()

    def _prev_part(self) -> None:
        idx = self._part_combo.currentIndex()
        if idx > 0:
            self._part_combo.setCurrentIndex(idx - 1)

    def _next_part(self) -> None:
        idx = self._part_combo.currentIndex()
        if idx < self._part_combo.count() - 1:
            self._part_combo.setCurrentIndex(idx + 1)

    def select_part(self, part_id: int) -> None:
        """Programmatically select a part and trigger inspection."""
        for i in range(self._part_combo.count()):
            if self._part_combo.itemData(i) == part_id:
                self._part_combo.setCurrentIndex(i)
                break
        self._run_inspection()

    # ── Inspection ───────────────────────────────────────────────────────────
    def _run_inspection(self) -> None:
        if self._thread and self._thread.isRunning():
            return
        part_id = self._current_part_id()
        self._btn_run.setEnabled(False)
        self._progress.setVisible(True)
        self._status_lbl.setText("Processing…")
        self._status_lbl.setStyleSheet(f"background:{C_BORDER};border-radius:6px;color:{C_TEXT_MUTED};")
        self._reason_lbl.setText("Running pipeline…")

        self._thread = QThread()
        self._worker = _InspectWorker(part_id)
        self._worker.moveToThread(self._thread)
        self._thread.started.connect(self._worker.run)
        self._worker.finished.connect(self._on_result)
        self._worker.error.connect(self._on_error)
        self._worker.finished.connect(self._thread.quit)
        self._worker.error.connect(self._thread.quit)
        self._thread.start()

    def _on_result(self, result: dict[str, Any]) -> None:
        self._current_result = result
        self._update_pipeline_images(result)
        self._update_results_panel(result)
        self._btn_run.setEnabled(True)
        self._progress.setVisible(False)

    def _on_error(self, msg: str) -> None:
        self._btn_run.setEnabled(True)
        self._progress.setVisible(False)
        self._status_lbl.setText("ERROR")
        self._status_lbl.setStyleSheet("background:#c0392b;border-radius:6px;color:#fff;")
        self._reason_lbl.setText(f"Pipeline error: {msg}")
        QMessageBox.critical(self, "Inspection Error", msg)

    def _update_pipeline_images(self, r: dict[str, Any]) -> None:
        for key, cell in self._cells.items():
            if key == "final_cell":
                continue
            img = r.get(key)
            cell.set_image(img)
        # Final cell — show the defect view (same as stage 6 with annotations).
        fc = self._cells.get("final_cell")
        if fc:
            fc.set_image(r.get("defect_view"))
            fc.set_title(f"7. Final: {r['status']}")

    def _update_results_panel(self, r: dict[str, Any]) -> None:
        status = r["status"]
        bg = C_PASS if status == "PASS" else C_FAIL
        self._status_lbl.setText(f"  {status}  ")
        self._status_lbl.setStyleSheet(
            f"background:{bg};border-radius:6px;color:#fff;font-size:18pt;font-weight:bold;"
        )
        self._reason_lbl.setText(r["failure_reason"])

        def _chk(ok: bool) -> str:
            return "✔" if ok else "✘"

        self._meas_rows["Width"].setText(
            f"{r['width_mm']:.2f} mm {_chk(r['width_ok'])}"
        )
        self._meas_rows["Width"].setStyleSheet(
            f"color:{C_PASS if r['width_ok'] else C_FAIL};background:transparent;"
        )
        self._meas_rows["Height"].setText(
            f"{r['height_mm']:.2f} mm {_chk(r['height_ok'])}"
        )
        self._meas_rows["Height"].setStyleSheet(
            f"color:{C_PASS if r['height_ok'] else C_FAIL};background:transparent;"
        )
        self._meas_rows["Defect %"].setText(
            f"{r['defect_percent']:.3f}% {_chk(r['defect_ok'])}"
        )
        self._meas_rows["Defect %"].setStyleSheet(
            f"color:{C_PASS if r['defect_ok'] else C_FAIL};background:transparent;"
        )
        self._meas_rows["Centroid"].setText(
            f"({r['centroid_x_px']:.1f}, {r['centroid_y_px']:.1f}) px"
        )
        self._meas_rows["Centroid"].setStyleSheet("color:#1a1a2e;background:transparent;")
        self._meas_rows["Pick X"].setText(f"{r['pick_x']:+.2f} mm")
        self._meas_rows["Pick Y"].setText(f"{r['pick_y']:+.2f} mm")
        self._meas_rows["Pick Z"].setText(f"{r['pick_z']:.1f} mm")
        self._meas_rows["Threshold"].setText(f"Otsu = {r['threshold_value']:.0f}")
        for k in ["Pick X", "Pick Y", "Pick Z", "Threshold", "Centroid"]:
            self._meas_rows[k].setStyleSheet("color:#1a1a2e;background:transparent;")

        # Stage 2 reference.
        pid = r["part"]
        ref = vp.STAGE2_REFERENCE.get(pid, {})
        self._ref_rows["Ref Width"].setText(f"{ref.get('width_mm', 'N/A')} mm")
        self._ref_rows["Ref Height"].setText(f"{ref.get('height_mm', 'N/A')} mm")
        self._ref_rows["Ref Defect %"].setText(f"{ref.get('defect_percent', 'N/A'):.3f}%"
                                               if isinstance(ref.get("defect_percent"), float)
                                               else "N/A")
        ref_status = ref.get("status", "N/A")
        self._ref_rows["Ref Status"].setText(ref_status)
        self._ref_rows["Ref Status"].setStyleSheet(
            f"color:{C_PASS if ref_status=='PASS' else C_FAIL};background:transparent;"
        )


# ── Page C — Batch Analytics ─────────────────────────────────────────────────

class _ChartWidget(QWidget):
    """Embeds a Matplotlib Figure in a Qt widget."""

    def __init__(self, fig: plt.Figure | None = None) -> None:
        super().__init__()
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        self._canvas: FigureCanvas | None = None
        if fig:
            self.set_figure(fig)

    def set_figure(self, fig: plt.Figure) -> None:
        if self._canvas:
            self.layout().removeWidget(self._canvas)
            self._canvas.deleteLater()
        self._canvas = FigureCanvas(fig)
        self._canvas.setSizePolicy(
            QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding
        )
        self.layout().addWidget(self._canvas)
        self._canvas.draw()

    def clear(self) -> None:
        if self._canvas:
            self.layout().removeWidget(self._canvas)
            self._canvas.deleteLater()
            self._canvas = None


class BatchPage(QWidget):
    def __init__(self) -> None:
        super().__init__()
        self.setStyleSheet(f"background:{C_BG};")
        self._results: list[dict[str, Any]] = []
        self._thread: QThread | None = None
        self._worker: _BatchWorker | None = None

        root = QVBoxLayout(self)
        root.setContentsMargins(20, 16, 20, 16)
        root.setSpacing(10)

        # Header.
        hdr_row = QHBoxLayout()
        hdr_row.addWidget(_label("Batch Analytics", "Segoe UI", 14,
                                 QFont.Weight.Bold, C_NAVY))
        hdr_row.addStretch()
        self._btn_run = _button("▶  Run Full Batch")
        self._btn_run.setFixedWidth(160)
        self._btn_run.clicked.connect(self._run_batch)
        hdr_row.addWidget(self._btn_run)
        root.addLayout(hdr_row)

        self._progress = QProgressBar()
        self._progress.setRange(0, 10)
        self._progress.setFixedHeight(8)
        self._progress.setVisible(False)
        self._progress.setStyleSheet(f"""
            QProgressBar{{border:none;background:{C_BORDER};border-radius:4px;text-align:center;}}
            QProgressBar::chunk{{background:{C_ACCENT};border-radius:4px;}}
        """)
        root.addWidget(self._progress)

        root.addWidget(_separator())

        # Tabs: Table | Charts.
        self._tabs = QTabWidget()
        self._tabs.setStyleSheet(f"""
            QTabWidget::pane {{border:1px solid {C_BORDER};border-radius:6px;background:{C_CARD};}}
            QTabBar::tab {{padding:6px 16px;font-family:'Segoe UI';font-size:9pt;}}
            QTabBar::tab:selected {{background:{C_ACCENT};color:#fff;border-radius:4px;}}
            QTabBar::tab:!selected {{background:{C_BG};color:{C_TEXT_MUTED};}}
        """)
        root.addWidget(self._tabs, stretch=1)

        # ── Table tab ─────────────────────────────────────────────────────────
        table_tab = QWidget()
        table_tab.setStyleSheet(f"background:{C_CARD};")
        tt_layout = QVBoxLayout(table_tab)
        tt_layout.setContentsMargins(12, 12, 12, 12)
        tt_layout.setSpacing(8)

        self._empty_label = _label(
            "No batch data yet. Click  ▶ Run Full Batch  to process all ten parts.",
            color=C_TEXT_MUTED,
        )
        tt_layout.addWidget(self._empty_label)

        self._table = QTableWidget()
        self._table.setVisible(False)
        self._table.setFont(_qfont("Consolas", 8))
        self._table.setAlternatingRowColors(True)
        self._table.setStyleSheet(f"""
            QTableWidget {{border:none;gridline-color:{C_BORDER};}}
            QTableWidget::item {{padding:3px 8px;}}
            QHeaderView::section {{
                background:{C_NAVY};color:#fff;font-weight:bold;
                padding:5px;border:none;
            }}
            QTableWidget::item:alternate {{background:#f0f4fa;}}
        """)
        self._table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.ResizeToContents)
        self._table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        tt_layout.addWidget(self._table)

        # Summary row.
        self._summary_lbl = _label("", color=C_TEXT_MUTED, size=8)
        tt_layout.addWidget(self._summary_lbl)

        # Export buttons.
        exp_row = QHBoxLayout()
        for text, slot in [
            ("Export CSV",       self._export_csv),
            ("Export JSON",      self._export_json),
            ("Save Charts PNG",  self._export_charts),
            ("Save Dashboard",   self._export_dashboard),
        ]:
            btn = _button(text, bg="#4a6080", height=30)
            btn.clicked.connect(slot)
            btn.setEnabled(False)
            self._export_buttons_ref = getattr(self, "_export_btns", [])
            if not hasattr(self, "_export_btns"):
                self._export_btns: list[QPushButton] = []
            self._export_btns.append(btn)
            exp_row.addWidget(btn)
        exp_row.addStretch()
        tt_layout.addLayout(exp_row)
        self._tabs.addTab(table_tab, "Results Table")

        # ── Charts tab ────────────────────────────────────────────────────────
        charts_tab = QWidget()
        charts_tab.setStyleSheet(f"background:{C_CARD};")
        ct_layout = QVBoxLayout(charts_tab)
        ct_layout.setContentsMargins(8, 8, 8, 8)

        self._chart_tabs = QTabWidget()
        self._chart_tabs.setStyleSheet(self._tabs.styleSheet())
        ct_layout.addWidget(self._chart_tabs)

        self._chart_widgets: dict[str, _ChartWidget] = {}
        for chart_name in ["Widths", "Heights", "Defects", "Scatter", "Coordinates", "Dashboard"]:
            cw = _ChartWidget()
            self._chart_widgets[chart_name] = cw
            self._chart_tabs.addTab(cw, chart_name)

        self._tabs.addTab(charts_tab, "Charts")

    def _run_batch(self) -> None:
        if self._thread and self._thread.isRunning():
            return
        self._btn_run.setEnabled(False)
        self._progress.setVisible(True)
        self._progress.setValue(0)
        for btn in self._export_btns:
            btn.setEnabled(False)

        self._thread = QThread()
        self._worker = _BatchWorker()
        self._worker.moveToThread(self._thread)
        self._thread.started.connect(self._worker.run)
        self._worker.progress.connect(self._on_progress)
        self._worker.finished.connect(self._on_batch_done)
        self._worker.error.connect(self._on_batch_error)
        self._worker.finished.connect(self._thread.quit)
        self._worker.error.connect(self._thread.quit)
        self._thread.start()

    def _on_progress(self, done: int, total: int) -> None:
        self._progress.setMaximum(total)
        self._progress.setValue(done)

    def _on_batch_done(self, results: list[dict[str, Any]]) -> None:
        self._results = results
        self._btn_run.setEnabled(True)
        self._progress.setVisible(False)
        for btn in self._export_btns:
            btn.setEnabled(True)
        self._populate_table(results)
        self._populate_charts(results)

    def _on_batch_error(self, msg: str) -> None:
        self._btn_run.setEnabled(True)
        self._progress.setVisible(False)
        QMessageBox.critical(self, "Batch Error", msg)

    def _populate_table(self, results: list[dict[str, Any]]) -> None:
        self._empty_label.setVisible(False)
        self._table.setVisible(True)
        cols = [
            "Part", "Width (mm)", "Height (mm)", "Defect %",
            "Width ✔/✘", "Height ✔/✘", "Defect ✔/✘", "Status",
            "Pick X (mm)", "Pick Y (mm)", "Pick Z (mm)",
        ]
        self._table.setColumnCount(len(cols))
        self._table.setHorizontalHeaderLabels(cols)
        self._table.setRowCount(len(results))
        for row_idx, r in enumerate(results):
            def _item(text: str, color: str | None = None) -> QTableWidgetItem:
                item = QTableWidgetItem(text)
                item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                if color:
                    item.setForeground(QColor(color))
                return item

            self._table.setItem(row_idx, 0,  _item(str(r["part"])))
            self._table.setItem(row_idx, 1,  _item(f"{r['width_mm']:.2f}"))
            self._table.setItem(row_idx, 2,  _item(f"{r['height_mm']:.2f}"))
            self._table.setItem(row_idx, 3,  _item(f"{r['defect_percent']:.3f}"))
            self._table.setItem(row_idx, 4,  _item("✔" if r["width_ok"]  else "✘",
                                                    C_PASS if r["width_ok"]  else C_FAIL))
            self._table.setItem(row_idx, 5,  _item("✔" if r["height_ok"] else "✘",
                                                    C_PASS if r["height_ok"] else C_FAIL))
            self._table.setItem(row_idx, 6,  _item("✔" if r["defect_ok"] else "✘",
                                                    C_PASS if r["defect_ok"] else C_FAIL))
            status_item = _item(r["status"], C_PASS if r["status"] == "PASS" else C_FAIL)
            status_item.setFont(_qfont("Segoe UI", 9, QFont.Weight.Bold))
            self._table.setItem(row_idx, 7,  status_item)
            self._table.setItem(row_idx, 8,  _item(f"{r['pick_x']:+.2f}"))
            self._table.setItem(row_idx, 9,  _item(f"{r['pick_y']:+.2f}"))
            self._table.setItem(row_idx, 10, _item(f"{r['pick_z']:.1f}"))

        passed = sum(1 for r in results if r["status"] == "PASS")
        self._summary_lbl.setText(
            f"Total: {len(results)}   PASS: {passed}   FAIL: {len(results)-passed}   "
            f"Pass rate: {passed/len(results)*100:.0f}%   "
            f"Acceptance range: {vp.DIM_MIN_MM}–{vp.DIM_MAX_MM} mm   "
            f"Defect threshold: < {vp.MAX_DEFECT_PERCENT}%"
        )

    def _populate_charts(self, results: list[dict[str, Any]]) -> None:
        chart_fns = {
            "Widths":       lambda: analytics.chart_widths(results),
            "Heights":      lambda: analytics.chart_heights(results),
            "Defects":      lambda: analytics.chart_defects(results),
            "Scatter":      lambda: analytics.chart_scatter(results),
            "Coordinates":  lambda: analytics.chart_coordinates(results),
            "Dashboard":    lambda: analytics.chart_dashboard(results, save=False),
        }
        for name, fn in chart_fns.items():
            fig = fn()
            self._chart_widgets[name].set_figure(fig)
            plt.close(fig)

    def _require_results(self) -> bool:
        if not self._results:
            QMessageBox.warning(self, "No Data", "Run the batch analysis first.")
            return False
        return True

    def _export_csv(self) -> None:
        if not self._require_results():
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "Save CSV", str(vp.OUTPUT_DIR / "inspection_results.csv"),
            "CSV Files (*.csv)"
        )
        if path:
            vp.save_summary_csv(self._results, Path(path))
            QMessageBox.information(self, "Saved", f"CSV saved:\n{path}")

    def _export_json(self) -> None:
        if not self._require_results():
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "Save JSON", str(vp.OUTPUT_DIR / "inspection_summary.json"),
            "JSON Files (*.json)"
        )
        if path:
            vp.save_summary_json(self._results, Path(path))
            QMessageBox.information(self, "Saved", f"JSON saved:\n{path}")

    def _export_charts(self) -> None:
        if not self._require_results():
            return
        saved = analytics.save_all_charts(self._results)
        QMessageBox.information(self, "Charts Saved",
                                f"Charts saved to:\n{vp.OUTPUT_DIR}\n"
                                + "\n".join(p.name for p in saved))

    def _export_dashboard(self) -> None:
        if not self._require_results():
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "Save Dashboard", str(vp.OUTPUT_DIR / "batch_dashboard.png"),
            "PNG Images (*.png)"
        )
        if path:
            fig = analytics.chart_dashboard(self._results, save=False)
            fig.savefig(path, dpi=150, bbox_inches="tight")
            plt.close(fig)
            QMessageBox.information(self, "Saved", f"Dashboard saved:\n{path}")

    def get_results(self) -> list[dict[str, Any]]:
        return self._results


# ── Page D — How It Works ─────────────────────────────────────────────────────

class HowItWorksPage(QWidget):
    def __init__(self) -> None:
        super().__init__()
        self.setStyleSheet(f"background:{C_BG};")
        root = QVBoxLayout(self)
        root.setContentsMargins(28, 20, 28, 20)
        root.setSpacing(14)
        root.addWidget(_label("How It Works", "Segoe UI", 14,
                              QFont.Weight.Bold, C_NAVY))
        root.addWidget(_separator())

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet(f"QScrollArea{{border:none;background:{C_BG};}}")
        content = QWidget()
        content.setStyleSheet(f"background:{C_BG};")
        cl = QVBoxLayout(content)
        cl.setSpacing(14)
        cl.setContentsMargins(0, 0, 16, 0)

        stages = [
            ("Stage 1 — Image Acquisition",
             "The pipeline loads an 800×800 pixel synthetic greyscale image that simulates "
             "the view from an overhead industrial camera. Each pixel corresponds to "
             "0.2 mm of real-world length (calibration scale: 5 px/mm). The component is "
             "rendered with realistic surface intensity noise. No physical camera is used."),

            ("Stage 2 — Gaussian Blur  (5×5 kernel, σ = 1.4)",
             "A Gaussian filter smooths small random intensity variations on the component "
             "surface, preventing the thresholding step from treating sensor noise as "
             "boundaries or defects. The 5×5 kernel and σ = 1.4 are specified in the "
             "project documentation."),

            ("Stage 3 — Otsu Thresholding",
             "Otsu's method automatically selects the intensity value T* that minimises "
             "within-class variance across the image histogram. Pixels above T* become "
             "white (component) and pixels below become black (background). No manual "
             "threshold is required."),

            ("Stage 4 — Morphological Mask Refinement",
             "Two morphological operations are applied in sequence with a 9×9 rectangular "
             "structuring element:\n"
             "  • Closing (dilate then erode) — fills small gaps at component edges.\n"
             "  • Opening (erode then dilate) — removes small isolated regions of noise.\n"
             "The result is a clean binary mask of the component."),

            ("Stage 5 — Contour Detection and Metrology",
             "OpenCV's findContours locates the external boundary of the largest connected "
             "region. A minimum-area bounding rectangle gives the pixel width w and height h.\n\n"
             "  width_mm  = w / 5   (inverse calibration)\n"
             "  height_mm = h / 5\n\n"
             "The component centroid (cx, cy) is computed from image moments."),

            ("Stage 6 — Surface Defect Detection",
             "The statistical lower-tail method is used:\n"
             "  1. Extract all pixels inside the component bounding box.\n"
             "  2. Compute their mean μ and standard deviation σ.\n"
             "  3. Any pixel with intensity < μ − 2σ is classified as a potential defect.\n"
             "  4. defect_percent = (defective pixels / total surface pixels) × 100 %\n\n"
             "Dark defects on the bright aluminium surface fall clearly below this threshold."),

            ("Stage 7 — PASS / FAIL Decision",
             "Three binary checks are combined:\n"
             "  width_ok  : 115 mm ≤ width_mm  ≤ 125 mm\n"
             "  height_ok : 115 mm ≤ height_mm ≤ 125 mm\n"
             "  defect_ok : defect_percent < 2.0 %\n\n"
             "status = PASS  if  width_ok AND height_ok AND defect_ok\n"
             "status = FAIL  if  any check fails"),

            ("Coordinate Transformation (Illustrative)",
             "The component centroid in image coordinates (cx, cy) is mapped to an "
             "illustrative robot base-frame position:\n\n"
             "  X_pick = (cx − 400) / 5   (mm, positive = right of image centre)\n"
             "  Y_pick = (400 − cy) / 5   (mm, positive = above image centre)\n"
             "  Z_pick = 10 mm            (fixed approach height)\n\n"
             "Sorting targets:\n"
             "  PASS bin → (+350, −200, 10) mm\n"
             "  FAIL bin → (−350, −200, 10) mm\n\n"
             "These values are displayed for educational purposes only. "
             "No commands are sent to physical hardware."),
        ]

        for title, body in stages:
            card = _card()
            cl = QVBoxLayout(card)
            cl.setContentsMargins(16, 12, 16, 12)
            cl.setSpacing(6)
            cl.addWidget(_label(title, "Segoe UI", 10, QFont.Weight.Bold, C_NAVY))
            cl.addWidget(_separator())
            txt = _label(body, wrap=True, color=C_TEXT)
            txt.setFont(_qfont("Segoe UI", 9))
            cl.addWidget(txt)
            content.layout().addWidget(card)

        content.layout().addStretch()
        scroll.setWidget(content)
        root.addWidget(scroll)


# ── Page E — Demo Presentation Mode ──────────────────────────────────────────

class DemoPage(QWidget):
    exit_demo = Signal()

    # Parts shown in the demo, with brief descriptions.
    DEMO_PARTS = [
        (3,  "Part 3 — Nominal PASS",
             "Acceptable dimensions and minimal surface defects."),
        (7,  "Part 7 — Dimensional + Defect FAIL",
             "Width and defect area both exceed acceptance limits."),
        (2,  "Part 2 — Defect-Only FAIL",
             "Dimensions within range; defect area exceeds 2 % threshold."),
    ]

    def __init__(self) -> None:
        super().__init__()
        self.setStyleSheet(f"background:{C_NAVY};")
        self._current_idx: int = 0
        self._auto_timer: QTimer | None = None
        self._result: dict[str, Any] | None = None
        self._thread: QThread | None = None
        self._worker: _InspectWorker | None = None

        root = QVBoxLayout(self)
        root.setContentsMargins(20, 16, 20, 16)
        root.setSpacing(10)

        # Top bar.
        top = QHBoxLayout()
        self._demo_title = _label("DEMO PRESENTATION MODE", "Segoe UI", 14,
                                  QFont.Weight.Bold, "#ffffff")
        top.addWidget(self._demo_title)
        top.addStretch()

        sim_lbl = QLabel("SIMULATION MODE — SYNTHETIC TEST IMAGES")
        sim_lbl.setFont(_qfont("Segoe UI", 8, QFont.Weight.Bold))
        sim_lbl.setStyleSheet("color:#f0c040;background:rgba(240,192,64,0.12);"
                              "border:1px solid #f0c040;border-radius:4px;padding:3px 8px;")
        top.addWidget(sim_lbl)
        root.addLayout(top)

        # Sub-header.
        self._part_title_lbl = _label("", "Segoe UI", 12, QFont.Weight.Bold, "#c8d8f0")
        root.addWidget(self._part_title_lbl)
        self._part_desc_lbl = _label("", "Segoe UI", 9, color="#8aadcc", wrap=True)
        root.addWidget(self._part_desc_lbl)

        # Main area: large images + results.
        main_area = QHBoxLayout()
        main_area.setSpacing(16)

        # Left: two large images.
        img_col = QVBoxLayout()
        img_col.setSpacing(10)
        self._orig_cell = _PipelineImageCell("Original Input", max_w=360, max_h=310)
        self._orig_cell.setStyleSheet(f"background:#162040;border:1px solid #2a4070;border-radius:6px;")
        img_col.addWidget(self._orig_cell)
        self._result_cell = _PipelineImageCell("Defect Overlay / Final", max_w=360, max_h=310)
        self._result_cell.setStyleSheet(f"background:#162040;border:1px solid #2a4070;border-radius:6px;")
        img_col.addWidget(self._result_cell)
        main_area.addLayout(img_col)

        # Right: status + measurements.
        info_col = QVBoxLayout()
        info_col.setSpacing(10)

        # Large status badge.
        self._status_lbl = QLabel("—")
        self._status_lbl.setFont(_qfont("Segoe UI", 36, QFont.Weight.Bold))
        self._status_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._status_lbl.setFixedHeight(90)
        self._status_lbl.setStyleSheet("background:#162040;color:#8aadcc;"
                                       "border-radius:8px;border:1px solid #2a4070;")
        info_col.addWidget(self._status_lbl)

        # Failure reason.
        self._reason_lbl = _label("", wrap=True, color="#c8d8f0", size=10)
        self._reason_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        info_col.addWidget(self._reason_lbl)

        # Measurements card.
        meas_card = QFrame()
        meas_card.setStyleSheet("background:#162040;border:1px solid #2a4070;border-radius:8px;")
        ml = QVBoxLayout(meas_card)
        ml.setContentsMargins(16, 12, 16, 12)
        ml.setSpacing(8)
        ml.addWidget(_label("MEASUREMENTS", "Segoe UI", 10, QFont.Weight.Bold, "#8aadcc"))

        self._demo_meas: dict[str, QLabel] = {}
        for label in ["Width", "Height", "Defect %", "Centroid", "Pick X/Y/Z"]:
            rw = QHBoxLayout()
            rw.addWidget(_label(f"{label}:", color="#5a7a9a", size=9))
            rw.addStretch()
            val = _label("—", "Consolas", 11, color="#e8f0fa")
            self._demo_meas[label] = val
            rw.addWidget(val)
            ml.addLayout(rw)
        info_col.addWidget(meas_card)
        info_col.addStretch()
        main_area.addLayout(info_col)
        root.addLayout(main_area, stretch=1)

        # Navigation bar.
        nav_bar = QHBoxLayout()
        nav_bar.setSpacing(8)

        self._btn_exit = _button("◀ Exit Demo", bg="#334460", height=36)
        self._btn_exit.clicked.connect(self.exit_demo)
        nav_bar.addWidget(self._btn_exit)
        nav_bar.addStretch()

        for idx, (pid, lbl, _) in enumerate(self.DEMO_PARTS):
            btn = _button(lbl[:14], bg="#1c4e8a", height=36)
            btn.clicked.connect(lambda _, i=idx: self._load_part(i))
            nav_bar.addWidget(btn)

        nav_bar.addStretch()

        self._btn_auto = _button("▶▶ Auto Demo", bg=C_PASS, height=36)
        self._btn_auto.clicked.connect(self._start_auto)
        nav_bar.addWidget(self._btn_auto)

        self._btn_stop = _button("■ Stop", bg=C_FAIL, height=36)
        self._btn_stop.clicked.connect(self._stop_auto)
        self._btn_stop.setVisible(False)
        nav_bar.addWidget(self._btn_stop)

        root.addLayout(nav_bar)

    def _load_part(self, idx: int) -> None:
        if self._thread and self._thread.isRunning():
            return
        self._current_idx = idx
        pid, title, desc = self.DEMO_PARTS[idx]
        self._part_title_lbl.setText(f"Part {pid:02d}  —  {title}")
        self._part_desc_lbl.setText(desc)
        self._status_lbl.setText("…")
        self._status_lbl.setStyleSheet("background:#162040;color:#8aadcc;"
                                       "border-radius:8px;border:1px solid #2a4070;")
        self._reason_lbl.setText("Loading…")
        for v in self._demo_meas.values():
            v.setText("—")

        self._thread = QThread()
        self._worker = _InspectWorker(pid)
        self._worker.moveToThread(self._thread)
        self._thread.started.connect(self._worker.run)
        self._worker.finished.connect(self._on_result)
        self._worker.error.connect(self._on_error)
        self._worker.finished.connect(self._thread.quit)
        self._worker.error.connect(self._thread.quit)
        self._thread.start()

    def _on_result(self, result: dict[str, Any]) -> None:
        self._result = result
        self._orig_cell.set_image(result["image"])
        self._result_cell.set_image(result["defect_view"])
        self._result_cell.set_title(f"Defect Overlay  [{result['status']}]")

        status = result["status"]
        bg = C_PASS if status == "PASS" else C_FAIL
        self._status_lbl.setText(status)
        self._status_lbl.setStyleSheet(
            f"background:{bg};color:#ffffff;border-radius:8px;font-size:36pt;font-weight:bold;"
        )
        self._reason_lbl.setText(result["failure_reason"])

        self._demo_meas["Width"].setText(
            f"{result['width_mm']:.2f} mm {'✔' if result['width_ok'] else '✘'}"
        )
        self._demo_meas["Height"].setText(
            f"{result['height_mm']:.2f} mm {'✔' if result['height_ok'] else '✘'}"
        )
        self._demo_meas["Defect %"].setText(
            f"{result['defect_percent']:.3f}% {'✔' if result['defect_ok'] else '✘'}"
        )
        self._demo_meas["Centroid"].setText(
            f"({result['centroid_x_px']:.1f}, {result['centroid_y_px']:.1f}) px"
        )
        self._demo_meas["Pick X/Y/Z"].setText(
            f"X={result['pick_x']:+.1f}  Y={result['pick_y']:+.1f}  Z={result['pick_z']:.0f} mm"
        )

    def _on_error(self, msg: str) -> None:
        self._status_lbl.setText("ERR")
        self._reason_lbl.setText(msg)

    def _start_auto(self) -> None:
        self._btn_auto.setVisible(False)
        self._btn_stop.setVisible(True)
        self._current_idx = 0
        self._load_part(self._current_idx)
        self._auto_timer = QTimer(self)
        self._auto_timer.setInterval(6000)
        self._auto_timer.timeout.connect(self._auto_advance)
        self._auto_timer.start()

    def _auto_advance(self) -> None:
        self._current_idx = (self._current_idx + 1) % len(self.DEMO_PARTS)
        self._load_part(self._current_idx)
        if self._current_idx == len(self.DEMO_PARTS) - 1:
            self._stop_auto()

    def _stop_auto(self) -> None:
        if self._auto_timer:
            self._auto_timer.stop()
            self._auto_timer = None
        self._btn_auto.setVisible(True)
        self._btn_stop.setVisible(False)

    def activate(self) -> None:
        """Called when user enters demo mode. Load first demo part."""
        self._load_part(0)


# ── Main Window ───────────────────────────────────────────────────────────────

class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle(
            "Automated Object Detection & Quality Inspection — Robot Vision Micro-Project"
        )
        self.setMinimumSize(1100, 700)
        self.resize(1280, 820)

        # Central widget layout.
        central = QWidget()
        self.setCentralWidget(central)
        layout = QHBoxLayout(central)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Sidebar.
        self._sidebar = Sidebar()
        layout.addWidget(self._sidebar)

        # Thin divider.
        div = QFrame()
        div.setFrameShape(QFrame.Shape.VLine)
        div.setStyleSheet(f"color:{C_BORDER};")
        layout.addWidget(div)

        # Pages.
        self._stack = QStackedWidget()
        layout.addWidget(self._stack, stretch=1)

        self._page_overview = OverviewPage()
        self._page_inspect  = InspectPage()
        self._page_batch    = BatchPage()
        self._page_how      = HowItWorksPage()
        self._page_demo     = DemoPage()

        for page in [
            self._page_overview, self._page_inspect,
            self._page_batch, self._page_how, self._page_demo,
        ]:
            self._stack.addWidget(page)

        # Wire up navigation.
        self._sidebar.page_changed.connect(self._on_page_changed)

        # Overview quick-launch buttons.
        self._page_overview.run_inspection_requested.connect(
            lambda: self._sidebar.go_to(1)
        )
        self._page_overview.run_batch_requested.connect(self._quick_batch)
        self._page_overview.demo_requested.connect(
            lambda: self._sidebar.go_to(4)
        )

        # Demo exit.
        self._page_demo.exit_demo.connect(lambda: self._sidebar.go_to(0))

        # Status bar.
        self.statusBar().showMessage(
            "SIMULATION MODE — Synthetic test images | No physical robot or camera | "
            "Shah & Anchor Kutchhi Engineering College"
        )
        self.statusBar().setStyleSheet(f"color:{C_TEXT_MUTED};font-size:8pt;")

    def _on_page_changed(self, idx: int) -> None:
        self._stack.setCurrentIndex(idx)
        if idx == 4:  # Demo page
            self._page_demo.activate()

    def _quick_batch(self) -> None:
        """Navigate to batch page and start the run."""
        self._sidebar.go_to(2)
        QTimer.singleShot(100, self._page_batch._run_batch)  # slight delay for UI update

    def update_overview_stats(self, results: list[dict[str, Any]]) -> None:
        self._page_overview.update_stats(results)

    def get_batch_results(self) -> list[dict[str, Any]]:
        return self._page_batch.get_results()
