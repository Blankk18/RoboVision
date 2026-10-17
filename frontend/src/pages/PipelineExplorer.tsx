import React, { useState, useEffect } from 'react';
import {
  Layers,
  Info,
  Sliders,
  CheckCircle2,
  Code2,
  BookOpen,
  ArrowRight,
  ZoomIn,
} from 'lucide-react';
import { inspectPart } from '../api/client';
import type { InspectionResult, PipelineStage } from '../types/api';
import { StageModal } from '../components/StageModal';
import { padPartId } from '../utils/format';


export const PipelineExplorer: React.FC = () => {
  const [selectedPartId, setSelectedPartId] = useState<number>(3);
  const [inspection, setInspection] = useState<InspectionResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeStageModal, setActiveStageModal] = useState<PipelineStage | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    inspectPart(selectedPartId)
      .then((res) => {
        if (isMounted) setInspection(res);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedPartId]);

  const stagesDocumentation = [
    {
      id: 1,
      title: 'Original Synthetic Image Acquisition',
      purpose: 'Generate and load calibrated 800×800 grayscale test component images with controlled dimensions and noise.',
      input: 'Parametric component specification (width, height, defect ratio, pick offsets).',
      output: '800×800 8-bit single-channel grayscale image (uint8, values 0–255).',
      rational: 'Provides ground-truth test data with known dimensional tolerances and clustered surface blemishes for reliable algorithm validation without physical camera variability.',
      parameters: [
        { label: 'Canvas Dimension', value: '800 × 800 px' },
        { label: 'Spatial Calibration Scale', value: '5.0 pixels / mm' },
        { label: 'Nominal Physical Size', value: '120.0 mm (600 px)' },
        { label: 'Coordinate Frame Origin', value: '(400.0, 400.0) px' },
      ],
      math: 'I_{raw}(x, y) = I_{roi}(x, y) + \mathcal{N}(0, \sigma_{sensor}^2)',
    },
    {
      id: 2,
      title: 'Gaussian Spatial Filtering',
      purpose: 'Smooth high-frequency acquisition noise while preserving edge boundaries for binarization.',
      input: '800×800 grayscale image.',
      output: 'Blurred 800×800 image with suppressed speckle noise.',
      rational: 'A 5×5 kernel with isotropic σ = 1.4 eliminates single-pixel sensor noise without blurring the sharp workpiece borders required for accurate edge detection.',
      parameters: [
        { label: 'Kernel Size', value: '5 × 5 (odd, symmetric)' },
        { label: 'Standard Deviation (σ)', value: '1.4' },
        { label: 'Border Mode', value: 'cv2.BORDER_DEFAULT' },
      ],
      math: 'G(x, y) = \\frac{1}{2\\pi\\sigma^2} \\exp\\left(-\\frac{x^2 + y^2}{2\\sigma^2}\\right)',
    },
    {
      id: 3,
      title: 'Otsu Automatic Binarization',
      purpose: 'Separate the aluminium plate foreground from the background without manual threshold tuning.',
      input: 'Filtered grayscale image.',
      output: 'Binary mask (0: background, 255: workpiece foreground).',
      rational: 'Otsu’s algorithm maximizes the between-class variance \\(\\sigma_B^2\\) of the bimodal image histogram, dynamically adapting to ambient illumination variations.',
      parameters: [
        { label: 'Threshold Mode', value: 'cv2.THRESH_BINARY + cv2.THRESH_OTSU' },
        { label: 'Target Value', value: '255 (Pure White Foreground)' },
        { label: 'Determined Cutoff', value: inspection ? `${inspection.measurements.threshold_value} / 255` : 'Dynamic' },
      ],
      math: '\\sigma_B^2(t) = \\omega_0(t) \\omega_1(t) \\left[\\mu_0(t) - \\mu_1(t)\\right]^2',
    },
    {
      id: 4,
      title: 'Morphological Refinement (Close → Open)',
      purpose: 'Clean internal holes, connect hairline fractures, and eliminate boundary spurs.',
      input: 'Raw binary mask from Otsu thresholding.',
      output: 'Cleaned solid binary mask representing component silhouette.',
      rational: 'A 9×9 rectangular structuring element closing (dilation followed by erosion) seals internal surface voids. Subsequent opening removes isolated speckle pixels outside the plate.',
      parameters: [
        { label: 'Structuring Element', value: '9 × 9 Rectangular (cv2.MORPH_RECT)' },
        { label: 'Operation 1', value: 'Morphological CLOSE (Dilation → Erosion)' },
        { label: 'Operation 2', value: 'Morphological OPEN (Erosion → Dilation)' },
      ],
      math: 'A \\bullet B = (A \\oplus B) \\ominus B \\quad \\text{then} \\quad (A \\bullet B) \\circ B',
    },
    {
      id: 5,
      title: 'External Contour Detection & Centroid Moments',
      purpose: 'Extract outer component boundary, fit bounding box, and compute physical dimensions.',
      input: 'Morphologically cleaned binary mask.',
      output: 'Contour hierarchy, axis-aligned bounding box (x, y, w, h), and centroid coordinates.',
      rational: 'Extracts the largest external contour using RETR_EXTERNAL. Spatial moments m00, m10, m01 yield the exact center of gravity for robot gripper placement.',
      parameters: [
        { label: 'Contour Retrieval', value: 'cv2.RETR_EXTERNAL' },
        { label: 'Approximation Method', value: 'cv2.CHAIN_APPROX_SIMPLE' },
        { label: 'Centroid Calculation', value: 'cx = m10/m00, cy = m01/m00' },
        { label: 'Dimension Formula', value: 'W_{mm} = w_{px} / 5.0, H_{mm} = h_{px} / 5.0' },
      ],
      math: 'm_{pq} = \\sum_{x} \\sum_{y} x^p y^q I(x, y), \\quad c_x = \\frac{m_{10}}{m_{00}}, \\quad c_y = \\frac{m_{01}}{m_{00}}',
    },
    {
      id: 6,
      title: 'Statistical Surface Defect Detection',
      purpose: 'Isolate anomalous dark spots, pits, and scratches inside the component ROI.',
      input: 'Original grayscale image masked to the component bounding box ROI.',
      output: 'Defect mask (pixels &lt; μ - 2σ) and computed defect surface area percentage.',
      rational: 'Aluminium surfaces naturally reflect light with Gaussian distribution. Pixels darker than two standard deviations below the mean intensity represent structural scratches or pits.',
      parameters: [
        { label: 'ROI Mask', value: 'Axis-aligned bounding box' },
        { label: 'Intensity Cutoff Formula', value: 'Threshold = μ_{surface} - 2.0 × σ_{surface}' },
        { label: 'Defect Rejection Threshold', value: '2.0% of total surface pixels' },
      ],
      math: 'D(x, y) = \\begin{cases} 1 & \\text{if } I(x, y) < (\\mu - 2\\sigma) \\text{ and } (x, y) \\in \\text{ROI} \\\\ 0 & \\text{otherwise} \\end{cases}',
    },
    {
      id: 7,
      title: 'Quality Acceptance Rules & Sorting Coordinates',
      purpose: 'Combine dimensional and defect evaluations into final PASS/FAIL verdict and compute robot pick coordinates.',
      input: 'Measured width, measured height, defect percentage, and image centroid.',
      output: 'Binary PASS/FAIL status, rejection rationale, and (X, Y, Z) mm robot pick coordinates.',
      rational: 'Deterministic Boolean decision logic ensures zero tolerance for non-compliant industrial components. Converts camera frame origin (400, 400) to standard robot base frame.',
      parameters: [
        { label: 'Width Tolerance', value: '115.0 mm ≤ Width ≤ 125.0 mm' },
        { label: 'Height Tolerance', value: '115.0 mm ≤ Height ≤ 125.0 mm' },
        { label: 'Defect Limit', value: 'Defect Area < 2.0%' },
        { label: 'Pick Coordinate Transform', value: 'X = (cx - 400)/5, Y = (400 - cy)/5, Z = 10.0' },
      ],
      math: '\\text{Status} = (115 \\le W \\le 125) \\land (115 \\le H \\le 125) \\land (\\%_D < 2.0)',
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-[#0c121e] border border-[#1e293b]">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            Computer Vision Pipeline Architecture
          </h2>
          <p className="text-xs text-slate-400">
            Algorithmic principles, mathematical foundations, and verified execution parameters.
          </p>
        </div>

        {/* Live Part Selector for Pipeline Preview */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Inspect Part:</span>
          {[3, 7, 2, 1].map((pid) => (
            <button
              key={pid}
              onClick={() => setSelectedPartId(pid)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors ${
                selectedPartId === pid
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'bg-[#131c2e] text-slate-400 hover:text-white border border-[#1e293b]'
              }`}
            >
              Part {padPartId(pid)}
            </button>
          ))}
        </div>
      </div>

      {/* Seven Detailed Algorithm Cards */}
      <div className="space-y-6">
        {stagesDocumentation.map((doc, idx) => {
          const currentStageImage = inspection?.stages[idx]?.image;
          return (
            <div
              key={doc.id}
              className="p-6 rounded-xl bg-[#0c121e] border border-[#1e293b] hover:border-cyan-500/40 transition-all space-y-4"
            >
              {/* Card Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1e293b] pb-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/50 flex items-center justify-center font-mono font-bold text-sm text-cyan-400">
                    0{doc.id}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">
                      Stage {doc.id}: {doc.title}
                    </h3>
                    <p className="text-xs text-slate-400">{doc.purpose}</p>
                  </div>
                </div>

                {currentStageImage && (
                  <button
                    onClick={() => setActiveStageModal(inspection!.stages[idx])}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#131c2e] hover:bg-[#1b2840] border border-cyan-800/40 text-cyan-300 transition-colors"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Enlarge Stage Image</span>
                  </button>
                )}
              </div>

              {/* Main Content Layout: Explanation vs Real Image */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Left/Middle Details (Col 8) */}
                <div className="md:col-span-8 space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                      Algorithmic Rationale:
                    </span>
                    <p className="text-slate-300 leading-relaxed">{doc.rational}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e293b]">
                      <span className="text-slate-400 font-semibold block mb-1">Input Data:</span>
                      <span className="text-slate-200">{doc.input}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0f172a] border border-[#1e293b]">
                      <span className="text-slate-400 font-semibold block mb-1">Output Data:</span>
                      <span className="text-slate-200">{doc.output}</span>
                    </div>
                  </div>

                  {/* Mathematical Formulation */}
                  <div className="p-3 rounded-lg bg-[#0a0f1d] border border-cyan-900/30 font-mono text-[11px] text-cyan-300 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-sans">
                        Mathematical Formulation:
                      </span>
                      <span>{doc.math}</span>
                    </div>
                    <Code2 className="w-4 h-4 text-cyan-500/50 shrink-0" />
                  </div>

                  {/* Parameter Checklist */}
                  <div className="pt-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Verified Code Parameters:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {doc.parameters.map((param, pIdx) => (
                        <div
                          key={pIdx}
                          className="flex items-center justify-between p-2 rounded bg-[#0f172a]/60 border border-[#1e293b]/60"
                        >
                          <span className="text-slate-400 font-mono">{param.label}</span>
                          <span className="text-slate-200 font-mono font-medium">{param.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Actual Output Image Preview (Col 4) */}
                <div className="md:col-span-4 bg-[#080d1a] border border-[#1e293b] rounded-lg p-2.5 flex flex-col items-center justify-center space-y-2">
                  <div className="w-full flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Live Output (Part {padPartId(selectedPartId)})</span>
                    <span className="text-cyan-400">800×800 px</span>
                  </div>

                  {currentStageImage ? (
                    <img
                      src={currentStageImage}
                      alt={doc.title}
                      className="w-full h-auto max-h-56 object-contain rounded border border-[#1e293b]/70"
                    />
                  ) : (
                    <div className="h-44 flex items-center justify-center text-slate-600 text-xs font-mono">
                      Loading stage image...
                    </div>
                  )}

                  <span className="text-[10px] text-slate-500 text-center">
                    Computed dynamically by src/vision_pipeline.py
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeStageModal && (
        <StageModal
          stage={activeStageModal}
          partId={selectedPartId}
          onClose={() => setActiveStageModal(null)}
        />
      )}
    </div>
  );
};
