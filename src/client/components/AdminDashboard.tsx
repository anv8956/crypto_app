import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  FileText,
  RotateCcw,
  Search,
  ExternalLink,
  Lock,
  Unlock,
  Activity,
  Server,
  Zap,
} from 'lucide-react';
import { Transfer, AuditLogItem } from '../../shared/types';
import { apiClient } from '../api';

interface AdminDashboardProps {
  onInspectTransfer: (transfer: Transfer) => void;
  onRefreshAll: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onInspectTransfer,
  onRefreshAll,
}) => {
  const [metrics, setMetrics] = useState<{
    totalTransfers: number;
    totalVolumeUSD: number;
    completedCount: number;
    inReviewCount: number;
    pendingCount: number;
    failedCount: number;
    successRate: number;
    activeCorridors: number;
    avgSettlementSeconds: number;
  } | null>(null);

  const [complianceQueue, setComplianceQueue] = useState<Transfer[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [activeTab, setActiveTab] = useState<'queue' | 'logs' | 'health'>('queue');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);

  const loadData = async () => {
    try {
      const [m, q, logs] = await Promise.all([
        apiClient.getAdminMetrics(),
        apiClient.getComplianceQueue(),
        apiClient.getAuditLogs(),
      ]);
      setMetrics(m);
      setComplianceQueue(q);
      setAuditLogs(logs);
    } catch (e) {
      console.error('Error loading admin data:', e);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleReleaseHold = async (transferId: string) => {
    try {
      setIsActing(true);
      await apiClient.executeTransferAction(
        transferId,
        'RELEASE_COMPLIANCE_HOLD',
        releaseNotes || 'Officer Elena Vance cleared FinCEN Travel Rule and commercial docs.'
      );
      setReleaseNotes('');
      setSelectedCaseId(null);
      await loadData();
      onRefreshAll();
    } catch (e) {
      console.error(e);
    } finally {
      setIsActing(false);
    }
  };

  const handleResetDb = async () => {
    if (confirm('Reset entire sandbox database to default seed state?')) {
      await apiClient.resetDatabase();
      await loadData();
      onRefreshAll();
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Reset Seed Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold text-white tracking-tight">Compliance & Operational Console</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            FinCEN MSB Travel Rule monitoring, OFAC SDN screening, liquidity settlement, and tamper-evident audit logs.
          </p>
        </div>

        <button
          onClick={handleResetDb}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Sandbox to Seed</span>
        </button>
      </div>

      {/* KPI Cards */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-400 font-medium">Total Volume Settled</p>
            <p className="text-2xl font-extrabold text-white mt-1">
              ${metrics.totalVolumeUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[11px] text-emerald-400 font-medium mt-1 inline-block">
              Across 6 international corridors
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-400 font-medium">Success Rate</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-1">{metrics.successRate}%</p>
            <span className="text-[11px] text-slate-400 mt-1 inline-block">
              {metrics.completedCount} Completed / {metrics.totalTransfers} Total
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-400 font-medium">Compliance Review Queue</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-extrabold text-amber-400">{metrics.inReviewCount}</span>
              <span className="text-xs text-slate-400">flagged transfers</span>
            </div>
            <span className="text-[11px] text-amber-400/80 mt-1 inline-block">Requires AML Officer action</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-400 font-medium">Avg Settlement Speed</p>
            <p className="text-2xl font-extrabold text-indigo-400 mt-1">{metrics.avgSettlementSeconds}s</p>
            <span className="text-[11px] text-slate-400 mt-1 inline-block">Polygon PoS & FedNow Rails</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-800 flex space-x-4">
        <button
          onClick={() => setActiveTab('queue')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
            activeTab === 'queue'
              ? 'text-amber-400 border-b-2 border-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Compliance Queue ({complianceQueue.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
            activeTab === 'logs'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Immutable Audit Logs ({auditLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
            activeTab === 'health'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Partner Rail Health & Liquidity
        </button>
      </div>

      {/* COMPLIANCE QUEUE TAB */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {complianceQueue.length === 0 ? (
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-200">Compliance Queue is Clean</p>
              <p className="text-xs text-slate-500 mt-1">No transfers are currently pending manual review or sanctions holds.</p>
            </div>
          ) : (
            complianceQueue.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-slate-900 border border-amber-500/30 hover:border-amber-500/60 transition-colors space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-slate-400">{item.transferNumber}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {item.status}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        Risk Score: {item.complianceCase?.riskScore}/100
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white mt-1">
                      {item.sourceCurrency} {item.sourceAmount.toLocaleString()} → ${item.targetAmount.toFixed(2)}{' '}
                      {item.targetCurrency}
                    </p>
                  </div>

                  <button
                    onClick={() => onInspectTransfer(item)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1"
                  >
                    <span>Inspect Full Transfer</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Flag Reasons */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                  <p className="font-bold text-amber-400 text-[11px] uppercase">Compliance Flag Triggers:</p>
                  {item.complianceCase?.flagReasons?.map((reason, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-slate-300 text-[11px]">
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-slate-800 flex justify-between text-slate-400 text-[11px]">
                    <span>FinCEN Travel Rule Status:</span>
                    <strong className="text-indigo-400">{item.complianceCase?.travelRuleStatus}</strong>
                  </div>
                </div>

                {/* Hold Release Action */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <input
                    type="text"
                    value={selectedCaseId === item.id ? releaseNotes : ''}
                    onChange={(e) => {
                      setSelectedCaseId(item.id);
                      setReleaseNotes(e.target.value);
                    }}
                    placeholder="Enter compliance clearance justification (e.g., invoice verified, PAN matched)..."
                    className="w-full sm:w-2/3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
                  />
                  <button
                    onClick={() => handleReleaseHold(item.id)}
                    disabled={isActing}
                    className="w-full sm:w-auto px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Approve & Release Hold</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === 'logs' && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Immutable Action Log (Last 100 entries)
            </span>
            <span className="text-[11px] text-emerald-400 font-mono">Real-time Stream</span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-xs">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]"
              >
                <div>
                  <span className="font-bold text-indigo-400">{log.action}</span>
                  <span className="text-slate-500 mx-2">|</span>
                  <span className="text-slate-300">
                    {log.entityType} ({log.entityId.slice(0, 14)}...)
                  </span>
                  <span className="text-slate-500 block sm:inline sm:ml-2">
                    {JSON.stringify(log.details)}
                  </span>
                </div>
                <span className="text-slate-600 text-[10px] flex-shrink-0">
                  {new Date(log.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PARTNER HEALTH TAB */}
      {activeTab === 'health' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-sm">Polygon PoS Rail</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Operational
              </span>
            </div>
            <div className="text-xs text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Avg Block Time:</span>
                <span className="text-white font-mono">2.1s</span>
              </div>
              <div className="flex justify-between">
                <span>Gas Price:</span>
                <span className="text-white font-mono">32.4 Gwei (~$0.01)</span>
              </div>
              <div className="flex justify-between">
                <span>Liquidity Pool:</span>
                <span className="text-emerald-400 font-mono font-bold">4,821,000 USDC</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-sm">US FedNow Gateway</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Connected 24/7
              </span>
            </div>
            <div className="text-xs text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Clearing Latency:</span>
                <span className="text-white font-mono">850ms</span>
              </div>
              <div className="flex justify-between">
                <span>Settlement Bank:</span>
                <span className="text-white font-mono">Federal Reserve Bank</span>
              </div>
              <div className="flex justify-between">
                <span>Daily Cap:</span>
                <span className="text-emerald-400 font-mono font-bold">$10,000,000 USD</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-sm">India UPI / IMPS Rail</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Connected 24/7
              </span>
            </div>
            <div className="text-xs text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Success Rate:</span>
                <span className="text-white font-mono">99.8%</span>
              </div>
              <div className="flex justify-between">
                <span>Clearing Provider:</span>
                <span className="text-white font-mono">NPCI Partner Bank</span>
              </div>
              <div className="flex justify-between">
                <span>LRS Compliance:</span>
                <span className="text-emerald-400 font-mono font-bold">FIU-IND Verified</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
