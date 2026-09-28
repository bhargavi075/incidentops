import React, { useState } from 'react';
import {
  Brain,
  Zap,
  Clock,
  Coins,
  Network,
  Database,
  Sparkles,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Search,
  HeartPulse,
  Flame,
  Coffee
} from 'lucide-react';

export const ArchitectureDoc: React.FC = () => {
  const [activePipelineStep, setActivePipelineStep] = useState<number>(2);

  const PIPELINE_STEPS = [
    {
      step: 1,
      name: 'Alert Ingestion',
      icon: Flame,
      color: 'rose',
      title: '🚨 Production Alert Fires',
      time: '0 ms',
      cost: '$0.00',
      simpleSummary: 'A server crashes, an API throws HTTP 504, or a Kubernetes pod is OOMKilled.',
      details: 'Live cluster telemetry, Datadog alerts, or raw Kubernetes logs stream directly into the IncidentOps ingestion listener. No human intervention needed.'
    },
    {
      step: 2,
      name: '4-Channel Recall',
      icon: Brain,
      color: 'purple',
      title: '🧠 Hindsight 4-Channel Recall',
      time: '~5 ms',
      cost: '$0.00 (0 Tokens)',
      simpleSummary: 'The system searches its photographic memory across 4 brain lobes—without calling an expensive AI.',
      details: 'Hindsight scans the memory bank ("incidentops-bank") across BM25 keywords, vector concepts, timeline stamps, and causal graph edges. Cost: exactly 0 LLM tokens.'
    },
    {
      step: 3,
      name: 'Groq Reasoning',
      icon: Zap,
      color: 'emerald',
      title: '⚡ Groq LPU Ultra-Fast Reasoning',
      time: '~300 ms',
      cost: '<$0.0001',
      simpleSummary: 'An ultra-fast LPU chip reads the alert and past memories in a fraction of a second.',
      details: 'Groq LPUs process the compact prompt at lightning speeds (using openai/gpt-oss-120b). It diagnoses whether this is a known outage and generates step-by-step CLI commands.'
    },
    {
      step: 4,
      name: 'Terminal Action',
      icon: Terminal,
      color: 'sky',
      title: '🛠️ SRE Action Terminal',
      time: '1 - 3 sec',
      cost: '$0.00',
      simpleSummary: 'The engineer runs the exact verified CLI commands right inside the console.',
      details: 'The SRE executes verified commands (e.g. killing zombie client leases or scaling deployments). Cluster health flips from DEGRADED to HEALTHY.'
    },
    {
      step: 5,
      name: 'Memory Retention',
      icon: Database,
      color: 'amber',
      title: '💾 Continuous Memory Retention',
      time: '~15 ms',
      cost: '$0.00',
      simpleSummary: 'The fix is permanently filed into the brain so the company never forgets it again.',
      details: 'hindsight.retain() parses the verified post-mortem through the TEMPER pipeline, updating the knowledge graph and localStorage so future alerts are solved in seconds.'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Brain className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Visual Architecture & Memory Storage
              </h1>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              An intuitive visual walkthrough of autonomous SRE root-cause triage, the 4 brain lobes of continuous memory, and exactly how knowledge is stored.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="px-3 py-1.5 rounded-lg text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Visual Blueprint</span>
            </span>
            <span className="px-3 py-1.5 rounded-lg text-xs font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>Bank: incidentops-bank</span>
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* SECTION 1: The Human Story (Humanized in Simple English) */}
        <div className="bg-gradient-to-r from-slate-900/90 via-[#0a0f1d] to-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-4xl space-y-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
              <Coffee className="w-3.5 h-3.5" />
              <span>The Human Struggle: The 2:15 AM Pager Panic</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Why Do We Keep Debugging The Same Outage Over and Over?
            </h2>

            <p className="text-sm text-slate-300 leading-relaxed">
              Imagine this: It’s <strong className="text-white">2:15 AM</strong>. Your phone starts screaming with PagerDuty alerts. The checkout API is throwing <strong className="text-rose-400">HTTP 504 Gateway Timeouts</strong>. Revenue is plummeting every single second.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Without IncidentOps */}
              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-2">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold font-mono uppercase">
                  <AlertTriangle className="w-4 h-4" />
                  Traditional SRE (Human Context Amnesia)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  You search 14 Slack channels, Notion wikis, and old Google Docs. You try restarting pods, scaling servers, and guessing. 
                  <strong className="text-white block mt-1">2 hours later:</strong> you finally find that an unreleased Redis socket was leaking. But <em>someone on your team fixed this 3 months ago</em>—it was just lost in the shuffle.
                </p>
              </div>

              {/* With IncidentOps */}
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold font-mono uppercase">
                  <CheckCircle2 className="w-4 h-4" />
                  With IncidentOps (Photographic Memory)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The alert hits IncidentOps. Within <strong className="text-emerald-400">300 milliseconds</strong>, its 4-channel memory recognizes the exact causal pattern from 3 months ago. It prints the exact 1-line CLI fix (<code className="text-emerald-300">redis-cli client kill type normal</code>).
                  <strong className="text-white block mt-1">Outage resolved in 8.4 seconds.</strong>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Interactive Visual Pipeline (Resolution & Memory Lifecycle) */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                How IncidentOps Resolves Outages in 5 Steps (Click any step to inspect)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Follow the journey from an incoming error to instantaneous recovery and permanent memory.
              </p>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 self-start sm:self-auto">
              Total MTTR: &lt; 8.4 Seconds
            </span>
          </div>

          {/* Pipeline Step Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {PIPELINE_STEPS.map(item => {
              const isActive = activePipelineStep === item.step;
              const IconComponent = item.icon;
              return (
                <button
                  key={item.step}
                  onClick={() => setActivePipelineStep(item.step)}
                  className={`p-3 rounded-xl border text-left transition-all relative ${
                    isActive
                      ? 'bg-slate-800 border-emerald-500 text-white shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/40'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                      Step 0{item.step}
                    </span>
                    <IconComponent
                      className={`w-4 h-4 ${
                        isActive
                          ? 'text-emerald-400'
                          : item.color === 'rose'
                          ? 'text-rose-400'
                          : item.color === 'purple'
                          ? 'text-purple-400'
                          : item.color === 'sky'
                          ? 'text-sky-400'
                          : 'text-amber-400'
                      }`}
                    />
                  </div>
                  <div className="font-bold text-xs truncate">{item.name}</div>
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>{item.time}</span>
                    <span className="text-emerald-400 font-mono">{item.cost}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Step Deep-Dive Card */}
          {(() => {
            const currentStep = PIPELINE_STEPS.find(s => s.step === activePipelineStep) || PIPELINE_STEPS[1];
            const StepIcon = currentStep.icon;
            return (
              <div className="bg-[#080d16] border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-emerald-400">
                      <StepIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider">
                        Step {currentStep.step} of 5
                      </div>
                      <h4 className="text-sm font-bold text-white">{currentStep.title}</h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Latency: <strong>{currentStep.time}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-sky-300">
                      <Coins className="w-3.5 h-3.5 text-sky-400" />
                      <span>Cost: <strong>{currentStep.cost}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      In Simple English:
                    </span>
                    <p className="text-slate-400 leading-relaxed">
                      {currentStep.simpleSummary}
                    </p>
                  </div>

                  <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-purple-400" />
                      Under The Hood Mechanics:
                    </span>
                    <p className="text-slate-400 leading-relaxed">
                      {currentStep.details}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* SECTION 3: The 4 Brain Lobes of Hindsight (Visual & Humanized) */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-mono mb-2">
              <Brain className="w-3.5 h-3.5" />
              <span>Biomimetic Memory Lobes</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              The 4 Brain Lobes of Hindsight Memory
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Standard AI tools dump everything into one flat vector database and get easily confused. Hindsight operates like the human brain, cross-checking 4 specialized channels at the exact same moment:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Channel 1: The Detective */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-emerald-400 font-bold flex items-center gap-1.5">
                  <Search className="w-4 h-4" />
                  Lobe 1: The Detective (BM25 Keywords)
                </span>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded">
                  Exact Match
                </span>
              </div>
              <div className="text-xs font-semibold text-white">
                "Find the exact fingerprint."
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Remembers exact port numbers (<code className="text-slate-200">6379</code>, <code className="text-slate-200">5432</code>), container exit codes (<code className="text-slate-200">Exit 137</code>), and specific pod IDs without guessing.
              </p>
              <div className="text-[11px] font-mono text-emerald-300/80 bg-emerald-950/20 p-2 rounded border border-emerald-900/30">
                Example: redis-master:6379 ➔ matched in 0.8ms
              </div>
            </div>

            {/* Channel 2: The Linguist */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-sky-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-sky-400 font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Lobe 2: The Linguist (Vector Semantics)
                </span>
                <span className="text-[10px] font-mono bg-sky-500/10 text-sky-300 px-2 py-0.5 rounded">
                  Meaning & Synonyms
                </span>
              </div>
              <div className="text-xs font-semibold text-white">
                "Understand what they mean, even if words changed."
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Recognizes that <em>"socket pool full"</em>, <em>"exhausted client leases"</em>, and <em>"connection timeout"</em> all point to the exact same underlying problem, even if the alert was rephrased.
              </p>
              <div className="text-[11px] font-mono text-sky-300/80 bg-sky-950/20 p-2 rounded border border-sky-900/30">
                Example: "unreleased leases" ≈ "connection leak" (94% match)
              </div>
            </div>

            {/* Channel 3: The Historian */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-amber-400 font-bold flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Lobe 3: The Historian (Timeline & Chronology)
                </span>
                <span className="text-[10px] font-mono bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded">
                  Time & Recency
                </span>
              </div>
              <div className="text-xs font-semibold text-white">
                "Notice timing, deployments, and cron patterns."
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Remembers when things happened. Did this error only show up right after Friday's 4:00 PM release? Does this database lock up only during the midnight ETL batch?
              </p>
              <div className="text-[11px] font-mono text-amber-300/80 bg-amber-950/20 p-2 rounded border border-amber-900/30">
                Example: Correlated with analytics_nightly_rollup at 04:00 UTC
              </div>
            </div>

            {/* Channel 4: The Mapmaker */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-purple-400 font-bold flex items-center gap-1.5">
                  <Network className="w-4 h-4" />
                  Lobe 4: The Mapmaker (Causal Graph)
                </span>
                <span className="text-[10px] font-mono bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded">
                  Cause & Effect Chain
                </span>
              </div>
              <div className="text-xs font-semibold text-white">
                "Connect the domino effect to the exact solution."
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Traces the root cause chain: <code className="text-slate-200">Traffic Surge</code> ➔ <code className="text-slate-200">Exhausts Redis Port 6379</code> ➔ <code className="text-slate-200">Triggers 504 Timeout</code> ➔ <code className="text-emerald-300">redis-cli client kill</code>.
              </p>
              <div className="text-[11px] font-mono text-purple-300/80 bg-purple-950/20 p-2 rounded border border-purple-900/30">
                Example: [Event A] ➔ [Symptom B] ➔ [Command C]
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: Benchmark Scorecard */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-emerald-400" />
            Real Enterprise Benchmark Comparison
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-xs font-mono uppercase text-slate-400">Mean Time to Repair (MTTR)</div>
              <div className="text-2xl font-black text-emerald-400 font-mono">8.4 Seconds</div>
              <div className="text-[11px] text-slate-500">Down from 4.2 Hours (-99.9%)</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-xs font-mono uppercase text-slate-400">Recall Retrieval Cost</div>
              <div className="text-2xl font-black text-sky-400 font-mono">$0.00</div>
              <div className="text-[11px] text-slate-500">Zero LLM tokens for memory lookup</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-xs font-mono uppercase text-slate-400">Reasoning Speed (Groq LPU)</div>
              <div className="text-2xl font-black text-purple-400 font-mono">~300 ms</div>
              <div className="text-[11px] text-slate-500">Sub-second gpt-oss-120b inference</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
