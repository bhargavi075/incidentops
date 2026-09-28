import React, { useState, useEffect } from 'react';
import { TopBar, ActiveTab } from './components/TopBar';
import { TriageConsole } from './components/TriageConsole';
import { BeforeAfterDemo } from './components/BeforeAfterDemo';
import { PostMortemStudio } from './components/PostMortemStudio';
import { MemoryExplorer } from './components/MemoryExplorer';
import { ArchitectureDoc } from './components/ArchitectureDoc';
import { PythonSuiteViewer } from './components/PythonSuiteViewer';
import { SettingsModal } from './components/SettingsModal';
import { hindsightEngine } from './services/hindsightEngine';
import { IncidentMemory } from './types/incident';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('triage');
  const [memories, setMemories] = useState<IncidentMemory[]>([]);
  const [clusterStatus, setClusterStatus] = useState<'DEGRADED' | 'HEALTHY' | 'REMEDIATING'>('DEGRADED');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const refreshMemories = () => {
    setMemories(hindsightEngine.getMemories());
  };

  useEffect(() => {
    refreshMemories();
  }, []);

  const handleIncidentResolved = () => {
    setClusterStatus('HEALTHY');
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-200 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* 3-Zone Top Navigation Bar */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        memoryCount={memories.length}
        onOpenSettings={() => setIsSettingsOpen(true)}
        clusterStatus={clusterStatus}
      />

      {/* Main Content Viewport Container */}
      <main className="flex-1 max-w-[1800px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
        {activeTab === 'triage' && (
          <TriageConsole
            onIncidentResolved={handleIncidentResolved}
            clusterStatus={clusterStatus}
            setClusterStatus={setClusterStatus}
            onMemoryAdded={refreshMemories}
          />
        )}

        {activeTab === 'before-after' && (
          <BeforeAfterDemo />
        )}

        {activeTab === 'post-mortem' && (
          <PostMortemStudio
            onMemoryAdded={refreshMemories}
            onNavigateToTriage={() => setActiveTab('triage')}
          />
        )}

        {activeTab === 'memory-explorer' && (
          <MemoryExplorer
            memories={memories}
            onRefreshMemories={refreshMemories}
          />
        )}

        {activeTab === 'architecture' && (
          <ArchitectureDoc />
        )}

        {activeTab === 'python-suite' && (
          <PythonSuiteViewer />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#090d16] py-4 px-6 text-xs text-slate-500 font-mono">
        <div className="max-w-[1800px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            IncidentOps · Autonomous SRE Root-Cause & Runbook Memory Agent
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Groq LPU (<span className="text-emerald-400">openai/gpt-oss-120b</span>)</span>
            <span>·</span>
            <span>Hindsight (<span className="text-purple-400">incidentops-bank</span>)</span>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onBankReset={refreshMemories}
      />
    </div>
  );
}
