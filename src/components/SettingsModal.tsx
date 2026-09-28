import React, { useState } from 'react';
import { groqService } from '../services/groqEngine';
import { hindsightEngine } from '../services/hindsightEngine';
import { Settings, X, Check, Database, Cpu, RotateCcw } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBankReset: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onBankReset
}) => {
  const currentConfig = groqService.getConfig();
  const [apiKey, setApiKey] = useState(currentConfig.apiKey || '');
  const [model, setModel] = useState(currentConfig.model);
  const [temperature, setTemperature] = useState(currentConfig.temperature);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    groqService.setConfig({
      apiKey: apiKey.trim() || undefined,
      model,
      temperature
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleResetBank = () => {
    if (window.confirm('Reset incidentops-bank to the 3 enterprise seeded outages?')) {
      hindsightEngine.resetToDefault();
      onBankReset();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0b101a] border border-slate-800 rounded-xl max-w-md w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-slate-900/90 border-b border-slate-800 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-white tracking-tight">
              Engine Configuration & Cloud Endpoints
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs font-mono">
          {/* Groq Model */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              Groq LPU Reasoning Model
            </label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Ultra-fast SRE reasoning)</option>
              <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
              <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Sub-150ms)</option>
            </select>
          </div>

          {/* Groq API Key (Optional) */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center justify-between">
              <span>GROQ_API_KEY (Optional)</span>
              <span className="text-[10px] text-emerald-400">Default: Local LPU Simulator</span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 placeholder-slate-700"
            />
            <p className="text-[10px] text-slate-500 font-sans">
              Enter your Groq key to route queries through Groq Cloud or leave blank for instant sub-second local simulation.
            </p>
          </div>

          {/* Hindsight Bank Status */}
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-purple-400" />
                Hindsight Memory Bank
              </span>
              <span className="text-purple-300">incidentops-bank</span>
            </div>
            <div className="text-[11px] text-slate-500 font-sans">
              Connected Endpoint: <code className="text-slate-300">https://api.hindsight.vectorize.io</code>
            </div>
          </div>

          {/* Reset Bank Button */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetBank}
              className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Memory Bank to Default
            </button>

            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Saved
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
