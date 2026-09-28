import React, { useState } from 'react';
import { PRESET_LOGS } from '../data/seedData';
import { LogPreset, TriageAnalysis, Severity } from '../types/incident';
import { hindsightEngine } from '../services/hindsightEngine';
import { groqService } from '../services/groqEngine';
import { TerminalRunner } from './TerminalRunner';
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Coins,
  Copy,
  Check,
  ChevronRight,
  Database,
  ArrowRight,
  Network,
  RotateCcw,
  Terminal as TerminalIcon,
  PlusCircle,
  X,
  FileText,
  Sparkles,
  Layers,
  Wand2,
  BookmarkPlus
} from 'lucide-react';

interface TriageConsoleProps {
  onIncidentResolved: () => void;
  clusterStatus: 'DEGRADED' | 'HEALTHY' | 'REMEDIATING';
  setClusterStatus: (status: 'DEGRADED' | 'HEALTHY' | 'REMEDIATING') => void;
  onMemoryAdded?: () => void;
}

const PROBLEM_TEMPLATES = [
  {
    name: 'Postgres Connection Exhaustion',
    service: 'data-platform-analytics',
    severity: 'P1-CRITICAL' as Severity,
    scenario: 'PostgreSQL Saturation' as const,
    title: 'PostgreSQL Max Connections Exceeded on Port 5432',
    log: `2026-09-28T07:22:11.008Z [FATAL] PostgreSQL primary postgresql-cluster-0:
FATAL: remaining connection slots are reserved for non-superuser connections
DETAIL: Database connection limit (max_connections=500) reached. Active connections: 500, waiting: 84.
2026-09-28T07:22:12.115Z [ERROR] billing-service-deployment: sqlalchemy.exc.OperationalError: could not connect to server: Connection refused
Target host: pg-primary.internal:5432 (direct unpooled connection). Triggered by analytics_nightly_rollup.`,
    rootCause: 'Unpooled database connections saturated PostgreSQL max_connections limit.',
    command: 'psql -h pg-primary.internal -U postgres -d core_db -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = \'idle in transaction\';"'
  },
  {
    name: 'Redis 6379 Zombie Socket Leak',
    service: 'checkout-service',
    severity: 'P1-CRITICAL' as Severity,
    scenario: 'Redis Pool Exhaustion' as const,
    title: 'Redis Port 6379 Connection Pool Exhaustion on Checkout Worker',
    log: `2026-09-28T08:11:04.112Z [ERROR] checkout-cluster-worker-08: HTTP 504 Gateway Timeout
redis.exceptions.ConnectionError: Error 111 connecting to redis-master.production.svc.cluster.local:6379. Connection pool exhausted (max 10000 connections reached).
Active leases: 9998, idle dead leases: 7420, client_type: normal. Latency P99 > 30,000ms.`,
    rootCause: 'Zombie connection leak in redis-py connection pool failing to release client leases on port 6379.',
    command: 'redis-cli -h redis-master.production.svc.cluster.local -p 6379 client kill type normal'
  },
  {
    name: 'Kafka Deserialization Poison Pill',
    service: 'payment-stream',
    severity: 'P1-CRITICAL' as Severity,
    scenario: 'Kafka Deserialization' as const,
    title: 'Kafka Consumer Group Poison Pill Deserialization CrashLoop',
    log: `2026-09-28T08:15:18.940Z [ERROR] payment-processor-v2 [Worker-Thread-14]:
org.apache.kafka.common.errors.SerializationException: Error deserializing key/value for partition payments.incoming-4 at offset 18492041
Caused by: com.fasterxml.jackson.databind.exc.MismatchedInputException: Missing mandatory JSON property 'currency_code'
[METRIC ALERT] ConsumerLagExceededThreshold: current lag = 54,210 messages.`,
    rootCause: 'Poison pill message without mandatory currency_code causing deserialization crash loop.',
    command: 'kafka-consumer-groups.sh --bootstrap-server kafka-broker:9092 --group payment-processor-v2 --topic payments.incoming --reset-offsets --shift-by 1 --execute'
  },
  {
    name: 'Kubernetes Pod OOMKilled (Exit 137)',
    service: 'api-gateway',
    severity: 'P1-CRITICAL' as Severity,
    scenario: 'Novel Kubernetes OOM' as const,
    title: 'Kubernetes OOMKilled Container ExitCode 137',
    log: `2026-09-28T08:19:01.312Z [CRITICAL] kube-system / ingress-controller-envoy-9d7a2:
Event: Pod /ingress-controller-envoy-9d7a2 terminated with ExitCode: 137 (OOMKilled)
Memory usage exceeded cgroup limit: 2048MiB / 2048MiB.
High connection churn: TLS handshake buffers allocated 1.8GB during traffic burst.
Incoming traffic dropped: 14,200 connections refused.`,
    rootCause: 'Container memory limit exceeded due to unconstrained buffer allocation during burst traffic.',
    command: 'kubectl scale deployment/ingress-controller-envoy --replicas=8 -n kube-system'
  },
  {
    name: 'Microservice 504 Gateway Timeout',
    service: 'auth-service',
    severity: 'P2-HIGH' as Severity,
    scenario: 'Mutated Checkout Alert' as const,
    title: 'Ingress 504 Gateway Timeout during Identity Verification',
    log: `2026-09-28T08:24:45.102Z [WARN] ingress-gateway: [upstream_response_timeout] HTTP 504 Gateway Timeout
Endpoint: POST /api/v1/auth/verify-token - duration 30002ms (threshold: 5000ms).
Upstream node auth-worker-prod-02 unresponsive. TCP connection resets observed on port 8080.`,
    rootCause: 'Upstream identity service thread pool exhaustion under spike load.',
    command: 'kubectl rollout restart deployment/auth-worker-prod -n production'
  }
];

