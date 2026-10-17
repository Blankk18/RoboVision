# ROBOVISION QMS 4.0 — Automated Object Detection & Quality Inspection Workstation

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-3776AB.svg?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.10+-5C3EE8.svg?style=flat&logo=opencv&logoColor=white)](https://opencv.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/TailwindCSS-4.3-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Tests Passing](https://img.shields.io/badge/pytest-58%20passed-10B981.svg?style=flat&logo=pytest&logoColor=white)](https://docs.pytest.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Shah & Anchor Kutchhi Engineering College**  
> **Department of Electronics & Computer Science**  
> **Author & Project Owner:** **Om Nathwani**  
> **Affiliation:** Shah & Anchor Kutchhi Engineering College  
> **Course:** Essentials of Computer Science for Robotics (`ECCOR2MD201`)  
> **System Classification:** `SOFTWARE SIMULATION · SYNTHETIC IMAGES · DETERMINISTIC OPENCV`

---

## 1. Executive Summary

**ROBOVISION QMS 4.0** is an industrial-grade browser engineering workstation developed for automated visual quality control and robotic sorting of precision aluminium workpieces. Built on a resilient **FastAPI (Python)** backend and a reactive **React 19 + TypeScript + Vite + Tailwind CSS** frontend, the system inspects 800×800 px calibrated images (5.0 px/mm optical ratio) across a deterministic 7-stage classical computer-vision pipeline.

The software replaces error-prone human calipers with sub-millimeter edge metrology, two-sigma surface defect segmentation, and real-time 3-DOF pick-and-sort coordinate mapping with animated robotic arm simulation.

```
+--------------------------------------------------------------------------------------------------+
|                                    ROBOVISION QMS 4.0 PIPELINE                                  |
|                                                                                                  |
| [Input Image] -> [Gaussian 5x5] -> [Otsu Threshold] -> [Morphology 9x9] -> [Contour Metrology]   |
|   (800x800)         (sigma=1.4)      (Adaptive Cut)      (Close->Open)       (cx, cy, W, H)      |
|                                                                                    |             |
|                                                                                    v             |
| [PASS/REJECT Bins] <- [Planar 3-DOF Arm] <- [Robot Coordinates] <- [2-Sigma Defect Analysis]    |
|  (+350 / -350 mm)       (Articulated IK)     (X, Y, Z=10 mm)           (Cutoff = mu - 2*sigma)   |
+--------------------------------------------------------------------------------------------------+
```

---

## 2. Key Architecture & Features

### 🎛️ Dual-Canvas Inspection Workbench
- **Left Metrology Canvas:**
  - Displays high-resolution synthetic component images and final OpenCV overlays.
  - Interactive cyan laser scanning beam with glowing progress state.
  - Calibrated millimeter crosshairs, contour boundaries, and red surface defect markers.
  - Interactive stage switcher to inspect all 7 intermediate image buffers with a single click.
- **Right Articulated Robot Arm Canvas:**
  - Custom SVG technical visualization of a 3-DOF industrial robotic arm in industrial orange (`#F97316`).
  - Analytic 2-link planar inverse kinematics calculating exact joint angles ($\theta_1, \theta_2$) in real time.
  - Dynamic pick point $(X_{pick}, Y_{pick})$ mapped directly from image pixel centroid.
  - Green PASS Bin at $(+350, -200, 10)$ mm and Red REJECT Bin at $(-350, -200, 10)$ mm.
  - Animated parabolic transport trajectory with Play, Pause, Reset, and Speed controls.
- **High-Density Results Strip (1920×1080 Viewport Optimized):**
  - Instant engineering readouts for Width, Height, Defect %, Centroid, Robot Coords, and Sort Destination.

### 🎓 Guided Stage 3 Demonstration Mode ("START DEMO")
Dedicated sequence tailored for college reviews and presentation defense:
1. **Academic Title & Overview:** College credentials, course specs, and quality problem statement.
2. **Part 03 Inspection (PASS):** Fully compliant sample meeting all dimensional and surface criteria.
3. **Part 07 Inspection (DUAL FAIL):** Out-of-tolerance width (128.0 mm) and high defect area (4.85%).
4. **Part 02 Inspection (DEFECT ONLY FAIL):** Compliant geometry (120.2 × 120.0 mm) but surface defect (2.34%) exceeding the 2.0% threshold.
5. **10-Component Batch Analytics:** Full batch execution, distribution scatter, and acceptance breakdown.
6. **Engineering Summary:** Execution latency (< 50 ms), deterministic repeatability, and simulation boundaries.

### 📊 Full Quality Analytics & Exports
- 5 interactive Recharts: Width tolerance band, Height tolerance band, Defect area %, Dimensional scatter plot, and Spatial robot sorting scatter.
- One-click exports: Standardized CSV data, JSON summary, and PNG Matplotlib charts.

### 🧪 Automated Validation & Testing
- In-browser and CLI execution of 58 automated unit and integration tests.
- High-precision in-memory latency profiler measuring execution times and processing-only FPS.

---

## 3. Engineering Specifications & Acceptance Criteria

| Parameter | Value | Engineering Significance |
|---|---|---|
| **Image Resolution** | 800 × 800 pixels | Calibrated 1:1 square inspection field |
| **Calibration Scale** | 5.0 pixels / mm | Resolution: 0.20 mm per pixel |
| **Coordinate Origin** | (400, 400) px | Center of inspection table $(X=0, Y=0)$ |
| **Nominal Dimensions** | 120.0 × 120.0 mm | Design standard specification |
| **Dimensional Limits** | 115.0 – 125.0 mm | Bilateral tolerance: $120 \pm 5$ mm |
| **Defect Intensity Cutoff** | $\mu - 2\sigma$ | Two standard deviations below mean surface intensity |
| **Maximum Defect Density**| 2.000% of surface area | Components with $\ge 2.0\%$ defective pixels are rejected |
| **Robot Pick Coordinate** | $X = (c_x - 400)/5, Y = (400 - c_y)/5, Z = 10$ mm | Directly computed from external contour centroid |
| **PASS Sorting Destination** | $(+350.0, -200.0, 10.0)$ mm | Designated green bin on the right |
| **REJECT Sorting Destination** | $(-350.0, -200.0, 10.0)$ mm | Designated red bin on the left |

---

## 4. Quick Start (Windows)

### Option A: One-Click Startup (Recommended)
Double-click **`run_web.bat`** in the project folder.

The launcher automatically:
1. Detects Python 3.10+ on system PATH.
2. Creates or activates the virtual environment (`.venv`).
3. Installs backend dependencies from `requirements.txt`.
4. Verifies the pre-compiled frontend bundle in `frontend/dist/`.
5. Starts the server with duplicate process prevention and dynamic port allocation (default: `8000`).
6. Polls the health endpoint (`/api/health`) and automatically opens Google Chrome or your default browser at `http://localhost:8000`.

### Option B: Manual Startup via Terminal

```powershell
# 1. Activate environment and install dependencies
cd Robot_Vision_Microproject
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# 2. Launch server
python -m backend.server
```

Open `http://localhost:8000` in your web browser.

---

## 5. Automated Testing

Run the full automated test suite containing all 58 unit, regression, and API tests:

```powershell
python -m pytest tests/ -v
```

**Results:**
- `test_pipeline.py`: 44 tests covering Gaussian smoothing, Otsu binarization, morphological opening/closing, contour centroiding, physical calibration, 2-sigma defect cutoff, robot coordinate transformations, and Stage 2 reference table consistency.
- `test_api.py`: 14 tests covering FastAPI REST endpoints, JSON schemas, health check, benchmarking, and CSV/JSON export endpoints.
- **All 58 tests pass with 100% compliance.**

---

## 6. Historical Reference Alignment

| Part ID | Measured Width (mm) | Measured Height (mm) | Defect Area (%) | Status | Primary Defect Criterion |
|:---:|:---:|:---:|:---:|:---:|:---|
| **P01** | 131.20 | 119.40 | 0.812% | **FAIL** | Dimensional: Width > 125.0 mm |
| **P02** | 118.60 | 121.80 | 3.241% | **FAIL** | Surface Defect: Area $\ge$ 2.0% |
| **P03** | 122.40 | 117.60 | 0.430% | **PASS** | Fully Compliant Benchmark Specimen |
| **P04** | 113.60 | 119.20 | 0.115% | **FAIL** | Dimensional: Width < 115.0 mm |
| **P05** | 121.00 | 122.60 | 1.720% | **PASS** | Compliant (Allowable surface variance) |
| **P06** | 119.40 | 118.00 | 0.087% | **PASS** | Compliant (High-spec finish) |
| **P07** | 127.80 | 124.20 | 4.650% | **FAIL** | Dual Rejection: Width > 125 mm & Defect $\ge$ 2.0% |
| **P08** | 120.60 | 119.80 | 0.320% | **PASS** | Compliant (Nominal centering) |
| **P09** | 116.20 | 121.40 | 0.550% | **PASS** | Compliant (Lower tolerance border) |
| **P10** | 124.80 | 118.60 | 2.180% | **FAIL** | Surface Defect: Area $\ge$ 2.0% |

---

## 7. Publishing to GitHub

To upload this repository to your personal or organization GitHub account:

### Step 1: Create a GitHub Repository
1. Log in to [GitHub](https://github.com/).
2. Click **New Repository** (`+` icon at the top right).
3. Name the repository: **`Robot-Vision-Quality-Inspection`** (or your preferred name).
4. Choose **Public** or **Private**.
5. Do **not** initialize with a README, .gitignore, or license (these already exist locally).
6. Click **Create repository**.

### Step 2: Push Local Code to GitHub
Run the following commands in PowerShell from the project root:

```powershell
cd Robot_Vision_Microproject

# Initialize git repository
git init

# Stage all project files (ignoring .venv, node_modules, etc. per .gitignore)
git add .

# Create initial release commit
git commit -m "feat: ROBOVISION QMS 4.0 - Industrial Quality Inspection Workstation"

# Set default branch to main
git branch -M main

# Add your GitHub repository remote (replace <YOUR_USERNAME> with your GitHub username)
git remote add origin https://github.com/<YOUR_USERNAME>/Robot-Vision-Quality-Inspection.git

# Push to GitHub
git push -u origin main
```

> **Note on Deployment vs. Source Code:**  
> Pushing source code to GitHub hosts the project repository. To host the live FastAPI server publicly on the internet, deploy the backend to a cloud service such as Render, Railway, or AWS EC2, or continue using the local launcher (`run_web.bat`) for on-premise demonstration.

---

## 8. Academic Simulation Disclosure & Boundaries

In accordance with academic integrity guidelines:
- **Synthetic Calibrated Data:** The 10 component images are generated algorithmically with calibrated geometric dimensions, edge noise, and Gaussian-distributed surface defect clusters.
- **Illustrative Robotic Kinematics:** The articulated robotic arm simulation utilizes a 2-link planar geometric inverse kinematics model to visualize the pick-and-sort trajectory between $(X_{pick}, Y_{pick})$ and the PASS/REJECT bins. It does not interface with a physical serial manipulator or hardware microcontroller.
- **Optical Assumptions:** Lighting is modeled as uniform diffuse illumination without optical telecentric lens distortion.

---

## 9. License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
