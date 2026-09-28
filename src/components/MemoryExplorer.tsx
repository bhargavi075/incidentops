import React, { useState } from 'react';
import { IncidentMemory } from '../types/incident';
import { hindsightEngine } from '../services/hindsightEngine';
import {
  Database,
  Search,
  Filter,
  Calendar,
  Network,
  Tag,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Terminal,
  Activity
} from 'lucide-react';

interface MemoryExplorerProps {
  memories: IncidentMemory[];
  onRefreshMemories: () => void;
  onSelectForTriage?: (memory: IncidentMemory) => void;
}

export const MemoryExplorer: React.FC<MemoryExplorerProps> = ({
  memories,
  onRefreshMemories,
  onSelectForTriage
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(memories[0]?.id || null);
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');

  const services = ['ALL', ...Array.from(new Set(memories.map(m => m.service)))];

  const filteredMemories = memories.filter(m => {
    const matchesService = selectedService === 'ALL' || m.service === selectedService;
    const query = searchQuery.toLowerCase();
    const matchesQuery =
      !query ||
      m.title.toLowerCase().includes(query) ||
      m.rootCause.toLowerCase().includes(query) ||
      m.service.toLowerCase().includes(query) ||
      m.tags.some(t => t.toLowerCase().includes(query)) ||
      (m.temperExtraction?.entities || []).some(e => e.toLowerCase().includes(query));
    return matchesService && matchesQuery;
  });

  const handleResetDefaults = () => {
    hindsightEngine.resetToDefault();
    onRefreshMemories();
  };

  return (
    <div className="space-y-6">
      {/* Explorer Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">
                Hindsight Memory Bank Explorer
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Inspect active persistent memory records inside bank <span className="font-mono text-purple-300">incidentops-bank</span>. Hindsight unifies BM25 lexical tokens, semantic vectors, chronological timestamps, and causal knowledge graph entities.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {/* View Mode Toggle */}
            <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center gap-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Records View
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  viewMode === 'graph'
                    ? 'bg-purple-900/60 text-purple-200 border border-purple-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Network className="w-3.5 h-3.5 text-purple-400" />
                Causal Topology Graph
              </button>
            </div>

            <button
              onClick={handleResetDefaults}
              className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg transition-colors"
              title="Reset memory bank to original seed outages"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mt-4 pt-4 border-t border-slate-800">
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by keywords, error codes, port numbers, entities, or root cause..."
              className="w-full bg-[#080d16] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50 font-mono"
            />
          </div>

          <div className="sm:col-span-4 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={selectedService}
              onChange={e => setSelectedService(e.target.value)}
              className="w-full bg-[#080d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50 font-mono"
            >
              {services.map(s => (
                <option key={s} value={s}>
                  {s === 'ALL' ? 'All Services' : s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Memory Storage Info Strip */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Storage Engine: <strong className="text-slate-200">Hindsight Memory Bank</strong> (<code className="text-purple-300">incidentops-bank</code>)</span>
          </div>
          <div className="flex items-center gap-3 text-slate-500">
            <span>Client Persistence: <span className="text-sky-300">localStorage</span></span>
            <span>·</span>
            <span>Cloud Target: <span className="text-purple-300">api.hindsight.vectorize.io</span></span>
          </div>
        </div>
      </div>

      {/* Causal Graph View */}
      {viewMode === 'graph' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Network className="w-4 h-4 text-purple-400" />
              Interactive Multi-Dimensional Causal Knowledge Graph
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              Biomimetic links connecting Services → Symptoms → Root Causes → Verified Runbooks
            </span>
          </div>

          {/* SVG Graph Visualization */}
          <div className="bg-[#070b12] border border-slate-800/80 rounded-xl p-6 overflow-x-auto min-h-[380px] flex items-center justify-center">
            <div className="w-full max-w-4xl space-y-6">
              {filteredMemories.map((mem, idx) => (
                <div
                  key={mem.id}
                  className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-3 relative hover:border-purple-500/40 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                    <span className="font-semibold text-xs text-purple-300 font-mono">
                      {mem.id} · {mem.title}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Target: {mem.service}
                    </span>
                  </div>

                  {/* 4-Node Causal Flow Diagram */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
                    <div className="p-2.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-300">
                      <div className="text-[10px] uppercase font-bold text-sky-400 mb-1">
                        1. Service & Cluster
                      </div>
                      <div className="text-[11px] leading-tight font-semibold">
                        {mem.service}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        k8s: prod-us-east-1
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
                      <div className="text-[10px] uppercase font-bold text-rose-400 mb-1">
                        2. Error Signature
                      </div>
                      <div className="text-[11px] leading-tight line-clamp-2">
                        {mem.errorSignature}
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
                      <div className="text-[10px] uppercase font-bold text-amber-400 mb-1">
                        3. Diagnosed Root Cause
                      </div>
                      <div className="text-[11px] leading-tight line-clamp-2">
                        {mem.rootCause}
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                      <div className="text-[10px] uppercase font-bold text-emerald-400 mb-1">
                        4. Executable Runbook
                      </div>
                      <div className="text-[11px] leading-tight truncate" title={mem.cliCommands[0] || mem.causalChain.mitigation}>
                        $ {mem.cliCommands[0] || mem.causalChain.mitigation}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* List Records View */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Showing {filteredMemories.length} persistent memory records</span>
            <span className="font-mono text-purple-300">Channel Mode: 4-Way Parallel</span>
          </div>

          {filteredMemories.map(mem => {
            const isExpanded = expandedId === mem.id;
            return (
              <div
                key={mem.id}
                className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden transition-all"
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : mem.id)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/40 select-none"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-purple-300">
                        {mem.id}
                      </span>
                      <span className="text-slate-600 font-mono">·</span>
                      <span className="text-xs font-semibold text-slate-200">
                        {mem.title}
                      </span>
                      <span className="text-slate-600 font-mono">·</span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {mem.service}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-3">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-slate-600" />
                        {mem.timestamp}
                      </span>
                      <span>·</span>
                      <span className="font-mono text-slate-400">{mem.author}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <div className="flex items-center gap-1">
                      {mem.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Deep Inspection */}
                {isExpanded && (
                  <div className="p-5 border-t border-slate-800/80 bg-slate-950/40 space-y-4 text-xs">
                    {/* Error Signature & Root Cause */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-[#080d16] border border-slate-800 rounded-lg p-3 space-y-1">
                        <div className="text-[11px] font-mono text-slate-400 font-semibold uppercase">
                          Observed Error Signature
                        </div>
                        <p className="font-mono text-[11px] text-rose-300 leading-relaxed">
                          {mem.errorSignature}
                        </p>
                      </div>

                      <div className="bg-[#080d16] border border-slate-800 rounded-lg p-3 space-y-1">
                        <div className="text-[11px] font-mono text-slate-400 font-semibold uppercase">
                          Isolated Root Cause (RCA)
                        </div>
                        <p className="text-slate-300 leading-relaxed">
                          {mem.rootCause}
                        </p>
                      </div>
                    </div>

                    {/* Executable CLI Runbook */}
                    <div className="bg-[#080d16] border border-slate-800 rounded-lg p-4 space-y-2 font-mono">
                      <div className="text-[11px] text-emerald-400 font-semibold uppercase flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5" />
                        Verified Executable Runbook Commands
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {mem.cliCommands.map((cmd, cIdx) => (
                          <div
                            key={cIdx}
                            className="bg-slate-950 p-2 rounded border border-slate-800 text-[11px] text-emerald-300 select-all overflow-x-auto"
                          >
                            $ {cmd}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* TEMPER Extraction Breakdown */}
                    {mem.temperExtraction && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                        <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                          <span className="text-[10px] text-slate-500 uppercase block">Entities</span>
                          <span className="text-slate-300">
                            {mem.temperExtraction.entities.join(', ')}
                          </span>
                        </div>
                        <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                          <span className="text-[10px] text-slate-500 uppercase block">Metrics</span>
                          <span className="text-slate-300">
                            {mem.temperExtraction.metrics.join(', ')}
                          </span>
                        </div>
                        <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                          <span className="text-[10px] text-slate-500 uppercase block">Properties</span>
                          <span className="text-slate-300">
                            {mem.temperExtraction.properties.join(', ')}
                          </span>
                        </div>
                        <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                          <span className="text-[10px] text-slate-500 uppercase block">Resolution Mode</span>
                          <span className="text-emerald-400 truncate block">
                            Deterministic Runbook
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
