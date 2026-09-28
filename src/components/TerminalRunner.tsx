import React, { useState } from 'react';
import { Terminal as TerminalIcon, Check, Copy, Play, RefreshCw, XCircle } from 'lucide-react';

interface TerminalRunnerProps {
  initialCommands?: string[];
  onRemediationComplete?: () => void;
  serviceTarget?: string;
}

interface CommandHistory {
  command: string;
  output: string[];
  status: 'running' | 'success' | 'failed';
  timestamp: string;
}

export const TerminalRunner: React.FC<TerminalRunnerProps> = ({
  initialCommands = [],
  onRemediationComplete,
  serviceTarget = 'production'
}) => {
  const [history, setHistory] = useState<CommandHistory[]>([
    {
      command: '# SRE Autonomous Incident Remediation Terminal initialized',
      output: ['Connected to cluster: prod-us-east-1-k8s', 'Service context: ' + serviceTarget],
      status: 'success',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [currentInput, setCurrentInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const getSimulatedOutput = (cmd: string): string[] => {
    const trimmed = cmd.trim();
    if (trimmed.includes('redis-cli') && trimmed.includes('client kill')) {
      return [
        'Connecting to redis-master.production.svc.cluster.local:6379...',
        'OK (Killed 7,420 normal connections holding stale socket leases)',
        'Active client connections dropped from 10,000 -> 14.',
        'redis-master:6379 memory released: 480MB reclaimed.'
      ];
    }
    if (trimmed.includes('patch configmap') || trimmed.includes('REDIS_POOL_TIMEOUT')) {
      return [
        'configmap/checkout-config patched',
        'data.REDIS_POOL_TIMEOUT = "5s"',
        'data.MAX_IDLE = "50"'
      ];
    }
    if (trimmed.includes('rollout restart')) {
      return [
        'deployment.apps/checkout-cluster-worker restarted',
        'Waiting for rollout to finish: 0 of 8 updated replicas are available...',
        'Waiting for rollout to finish: 8 of 8 updated replicas are available...',
        'Deployment "checkout-cluster-worker" successfully rolled out.'
      ];
    }
    if (trimmed.includes('kafka-consumer-groups') && trimmed.includes('reset-offsets')) {
      return [
        'GROUP                          TOPIC                PARTITION  NEW-OFFSET',
        'payment-processor-v2           payments.incoming    4          18492042',
        '[SUCCESS] Shifted offset by +1. Skipped poison pill message at offset 18492041.',
        'Offset commit confirmed by Kafka broker coordinator.'
      ];
    }
    if (trimmed.includes('kafka-console-producer') || trimmed.includes('payments.dlq')) {
      return [
        'Routing payload to topic [payments.dlq] partition 0...',
        'Produced 1 message record (1,048 bytes). DLQ audit ID: dlq_9841209.'
      ];
    }
    if (trimmed.includes('pg_terminate_backend')) {
      return [
        'pg_terminate_backend',
        '----------------------',
        't (192 idle-in-transaction processes terminated)',
        'FATAL slots cleared. Active connections normalized from 500 -> 88.'
      ];
    }
    if (trimmed.includes('kubectl top') || trimmed.includes('kubectl describe')) {
      return [
        'NAME                                     CPU(cores)   MEMORY(bytes)',
        'ingress-controller-envoy-7b89f8dc9f     420m         1980Mi',
        'checkout-cluster-worker-9fa81            110m         240Mi',
        'payment-processor-v2-4k11                85m          310Mi'
      ];
    }
    if (trimmed.includes('kubectl scale')) {
      return [
        'deployment.apps/ingress-controller-envoy scaled',
        'Replicas updated from 2 -> 6',
        'Pod scheduler allocating nodes in az-1a, az-1b, az-1c.'
      ];
    }
    return [
      `Executing: ${trimmed}`,
      'Command executed with exit code 0.',
      '[Status: Nominal]'
    ];
  };

  const executeCommand = async (cmdToRun: string) => {
    if (!cmdToRun.trim() || isExecuting) return;
    setIsExecuting(true);

    const timestamp = new Date().toLocaleTimeString();
    const newEntry: CommandHistory = {
      command: cmdToRun,
      output: ['Executing command on cluster bastion host...'],
      status: 'running',
      timestamp
    };

    setHistory(prev => [...prev, newEntry]);

    await new Promise(r => setTimeout(r, 650));

    const finalOutput = getSimulatedOutput(cmdToRun);
    setHistory(prev =>
      prev.map((item, idx) =>
        idx === prev.length - 1
          ? { ...item, output: finalOutput, status: 'success' }
          : item
      )
    );

    setIsExecuting(false);
    setCurrentInput('');

    // If running from runbook queue, advance step
    if (initialCommands.includes(cmdToRun)) {
      const nextIdx = activeStepIndex + 1;
      setActiveStepIndex(nextIdx);
      if (nextIdx >= initialCommands.length && onRemediationComplete) {
        onRemediationComplete();
      }
    }
  };

  const handleCopyLogs = () => {
    const text = history
      .map(h => `$ ${h.command}\n${h.output.join('\n')}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#080d16] border border-slate-800 rounded-xl overflow-hidden font-mono text-xs shadow-2xl flex flex-col h-[420px]">
      {/* Terminal Title Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <TerminalIcon className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-300 font-medium tracking-tight">
            bastion-sre-cli · <span className="text-emerald-400">{serviceTarget}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {initialCommands.length > 0 && activeStepIndex < initialCommands.length && (
            <button
              onClick={() => executeCommand(initialCommands[activeStepIndex])}
              disabled={isExecuting}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Run Step {activeStepIndex + 1}/{initialCommands.length}</span>
            </button>
          )}

          <button
            onClick={handleCopyLogs}
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
            title="Copy Terminal Logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setHistory([])}
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
            title="Clear Console"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin">
        {history.map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-start gap-2 text-slate-300">
              <span className="text-emerald-400 select-none">sre@prod:~#</span>
              <span className="font-semibold text-slate-100">{item.command}</span>
              <span className="ml-auto text-[10px] text-slate-600 select-none">{item.timestamp}</span>
            </div>
            <div className="pl-4 space-y-0.5 text-slate-400 text-[11px] leading-relaxed">
              {item.output.map((line, lIdx) => (
                <div
                  key={lIdx}
                  className={
                    line.includes('[SUCCESS]') || line.includes('OK') || line.includes('Normalized')
                      ? 'text-emerald-400'
                      : line.includes('FATAL') || line.includes('ERROR')
                      ? 'text-rose-400'
                      : line.includes('patched') || line.includes('restarted')
                      ? 'text-sky-300'
                      : 'text-slate-400'
                  }
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        ))}

        {isExecuting && (
          <div className="flex items-center gap-2 text-amber-400 animate-pulse text-xs pl-4">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Executing command on remote cluster node...</span>
          </div>
        )}
      </div>

      {/* Interactive Command Input Form */}
      <form
        onSubmit={e => {
          e.preventDefault();
          executeCommand(currentInput);
        }}
        className="bg-slate-900/70 border-t border-slate-800 p-2.5 flex items-center gap-2"
      >
        <span className="text-emerald-400 font-bold pl-2 select-none">$</span>
        <input
          type="text"
          value={currentInput}
          onChange={e => setCurrentInput(e.target.value)}
          placeholder={
            initialCommands[activeStepIndex]
              ? `Next suggested command: ${initialCommands[activeStepIndex].substring(0, 48)}...`
              : 'Enter bash / kubectl / redis-cli command...'
          }
          className="flex-1 bg-transparent text-slate-200 placeholder-slate-600 focus:outline-none text-xs"
        />
        <button
          type="submit"
          disabled={!currentInput.trim() || isExecuting}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors disabled:opacity-40"
        >
          Execute
        </button>
      </form>
    </div>
  );
};
