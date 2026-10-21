import React, { useState } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { apiClient } from '../api';
import { TestResult } from '../../server/tests/test-suite';

interface TestRunnerModalProps {
  onClose: () => void;
}

export const TestRunnerModal: React.FC<TestRunnerModalProps> = ({ onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [testSummary, setTestSummary] = useState<{
    passed: number;
    failed: number;
    total: number;
    durationMs: number;
    results: TestResult[];
  } | null>(null);

  const runTests = async () => {
    try {
      setIsRunning(true);
      const data = await apiClient.runTests();
      setTestSummary(data);
    } catch (e) {
      console.error('Failed to run tests:', e);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Automated Test Suite Runner</h2>
              <p className="text-xs text-slate-400">Unit, integration, idempotency & compliance tests</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Covers Section 15 testing requirements: FX precision, state machine transitions, token contract validation, Travel Rule triggers, HMAC webhooks, and end-to-end sandbox settlement.
            </p>
            <button
              onClick={runTests}
              disabled={isRunning}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-2 transition-all cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50 flex-shrink-0 ml-4"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>{testSummary ? 'Re-run All Tests' : 'Run All Tests'}</span>
            </button>
          </div>

          {/* Test Results Output */}
          {testSummary ? (
            <div className="space-y-3">
              {/* Summary Stats */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xl font-extrabold text-emerald-400">
                      {testSummary.passed} / {testSummary.total} Passed
                    </span>
                    {testSummary.failed === 0 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        All Tests Passing
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        {testSummary.failed} Failed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Executed in {testSummary.durationMs}ms</p>
                </div>
              </div>

              {/* Individual Test Items */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {testSummary.results.map((res) => (
                  <div
                    key={res.id}
                    className={`p-3 rounded-xl border flex items-start justify-between text-xs ${
                      res.passed
                        ? 'bg-slate-950/60 border-slate-800 text-slate-300'
                        : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <div className="flex items-start space-x-2.5">
                      {res.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-indigo-400 font-mono">
                            {res.category}
                          </span>
                          <span className="font-semibold text-white">{res.name}</span>
                        </div>
                        {res.error && <p className="text-rose-400 text-[11px] mt-1 font-mono">{res.error}</p>}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 flex-shrink-0 ml-2">
                      {res.durationMs}ms
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
              <Terminal className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Click &quot;Run All Tests&quot; to execute the automated test suite.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-between items-center text-xs text-slate-500">
          <span>Executable in terminal via: <code className="text-emerald-400 font-mono">npm test</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
