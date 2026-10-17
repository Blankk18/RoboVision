import React, { useState, useEffect } from 'react';
import { Sidebar, type PageId } from './components/Sidebar';
import { Header } from './components/Header';
import { Overview } from './pages/Overview';
import { Workbench } from './pages/Workbench';
import { BatchAnalytics } from './pages/BatchAnalytics';
import { PipelineExplorer } from './pages/PipelineExplorer';
import { ValidationBenchmark } from './pages/ValidationBenchmark';
import { AboutProject } from './pages/AboutProject';
import { PresentationModal } from './components/PresentationModal';
import { GuidedDemoModal } from './components/GuidedDemoModal';
import { fetchParts, fetchLatestBatch, runBatchInspection } from './api/client';
import type { PartMetadata, BatchStats, BatchPartSummary } from './types/api';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageId>('overview');
  const [selectedPartId, setSelectedPartId] = useState<number>(3);
  const [parts, setParts] = useState<PartMetadata[]>([]);
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null);
  const [batchParts, setBatchParts] = useState<BatchPartSummary[]>([]);
  const [batchLoading, setBatchLoading] = useState<boolean>(false);
  const [presentationMode, setPresentationMode] = useState<boolean>(false);
  const [demoMode, setDemoMode] = useState<boolean>(false);

  // Initialize parts & check if batch was already run
  useEffect(() => {
    fetchParts()
      .then((data) => setParts(data))
      .catch((err) => console.error('Error fetching parts:', err));

    fetchLatestBatch()
      .then((data) => {
        if (data.has_run && data.stats) {
          setBatchStats(data.stats);
          setBatchParts(data.parts);
        }
      })
      .catch((err) => console.error('Error fetching latest batch:', err));
  }, []);

  const handleRunBatch = async () => {
    setBatchLoading(true);
    try {
      const res = await runBatchInspection();
      setBatchStats(res.stats);
      setBatchParts(res.parts);
    } catch (err: any) {
      alert(`Batch inspection error: ${err.message}`);
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090d16] text-slate-100 font-sans">
      {/* Persistent Left Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onSelectPage={setCurrentPage}
        batchPassRate={batchStats?.pass_rate_percent}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          currentPage={currentPage}
          onSelectPage={setCurrentPage}
          onSelectPart={setSelectedPartId}
          onRunBatch={handleRunBatch}
          batchLoading={batchLoading}
          batchStats={batchStats}
          onTogglePresentation={() => setPresentationMode(!presentationMode)}
          onStartDemo={() => setDemoMode(true)}
        />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto">
          {currentPage === 'overview' && (
            <Overview
              onSelectPage={setCurrentPage}
              onSelectPart={setSelectedPartId}
              onRunBatch={handleRunBatch}
              batchLoading={batchLoading}
              batchStats={batchStats}
              batchParts={batchParts}
            />
          )}

          {currentPage === 'workbench' && (
            <Workbench
              selectedPartId={selectedPartId}
              onSelectPart={setSelectedPartId}
              parts={parts}
              onTogglePresentation={() => setPresentationMode(true)}
              onStartDemo={() => setDemoMode(true)}
            />
          )}

          {currentPage === 'batch' && (
            <BatchAnalytics
              stats={batchStats}
              parts={batchParts}
              loading={batchLoading}
              onRunBatch={handleRunBatch}
              onSelectPart={setSelectedPartId}
              onSelectPage={setCurrentPage}
            />
          )}

          {currentPage === 'pipeline' && <PipelineExplorer />}

          {currentPage === 'validation' && (
            <ValidationBenchmark parts={parts} />
          )}

          {currentPage === 'about' && <AboutProject />}
        </main>
      </div>

      {/* Full-Screen Guided Demo Mode */}
      {demoMode && (
        <GuidedDemoModal
          onClose={() => setDemoMode(false)}
          onSelectPart={(id) => {
            setSelectedPartId(id);
            setCurrentPage('workbench');
          }}
          parts={parts}
        />
      )}

      {/* Full-Screen Presentation Mode */}
      {presentationMode && (
        <PresentationModal
          currentPartId={selectedPartId}
          parts={parts}
          onClose={() => setPresentationMode(false)}
          onSelectPart={setSelectedPartId}
        />
      )}
    </div>
  );
};

export default App;