export const TriageConsole: React.FC<TriageConsoleProps> = ({
  onIncidentResolved,
  clusterStatus,
  setClusterStatus,
  onMemoryAdded
}) => {
  const [customPresets, setCustomPresets] = useState<LogPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<LogPreset>(PRESET_LOGS[1]); // Default to Mutated Alert
  const [logText, setLogText] = useState<string>(PRESET_LOGS[1].logSnippet);
  const [isTriaging, setIsTriaging] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<TriageAnalysis | null>(null);
  const [compareMode, setCompareMode] = useState<boolean>(true);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [terminalCommands, setTerminalCommands] = useState<string[]>([]);
  const [showTerminal, setShowTerminal] = useState<boolean>(false);

  // Manual Problem Modal States
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('Custom Production Outage');
  const [manualService, setManualService] = useState('payment-gateway');
  const [manualSeverity, setManualSeverity] = useState<Severity>('P1-CRITICAL');
  const [manualLog, setManualLog] = useState('');
  const [manualRootCause, setManualRootCause] = useState('');
  const [manualRunbookCommand, setManualRunbookCommand] = useState('');
  const [retainInMemory, setRetainInMemory] = useState(false);
  const [saveAsQuickPreset, setSaveAsQuickPreset] = useState(true);

  const handleSelectPreset = (preset: LogPreset) => {
    setSelectedPreset(preset);
    setLogText(preset.logSnippet);
    setAnalysis(null);
    setShowTerminal(false);
    setClusterStatus('DEGRADED');
  };

  const handleRunTriageWithText = async (customText?: string) => {
    const textToTriage = customText !== undefined ? customText : logText;
    if (!textToTriage.trim()) return;
    setIsTriaging(true);
    setClusterStatus('DEGRADED');

    try {
      // Step 1: Zero-cost 4-channel memory recall via Hindsight
      const recalled = hindsightEngine.recall(textToTriage);

      // Step 2: High-speed Groq LPU inference (with optional comparison)
      const result = await groqService.triage(textToTriage, recalled, compareMode);
      setAnalysis(result);

      if (result.recommendedRunbook && result.recommendedRunbook.length > 0) {
        setTerminalCommands(result.recommendedRunbook.map(r => r.command));
        setShowTerminal(true);
      }
    } catch (err) {
      console.error('Triage error:', err);
    } finally {
      setIsTriaging(false);
    }
  };

  const handleRunTriage = () => {
    handleRunTriageWithText();
  };

  const handleApplyTemplate = (tmpl: typeof PROBLEM_TEMPLATES[0]) => {
    setManualTitle(tmpl.title);
    setManualService(tmpl.service);
    setManualSeverity(tmpl.severity);
    setManualLog(tmpl.log);
    setManualRootCause(tmpl.rootCause);
    setManualRunbookCommand(tmpl.command);
  };

  const handleClearTemplate = () => {
    setManualTitle('');
    setManualService('custom-service');
    setManualSeverity('P1-CRITICAL');
    setManualLog('');
    setManualRootCause('');
    setManualRunbookCommand('');
  };

  const handleSaveManualProblem = (autoTriage: boolean = true) => {
    if (!manualLog.trim()) return;

    const newPresetId = `preset-custom-${Date.now()}`;
    const newPreset: LogPreset = {
      id: newPresetId,
      title: manualTitle.trim() || `Manual Alert: ${manualService}`,
      service: manualService.trim() || 'custom-service',
      severity: manualSeverity,
      scenario: 'Mutated Checkout Alert', // default category
      logSnippet: manualLog.trim(),
      isMutated: false,
      isNovel: true
    };

    // If user requested to ingest this into the Hindsight Memory Bank right away:
    if (retainInMemory) {
      hindsightEngine.retain({
        title: newPreset.title,
        service: newPreset.service,
        severity: manualSeverity,
        content: manualLog.trim(),
        rootCause: manualRootCause.trim() || 'Manual user-defined operational failure',
        runbookCommands: manualRunbookCommand.trim() ? [manualRunbookCommand.trim()] : ['kubectl get pods -n production'],
        author: 'sre-manual-entry@company.internal'
      });
      onMemoryAdded?.();
    }

    if (saveAsQuickPreset) {
      setCustomPresets(prev => [newPreset, ...prev]);
    }

    setSelectedPreset(newPreset);
    setLogText(newPreset.logSnippet);
    setIsManualModalOpen(false);

    if (autoTriage) {
      handleRunTriageWithText(newPreset.logSnippet);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleRemediationFinished = () => {
    setClusterStatus('HEALTHY');
    onIncidentResolved();
  };

  const allPresets = [...customPresets, ...PRESET_LOGS];

  return (
    <div className="space-y-6">
      {/* Console Header & Presets */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 lg:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              Live Alert Triage Console
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Cross-examines live cluster telemetry against Hindsight biomimetic memory banks using Groq LPU ultra-low latency inference.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (!manualLog) handleApplyTemplate(PROBLEM_TEMPLATES[0]);
                setIsManualModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg shadow-sm shadow-emerald-500/20 transition-all cursor-pointer ring-1 ring-emerald-400/50 hover:shadow-emerald-500/30"
              title="Add your own custom outage or problem manually"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Add Problem Manually</span>
            </button>
          </div>
        </div>

        {/* Preset & Custom scenario pills */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            Select Outage Scenario ({allPresets.length} Available):
          </span>
          {customPresets.length > 0 && (
            <span className="text-xs font-mono text-sky-400">
              {customPresets.length} Custom Problem{customPresets.length > 1 ? 's' : ''} Active
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
          {allPresets.map(preset => {
            const isSelected = selectedPreset.id === preset.id;
            const isCustom = preset.id.startsWith('preset-custom');
            return (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`text-left p-2.5 rounded-lg border text-xs transition-all relative ${
                  isSelected
                    ? 'bg-slate-800 border-emerald-500/50 text-white shadow-sm ring-1 ring-emerald-500/30'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-slate-200 truncate flex items-center justify-between">
                  <span className="truncate">{preset.title.length > 25 ? preset.title.substring(0, 24) + '...' : preset.title}</span>
                  {isCustom && (
                    <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">
                      Custom
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                  <span className="truncate max-w-[90px]">{preset.service}</span>
                  <span
                    className={
                      preset.isNovel
                        ? 'text-amber-400 font-medium'
                        : preset.isMutated
                        ? 'text-sky-400 font-medium'
                        : 'text-emerald-400'
                    }
                  >
                    {isCustom ? 'Custom' : preset.isNovel ? 'Novel' : preset.isMutated ? 'Mutated' : 'Historical'}
                  </span>
                </div>
              </button>
            );
          })}

          {/* Quick-add tile button */}
          <button
            onClick={() => {
              if (!manualLog) handleApplyTemplate(PROBLEM_TEMPLATES[0]);
              setIsManualModalOpen(true);
            }}
            className="text-left p-2.5 rounded-lg border border-dashed border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-300 hover:text-emerald-200 transition-all flex flex-col justify-center items-center text-center group cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform mb-1" />
            <span className="text-xs font-semibold">+ Custom Problem</span>
            <span className="text-[10px] text-emerald-400/70">Create or paste log</span>
          </button>
        </div>
      </div>

      {/* Main Split Workspace: Log Input & Triage Execution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Error Log Input (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col h-[520px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                Incoming Telemetry / Error Log Stream
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (!manualLog) handleApplyTemplate(PROBLEM_TEMPLATES[0]);
                    setIsManualModalOpen(true);
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                >
                  <PlusCircle className="w-3 h-3" /> Add Manually
                </button>
                <button
                  onClick={() => setLogText('')}
                  className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              </div>
            </div>

            <textarea
              value={logText}
              onChange={e => setLogText(e.target.value)}
              placeholder="Paste raw log lines, Datadog alerts, or Kubernetes exception traces..."
              className="flex-1 w-full bg-[#070b12] border border-slate-800/80 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none leading-relaxed"
            />

            <div className="pt-3 border-t border-slate-800/80 mt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-mono text-slate-300">
                  <input
                    type="checkbox"
                    checked={compareMode}
                    onChange={e => setCompareMode(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span>⚖️ Compare with Stateless LLM</span>
                </label>
              </div>

              <button
                onClick={handleRunTriage}
                disabled={isTriaging || !logText.trim()}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-emerald-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTriaging ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    Triaging Telemetry...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    Triage Alert with IncidentOps
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Reasoning & Memory Results (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {!analysis && !isTriaging && (
            <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-xl p-10 h-[520px] flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-sm font-semibold text-slate-200">Awaiting Telemetry Ingestion</h2>
              <p className="text-xs text-slate-400 max-w-md mt-1">
                Select an enterprise scenario above or paste an active error log, then click <strong className="text-slate-200 font-medium">Triage Alert with IncidentOps</strong> to cross-examine memory and generate an executable runbook.
              </p>
            </div>
          )}

          {isTriaging && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 h-[520px] flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Database className="w-5 h-5 text-emerald-400 animate-pulse" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Executing Autonomous Triage Pipeline</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  1. Parallel 4-channel Hindsight recall ($0.00 cost)...<br />
                  2. Groq LPU sub-second causal reasoning...
                </p>
              </div>
            </div>
          )}

          {analysis && !isTriaging && (
            <div className="space-y-4">
              {/* Telemetry & Performance Header Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-mono">Reasoning Latency</div>
                    <div className="text-xs font-mono font-bold text-white">{analysis.latencyMs} ms</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-sky-400" />
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-mono">Retrieval Cost</div>
                    <div className="text-xs font-mono font-bold text-sky-300">$0.00 (0 Tokens)</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-purple-400" />
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-mono">Inference Engine</div>
                    <div className="text-xs font-mono font-bold text-purple-300 truncate max-w-[110px]" title={analysis.inferenceModel}>
                      Groq LPU ({analysis.inferenceModel.split('/')[1] || analysis.inferenceModel})
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {analysis.status === 'KNOWN_INCIDENT' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  )}
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-mono">Classification</div>
                    <div
                      className={`text-xs font-mono font-bold ${
                        analysis.status === 'KNOWN_INCIDENT' ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {analysis.confidenceRating}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4-Channel Hindsight Memory Recall Breakdown */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-semibold text-slate-200">
                      Hindsight 4-Channel Biomimetic Recall
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">· Bank: incidentops-bank</span>
                  </div>

                  {analysis.recalledMemory && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      {analysis.recalledMemory.matchType.replace(/_/g, ' ')} · {(analysis.recalledMemory.compositeScore * 100).toFixed(0)}% Match
                    </span>
                  )}
                </div>

                {analysis.recalledMemory ? (
                  <div className="space-y-3">
                    <div className="bg-[#080d16] border border-slate-800/80 rounded-lg p-3">
                      <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                        <span>{analysis.recalledMemory.memory.title}</span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {analysis.recalledMemory.memory.id} · {analysis.recalledMemory.memory.timestamp.split(' ')[0]}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                        {analysis.recalledMemory.memory.rootCause}
                      </p>
                    </div>

                    {/* The 4 Parallel Channels Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {analysis.recalledMemory.channelScores.map((ch, idx) => (
                        <div key={idx} className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-xs">
                          <div className="flex items-center justify-between text-slate-400 mb-1">
                            <span className="text-[10px] uppercase font-mono">{ch.name}</span>
                            <span className="font-mono font-bold text-slate-200">
                              {(ch.score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1.5">
                            <div
                              className={`h-full rounded-full ${
                                ch.channel === 'bm25'
                                  ? 'bg-emerald-400'
                                  : ch.channel === 'vector'
                                  ? 'bg-sky-400'
                                  : ch.channel === 'temporal'
                                  ? 'bg-amber-400'
                                  : 'bg-purple-400'
                              }`}
                              style={{ width: `${Math.round(ch.score * 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-500 truncate" title={ch.detail}>
                            {ch.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-400">
                    <p className="font-medium text-amber-300/90">
                      No matching historical incident found in memory bank (Novel Outage).
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Zero retrieval tokens consumed. The system synthesized generic cluster diagnostics. Once resolved, submit a post-mortem to retain this incident.
                    </p>
                  </div>
                )}
              </div>

              {/* Side-by-Side Comparison (if enabled) OR Direct IncidentOps Card */}
              {analysis.statelessComparison ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Stateless LLM Baseline */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-semibold text-rose-400 font-mono flex items-center gap-1.5">
                        ❌ Stateless LLM Baseline (Zero Memory)
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {analysis.statelessComparison.latencyMs} ms
                      </span>
                    </div>

                    <div className="bg-rose-950/20 border border-rose-900/40 rounded-lg p-2.5 text-xs text-rose-300">
                      <strong>Generic Diagnosis:</strong> {analysis.statelessComparison.diagnosis}
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 font-mono">
                        Generic Suggested Commands:
                      </span>
                      {analysis.statelessComparison.runbook.map(cmd => (
                        <div
                          key={cmd.stepNumber}
                          className="bg-[#080d16] border border-slate-800 rounded p-2 text-xs font-mono text-slate-400"
                        >
                          <span className="text-slate-600 select-none">$ </span>
                          {cmd.command}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: IncidentOps with Hindsight */}
                  <div className="bg-slate-900/60 border border-emerald-500/30 rounded-xl p-4 space-y-3 shadow-lg shadow-emerald-500/5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-semibold text-emerald-400 font-mono flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        ✅ IncidentOps (Hindsight Memory)
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">
                        {analysis.latencyMs} ms
                      </span>
                    </div>

                    <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 space-y-1">
                      <div className="text-xs font-bold text-slate-200">Diagnosed Root Cause:</div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {analysis.rootCauseSummary}
                      </p>
                    </div>

                    {/* Safety Badge */}
                    {analysis.safetyReport && (
                      <div
                        className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold border ${
                          analysis.safetyReport.isSafe
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {analysis.safetyReport.badge}
                      </div>
                    )}

                    {/* Executable CLI Runbook */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-300 font-mono">
                          Verified CLI Runbook:
                        </span>
                        <button
                          onClick={() => setShowTerminal(true)}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 font-mono"
                        >
                          CLI <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      {analysis.recommendedRunbook.map(step => (
                        <div
                          key={step.stepNumber}
                          className="bg-[#080d16] border border-slate-800 rounded p-2 text-xs font-mono space-y-1"
                        >
                          <div className="flex items-center justify-between text-slate-400 text-[10px]">
                            <span className="truncate">{step.description}</span>
                            <button
                              onClick={() => handleCopy(step.command)}
                              className="p-0.5 text-slate-400 hover:text-white"
                            >
                              {copiedCmd === step.command ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <div className="text-emerald-300 select-all overflow-x-auto py-0.5 scrollbar-none text-[11px]">
                            $ {step.command}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Standard Groq LPU Root Cause & Remediation Card */
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      Groq LPU Incident Diagnosis
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      Confidence: {analysis.confidenceScore}%
                    </span>
                  </div>

                  <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="text-xs font-bold text-slate-200">
                      Root Cause:
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {analysis.rootCauseSummary}
                    </p>
                    <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                      {analysis.impactAssessment}
                    </p>
                  </div>

                  {/* Safety Badge */}
                  {analysis.safetyReport && (
                    <div
                      className={`px-3 py-1.5 rounded text-xs font-mono font-semibold border ${
                        analysis.safetyReport.isSafe
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {analysis.safetyReport.badge}
                    </div>
                  )}

                  {/* Executable CLI Runbook */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">
                        Actionable Remediation Runbook ({analysis.recommendedRunbook.length} Steps)
                      </span>
                      <button
                        onClick={() => setShowTerminal(true)}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono"
                      >
                        Open Interactive CLI <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      {analysis.recommendedRunbook.map(step => (
                        <div
                          key={step.stepNumber}
                          className="bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-xs font-mono space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span className="font-semibold text-slate-300">
                              Step {step.stepNumber}: {step.description}
                            </span>
                            <button
                              onClick={() => handleCopy(step.command)}
                              className="p-1 text-slate-400 hover:text-white transition-colors"
                              title="Copy command"
                            >
                              {copiedCmd === step.command ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <div className="text-emerald-300 select-all overflow-x-auto py-1 scrollbar-none">
                            $ {step.command}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Embedded Terminal Runner (Triggered on demand or on triage) */}
      {showTerminal && (
        <div className="mt-8 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-emerald-400" />
              SRE Live Execution Terminal
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Execute steps sequentially to remediate cluster & verify recovery
            </span>
          </div>

          <TerminalRunner
            initialCommands={terminalCommands}
            onRemediationComplete={handleRemediationFinished}
            serviceTarget={selectedPreset.service}
          />
        </div>
      )}

      {/* Manual Problem Definition Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0b101b] border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Add Problem / Outage Manually
                  </h3>
                  <p className="text-xs text-slate-400">
                    Define custom telemetry or paste error logs to test zero-cost Hindsight recall & Groq triage.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Quick Template Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Quick Starter Templates:
                  </span>
                  <button
                    onClick={handleClearTemplate}
                    className="text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    Clear Form
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PROBLEM_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyTemplate(tmpl)}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 hover:border-emerald-500/50 transition-colors"
                    >
                      {tmpl.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Outage Title */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Problem Title / Scenario Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={manualTitle}
                    onChange={e => setManualTitle(e.target.value)}
                    placeholder="e.g. Payment Gateway Redis 6379 Connection Timeout"
                    className="w-full bg-[#070b12] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Target Service */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Target Microservice / Component <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={manualService}
                    onChange={e => setManualService(e.target.value)}
                    placeholder="e.g. payment-gateway, auth-service"
                    className="w-full bg-[#070b12] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Severity Level
                  </label>
                  <select
                    value={manualSeverity}
                    onChange={e => setManualSeverity(e.target.value as Severity)}
                    className="w-full bg-[#070b12] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="P1-CRITICAL">🔴 P1 - Critical (Outage / Revenue Impact)</option>
                    <option value="P2-HIGH">🟠 P2 - High (Degraded / Latency Spike)</option>
                    <option value="P3-MEDIUM">🟡 P3 - Medium (Warning / Minor)</option>
                  </select>
                </div>

                {/* Error Log Trace */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      Incoming Telemetry / Error Log Stream <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {manualLog.length} chars
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={manualLog}
                    onChange={e => setManualLog(e.target.value)}
                    placeholder="Paste raw error traces, Kubernetes pod logs, Datadog alerts, or HTTP 504 errors..."
                    className="w-full bg-[#070b12] border border-slate-700/80 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                  />
                </div>

                {/* Optional Root Cause Hint */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Known Root Cause Hint <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={manualRootCause}
                    onChange={e => setManualRootCause(e.target.value)}
                    placeholder="e.g. Unreleased socket leases during burst"
                    className="w-full bg-[#070b12] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Optional CLI Runbook Fix */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Known Runbook Command <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={manualRunbookCommand}
                    onChange={e => setManualRunbookCommand(e.target.value)}
                    placeholder="e.g. redis-cli client kill type normal"
                    className="w-full bg-[#070b12] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-2 space-y-2 border-t border-slate-800/80">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={retainInMemory}
                    onChange={e => setRetainInMemory(e.target.checked)}
                    className="mt-0.5 rounded bg-slate-900 border-slate-700 text-purple-500 focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5" />
                      Also Ingest into Hindsight Memory Bank (hindsight.retain)
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Extracts 4-channel TEMPER facts & causal links directly into <code className="text-purple-300 font-mono">incidentops-bank</code> so future alerts will instantly recognize this outage.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveAsQuickPreset}
                    onChange={e => setSaveAsQuickPreset(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0"
                  />
                  <span className="text-xs text-slate-300">
                    Keep in Quick-Select Scenario Bar (with <span className="text-sky-400 font-mono">Custom</span> badge)
                  </span>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>

              <div className="w-full sm:w-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled={!manualLog.trim()}
                  onClick={() => handleSaveManualProblem(false)}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors disabled:opacity-40"
                >
                  Load into Console
                </button>

                <button
                  type="button"
                  disabled={!manualLog.trim()}
                  onClick={() => handleSaveManualProblem(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  ⚡ Load & Triage Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
