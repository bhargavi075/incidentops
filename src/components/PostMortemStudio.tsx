import React, { useState } from 'react';
import { hindsightEngine } from '../services/hindsightEngine';
import { groqService, checkCommandSafety } from '../services/groqEngine';
import { Severity } from '../types/incident';
import {
  FileText,
  Sparkles,
  Database,
  CheckCircle2,
  Cpu,
  ArrowRight,
  ListPlus,
  RefreshCw,
  Bot
} from 'lucide-react';

interface PostMortemStudioProps {
  onMemoryAdded: () => void;
  onNavigateToTriage: () => void;
}

export const PostMortemStudio: React.FC<PostMortemStudioProps> = ({
  onMemoryAdded,
  onNavigateToTriage
}) => {
  const [title, setTitle] = useState('');
  const [service, setService] = useState('checkout-service');
  const [severity, setSeverity] = useState<Severity>('P1-CRITICAL');
  const [errorContent, setErrorContent] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [cliCommands, setCliCommands] = useState('');
  const [author, setAuthor] = useState('sre-oncall@company.internal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rawSlackNotes, setRawSlackNotes] = useState(
    `@balaji: checkout pods throwing 504 gateway timeouts at 02:18 UTC.
@sarah: checking redis. connection pool exhausted on port 6379, workers holding open zombie leases.
@balaji: ran \`redis-cli client kill type normal\`, patched configmap with pool_timeout=5s and restarted pods.
@sarah: checkout latency dropped to 42ms. verified back to normal.`
  );
  const [showSlackDraft, setShowSlackDraft] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    id: string;
    facts: number;
    links: number;
  } | null>(null);

  const handleGenerateFromNotes = async () => {
    if (!rawSlackNotes.trim()) return;
    setIsDrafting(true);
    try {
      const extracted = await groqService.generatePostMortemFromNotes(rawSlackNotes);
      setTitle(extracted.title);
      setService(extracted.service);
      setSeverity(extracted.severity);
      setErrorContent(extracted.errorSignature);
      setRootCause(extracted.rootCause);
      setCliCommands(extracted.commands.join('\n'));
    } catch (e) {
      console.error(e);
    } finally {
      setIsDrafting(false);
    }
  };

  const handlePreFillExample = () => {
    setTitle('PostgreSQL Unindexed Query Lock Saturation on Order Ledger');
    setService('order-service');
    setSeverity('P1-CRITICAL');
    setErrorContent('2026-09-27T08:22:19Z [FATAL] canceling statement due to statement timeout (timeout=15000ms) on table `orders` during bulk invoice processing.');
    setRootCause('Missing compound B-Tree index on (account_id, created_at) forced sequential table scans on 40-million row orders table, locking transaction tables for 14 minutes.');
    setCliCommands(`psql -h pg-orders.internal -U postgres -d order_db -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_acc_created ON orders (account_id, created_at);"
psql -h pg-orders.internal -U postgres -d order_db -c "SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE query LIKE '%orders%' AND state = 'active' AND query_start < NOW() - INTERVAL '2 minutes';"`);
    setAuthor('db-reliability-team@company.internal');
    setSuccessInfo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !service || !rootCause) return;

    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 600));

    const cmds = cliCommands
      .split('\n')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    const result = hindsightEngine.retain({
      title,
      service,
      severity,
      content: errorContent || title,
      rootCause,
      runbookCommands: cmds,
      author
    });

    setSuccessInfo({
      id: result.memory.id,
      facts: result.extractedFacts,
      links: result.causalLinksCreated
    });

    setIsSubmitting(false);
    onMemoryAdded();
  };

  const commandLines = cliCommands
    .split('\n')
    .map(c => c.trim())
    .filter(c => c.length > 0);
  const safetyReport = commandLines.length > 0 ? checkCommandSafety(commandLines) : null;

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">
                Post-Mortem Ingestion Studio
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Turn 2:00 AM firefighting into permanent organizational intelligence. The TEMPER pipeline automatically extracts entities, causal graphs, and actionable CLI runbooks into <span className="font-mono text-slate-300">incidentops-bank</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={handlePreFillExample}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-sky-400 hover:text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-lg transition-colors self-start font-mono"
          >
            <ListPlus className="w-3.5 h-3.5" />
            Load Sample Post-Mortem
          </button>
        </div>
      </div>

      {/* Automated Draft from Raw Slack Notes (Enhancement 5) */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSlackDraft(!showSlackDraft)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-400 font-mono">
            <Bot className="w-4 h-4" />
            <span>🤖 Draft Post-Mortem from Raw Incident Slack Notes (Automated AI Extraction)</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {showSlackDraft ? 'Hide' : 'Expand'}
          </span>
        </button>

        {showSlackDraft && (
          <div className="p-4 pt-0 space-y-3 border-t border-slate-800/60">
            <p className="text-xs text-slate-400">
              Paste raw on-call Slack messages, terminal traces, or rough incident logs. Groq transforms them into structured entities and auto-populates the form below.
            </p>
            <textarea
              rows={3}
              value={rawSlackNotes}
              onChange={e => setRawSlackNotes(e.target.value)}
              className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-sky-500/50"
            />
            <button
              type="button"
              onClick={handleGenerateFromNotes}
              disabled={isDrafting || !rawSlackNotes.trim()}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isDrafting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Extracting Incident Post-Mortem...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Structured Post-Mortem via Groq
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Success Banner */}
      {successInfo && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-emerald-300">
                Post-Mortem Retained in Hindsight Bank ({successInfo.id})
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Extracted {successInfo.facts} structured telemetry facts and created {successInfo.links} causal graph edges. Future occurrences will triage with high confidence!
              </div>
            </div>
          </div>

          <button
            onClick={onNavigateToTriage}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors whitespace-nowrap self-start sm:self-center"
          >
            <span>Test in Live Triage</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Form & TEMPER Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form (7 cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-semibold text-slate-300 uppercase font-mono">
              Incident RCA & Verified Mitigation Specification
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 font-mono mb-1">
                  Incident Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Redis Connection Pool Exhaustion on Port 6379"
                  className="w-full bg-[#080d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500/50 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-mono mb-1">
                  Target Service *
                </label>
                <input
                  type="text"
                  required
                  value={service}
                  onChange={e => setService(e.target.value)}
                  placeholder="e.g., checkout-service"
                  className="w-full bg-[#080d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500/50 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 font-mono mb-1">
                  Incident Severity
                </label>
                <select
                  value={severity}
                  onChange={e => setSeverity(e.target.value as Severity)}
                  className="w-full bg-[#080d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500/50 font-mono"
                >
                  <option value="P1-CRITICAL">P1 - Critical Outage</option>
                  <option value="P2-HIGH">P2 - High Severity</option>
                  <option value="P3-MEDIUM">P3 - Medium Degradation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-mono mb-1">
                  On-Call Lead / Author
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                  placeholder="sre-oncall@company.internal"
                  className="w-full bg-[#080d16] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500/50 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-mono mb-1">
                Telemetry Signature / Trigger Log Snippet
              </label>
              <textarea
                rows={2}
                value={errorContent}
                onChange={e => setErrorContent(e.target.value)}
                placeholder="Paste the raw error message or exception that triggered the alert..."
                className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500/50 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-mono mb-1">
                Isolate Root Cause (Mechanism of Failure) *
              </label>
              <textarea
                required
                rows={3}
                value={rootCause}
                onChange={e => setRootCause(e.target.value)}
                placeholder="Explain the precise breakdown (e.g. unreleased socket leases, poison pill JSON attribute, unindexed sequential scan)..."
                className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-sky-500/50 leading-relaxed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400 font-mono">
                  Verified Executable CLI Runbook (One command per line) *
                </label>
                {safetyReport && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                      safetyReport.isSafe
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {safetyReport.badge}
                  </span>
                )}
              </div>
              <textarea
                required
                rows={4}
                value={cliCommands}
                onChange={e => setCliCommands(e.target.value)}
                placeholder={`redis-cli -h redis-master -p 6379 client kill type normal\nkubectl patch configmap checkout-config -p '{"data":{"POOL_TIMEOUT":"5s"}}'\nkubectl rollout restart deployment/checkout-worker`}
                className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-sky-500/50 resize-none leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !title || !rootCause}
              className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-sky-500/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Extracting TEMPER Causal Graph & Retaining...
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5" />
                  Retain Post-Mortem into incidentops-bank
                </>
              )}
            </button>
          </div>
        </form>

        {/* Right Panel: Live Biomimetic TEMPER Pipeline Inspector (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-semibold text-slate-200 uppercase font-mono">
                Biomimetic TEMPER Ingestion Pipeline
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Hindsight's continuous memory architecture converts unstructured post-mortems into multi-dimensional memory nodes without manual labeling.
            </p>

            <div className="space-y-3 pt-2">
              <div className="bg-[#080d16] border border-slate-800/80 rounded-lg p-3">
                <div className="text-[10px] text-purple-400 font-mono font-semibold uppercase">
                  T - Topic & Context Anchor
                </div>
                <div className="text-xs text-slate-200 font-mono mt-1">
                  Service: {service || '<service-name>'} · Scope: production
                </div>
              </div>

              <div className="bg-[#080d16] border border-slate-800/80 rounded-lg p-3">
                <div className="text-[10px] text-sky-400 font-mono font-semibold uppercase">
                  E - Entities & Topology Nodes
                </div>
                <div className="text-xs text-slate-300 font-mono mt-1">
                  {rootCause.includes('redis') && 'redis-master:6379, '}
                  {rootCause.includes('kafka') && 'kafka-broker:9092, '}
                  {rootCause.includes('postgres') && 'pg-primary:5432, '}
                  {service}-runtime, pod-controller
                </div>
              </div>

              <div className="bg-[#080d16] border border-slate-800/80 rounded-lg p-3">
                <div className="text-[10px] text-amber-400 font-mono font-semibold uppercase">
                  M - Metrics & Threshold Deltas
                </div>
                <div className="text-xs text-slate-300 font-mono mt-1">
                  latency_p99:elevated, resource_saturation:critical
                </div>
              </div>

              <div className="bg-[#080d16] border border-slate-800/80 rounded-lg p-3">
                <div className="text-[10px] text-emerald-400 font-mono font-semibold uppercase">
                  R - Verified Resolution Graph
                </div>
                <div className="text-xs text-emerald-300 font-mono mt-1 truncate">
                  {cliCommands ? cliCommands.split('\n')[0] : 'Deterministic CLI Command Chain'}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-400">
              <div className="font-semibold text-slate-300 mb-1">
                Zero Embedding Re-Indexing Cost
              </div>
              Unlike traditional vector databases that require expensive token re-embedding and index rebuilding, Hindsight continuous memory graphs update instantly with zero inference overhead.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
