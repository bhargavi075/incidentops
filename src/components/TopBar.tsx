import React from 'react';
import { Terminal, Cpu, Database, GitCompare, FileText, Code2, Settings, ShieldAlert } from 'lucide-react';

export type ActiveTab = 'triage' | 'before-after' | 'post-mortem' | 'memory-explorer' | 'architecture' | 'python-suite';

interface TopBarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  memoryCount: number;
  onOpenSettings: () => void;
  clusterStatus: 'DEGRADED' | 'HEALTHY' | 'REMEDIATING';
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  memoryCount,
  onOpenSettings,
  clusterStatus
}) => {
  return (
    <header className="border-b border-slate-800 bg-[#0d131f]/90 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3.5">
      <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Cpu className="w-4 h-4" />
          </div>
          <button 
            onClick={() => setActiveTab('triage')} 
            className="text-left font-semibold text-lg tracking-tight text-white hover:text-emerald-400 transition-colors"
          >
            IncidentOps
          </button>
          <span className="hidden sm:inline-block text-xs text-slate-500 font-mono">
            v2.6 · Groq LPU + Hindsight Memory
          </span>
        </div>

        {/* Zone 2: Clean text navigation links */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800/80">
          <button
            onClick={() => setActiveTab('triage')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'triage'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            Live Triage Console
          </button>

          <button
            onClick={() => setActiveTab('before-after')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'before-after'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5 text-amber-400" />
            Before vs After Demo
          </button>

          <button
            onClick={() => setActiveTab('post-mortem')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'post-mortem'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            Post-Mortem Studio
          </button>

          <button
            onClick={() => setActiveTab('memory-explorer')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'memory-explorer'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-purple-400" />
            Memory Explorer
            <span className="font-mono text-xs text-purple-300">({memoryCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'architecture'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
            Visual Architecture
          </button>

          <button
            onClick={() => setActiveTab('python-suite')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'python-suite'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-emerald-400" />
            Python Suite
          </button>
        </nav>

        {/* Zone 3: Primary actions & telemetry indicator */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                clusterStatus === 'HEALTHY'
                  ? 'bg-emerald-400'
                  : clusterStatus === 'REMEDIATING'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500 animate-pulse'
              }`}
            />
            <span className="text-slate-400">Cluster:</span>
            <span
              className={
                clusterStatus === 'HEALTHY'
                  ? 'text-emerald-400'
                  : clusterStatus === 'REMEDIATING'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }
            >
              {clusterStatus}
            </span>
          </div>

          <button
            onClick={onOpenSettings}
            className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
            title="Engine Settings & API Keys"
            aria-label="Engine Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="flex lg:hidden overflow-x-auto gap-1 mt-3 pt-2 border-t border-slate-800/60 pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('triage')}
          className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'triage' ? 'bg-slate-800 text-white' : 'text-slate-400'
          }`}
        >
          Live Triage
        </button>
        <button
          onClick={() => setActiveTab('before-after')}
          className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'before-after' ? 'bg-slate-800 text-white' : 'text-slate-400'
          }`}
        >
          Before vs After
        </button>
        <button
          onClick={() => setActiveTab('post-mortem')}
          className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'post-mortem' ? 'bg-slate-800 text-white' : 'text-slate-400'
          }`}
        >
          Post-Mortem
        </button>
        <button
          onClick={() => setActiveTab('memory-explorer')}
          className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'memory-explorer' ? 'bg-slate-800 text-white' : 'text-slate-400'
          }`}
        >
          Memory Explorer
        </button>
        <button
          onClick={() => setActiveTab('architecture')}
          className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'architecture' ? 'bg-slate-800 text-white' : 'text-slate-400'
          }`}
        >
          Architecture
        </button>
        <button
          onClick={() => setActiveTab('python-suite')}
          className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'python-suite' ? 'bg-slate-800 text-white' : 'text-slate-400'
          }`}
        >
          Python Code
        </button>
      </div>
    </header>
  );
};
