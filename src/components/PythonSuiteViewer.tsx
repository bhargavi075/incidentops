import React, { useState } from 'react';
import { PYTHON_SUITE_SCRIPTS } from '../data/seedData';
import { Code2, Copy, Check, Download, FileCode, Terminal } from 'lucide-react';

export const PythonSuiteViewer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<keyof typeof PYTHON_SUITE_SCRIPTS>('sample_incidents');
  const [copied, setCopied] = useState(false);

  const fileMetadata: Record<
    keyof typeof PYTHON_SUITE_SCRIPTS,
    { filename: string; description: string; tag: string }
  > = {
    sample_incidents: {
      filename: 'sample_incidents.py',
      description: 'Seeds the 3 realistic enterprise production outages into incidentops-bank via hindsight-client.',
      tag: 'Knowledge Base Seeding'
    },
    agent: {
      filename: 'agent.py',
      description: 'Autonomous triage logic combining 4-channel zero-cost recall with Groq LPU synthesis.',
      tag: 'Core Agent Logic'
    },
    app_py: {
      filename: 'app.py',
      description: 'Interactive Streamlit web dashboard script for live alert triage and post-mortem ingestion.',
      tag: 'Streamlit Web Dashboard'
    },
    test_cloud_hindsight: {
      filename: 'test_cloud_hindsight.py',
      description: 'Tests Hindsight Cloud connectivity and verifies retain() and recall() primitives.',
      tag: 'Memory Bank Verification'
    },
    test_groq: {
      filename: 'test_groq.py',
      description: 'Verifies sub-second Groq LPU inference completions with openai/gpt-oss-120b.',
      tag: 'Groq Pipeline Verification'
    }
  };

  const currentContent = PYTHON_SUITE_SCRIPTS[selectedFile];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = fileMetadata[selectedFile].filename;
    const blob = new Blob([currentContent], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-emerald-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">
                Python Local Environment Code Suite
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Complete production Python implementation scripts for <span className="font-mono text-emerald-300">sample_incidents.py</span>, <span className="font-mono text-emerald-300">agent.py</span>, <span className="font-mono text-emerald-300">app.py</span>, and cloud tests. Ready to execute in your local virtualenv with <code className="text-slate-300">groq</code> and <code className="text-slate-300">hindsight-client</code>.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy File</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* File Tabs */}
        <div className="flex overflow-x-auto gap-2 mt-4 pt-4 border-t border-slate-800 scrollbar-none">
          {(Object.keys(fileMetadata) as (keyof typeof PYTHON_SUITE_SCRIPTS)[]).map(key => {
            const meta = fileMetadata[key];
            const isSelected = selectedFile === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedFile(key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-all whitespace-nowrap border ${
                  isSelected
                    ? 'bg-slate-800 text-emerald-400 border-emerald-500/50 shadow-sm'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800/80 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>{meta.filename}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Code Editor View */}
      <div className="bg-[#080d16] border border-slate-800 rounded-xl overflow-hidden font-mono text-xs shadow-2xl">
        <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">{fileMetadata[selectedFile].filename}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400 text-[11px] font-sans">
              {fileMetadata[selectedFile].description}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">
            {fileMetadata[selectedFile].tag}
          </span>
        </div>

        <div className="p-4 max-h-[600px] overflow-y-auto scrollbar-thin text-slate-300 leading-relaxed">
          <pre className="text-emerald-300/90 whitespace-pre">
            {currentContent}
          </pre>
        </div>
      </div>

      {/* Setup Guide for Local CLI Virtualenv */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3 font-mono text-xs">
        <div className="flex items-center gap-2 text-white font-semibold">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>Local Python Execution Steps (Virtualenv):</span>
        </div>
        <div className="space-y-1 text-slate-400 text-[11px] leading-relaxed bg-[#080d16] p-3 rounded-lg border border-slate-800">
          <div>1. <span className="text-slate-300">Seed Knowledge Base:</span> <code className="text-emerald-300">python sample_incidents.py</code></div>
          <div>2. <span className="text-slate-300">Run Cloud Verification:</span> <code className="text-emerald-300">python test_cloud_hindsight.py && python test_groq.py</code></div>
          <div>3. <span className="text-slate-300">Launch Streamlit Web Console:</span> <code className="text-emerald-300">streamlit run app.py</code></div>
        </div>
      </div>
    </div>
  );
};
