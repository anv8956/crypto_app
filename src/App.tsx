import React, { useState, useEffect } from 'react';
import {
  Send,
  ArrowRight,
  TrendingUp,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Users,
  History,
  ShieldAlert,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  ExternalLink,
  ChevronRight,
  CreditCard,
  Building,
} from 'lucide-react';
import { Navbar } from './client/components/Navbar';
import { FxCalculatorCard } from './client/components/FxCalculatorCard';
import { TransferWizard } from './client/components/TransferWizard';
import { TransferDetailModal } from './client/components/TransferDetailModal';
import { RecipientManager } from './client/components/RecipientManager';
import { AdminDashboard } from './client/components/AdminDashboard';
import { TestRunnerModal } from './client/components/TestRunnerModal';
import { KycVerificationModal } from './client/components/KycVerificationModal';
import { apiClient, setClientUserId, getClientUserId } from './client/api';
import {
  ExchangeQuote,
  Recipient,
  Transfer,
  NotificationItem,
  User,
  UserProfile,
  Verification,
} from './shared/types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [allUsers, setAllUsers] = useState<{ id: string; email: string; role: string; name: string }[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'recipients' | 'history' | 'admin'>('dashboard');

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Modals state
  const [wizardQuote, setWizardQuote] = useState<ExchangeQuote | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [isTestRunnerOpen, setIsTestRunnerOpen] = useState(false);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);

  // Search & Filter in history
  const [historySearch, setHistorySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Load user & profile
  const refreshUser = async () => {
    try {
      const data = await apiClient.getMe();
      setCurrentUser(data.user);
      setProfile(data.profile);
      setVerification(data.verification);
      setAllUsers(data.allUsers);

      // If user is compliance officer, default to admin tab
      if (data.user.role === 'COMPLIANCE_OFFICER' && activeTab === 'dashboard') {
        setActiveTab('admin');
      }
    } catch (e) {
      console.error('Error loading current user:', e);
    }
  };

  // Load transfers & notifications
  const refreshData = async () => {
    try {
      const [tList, rList, nList] = await Promise.all([
        apiClient.getTransfers(),
        apiClient.getRecipients(),
        apiClient.getNotifications(),
      ]);
      setTransfers(tList);
      setRecipients(rList);
      setNotifications(nList);
    } catch (e) {
      console.error('Error loading data:', e);
    }
  };

  useEffect(() => {
    refreshUser();
    refreshData();
    const interval = setInterval(refreshData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSwitchUser = async (userId: string) => {
    setClientUserId(userId);
    await refreshUser();
    await refreshData();
  };

  const handleStartTransferFromQuote = (quote: ExchangeQuote) => {
    setWizardQuote(quote);
    setIsWizardOpen(true);
  };

  const handleSendToRecipient = (recipient: Recipient) => {
    setIsWizardOpen(true);
  };

  const completedTransfers = transfers.filter((t) => t.status === 'COMPLETED');
  const totalVolumeSent = transfers.reduce((acc, t) => acc + (t.sourceAmount || 0), 0);

  const filteredHistory = transfers.filter((t) => {
    const matchesSearch =
      t.transferNumber.toLowerCase().includes(historySearch.toLowerCase()) ||
      t.recipient?.fullName?.toLowerCase().includes(historySearch.toLowerCase()) ||
      t.purposeOfPayment?.toLowerCase().includes(historySearch.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Navigation */}
      <Navbar
        currentUser={currentUser}
        profile={profile}
        verification={verification}
        allUsers={allUsers}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        notifications={notifications}
        onOpenTestRunner={() => setIsTestRunnerOpen(true)}
        onOpenKycModal={() => setIsKycModalOpen(true)}
        onSwitchUser={handleSwitchUser}
        onOpenSendWizard={() => {
          setWizardQuote(null);
          setIsWizardOpen(true);
        }}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Persona Hero Greeting Banner */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/60 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Welcome, {profile?.legalFirstName || 'Aman'}
                  </h1>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {verification?.tier || 'TIER_2_ENHANCED'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
                  {currentUser?.role === 'RECIPIENT'
                    ? 'You are viewing incoming international transfers and FedNow instant bank deposits.'
                    : 'Send money instantly from India to the United States and globally with guaranteed real-time exchange rates and USDC liquidity settlement.'}
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsKycModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  Limit: Up to $10,000 USD
                </button>
                <button
                  onClick={() => {
                    setWizardQuote(null);
                    setIsWizardOpen(true);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Money</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Total Volume</span>
                <p className="text-2xl font-extrabold text-white mt-1">
                  ₹{totalVolumeSent.toLocaleString()}
                </p>
                <span className="text-[11px] text-emerald-400 font-medium mt-1 inline-block">
                  INR to USD corridor
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Completed Transfers</span>
                <p className="text-2xl font-extrabold text-emerald-400 mt-1">
                  {completedTransfers.length}
                </p>
                <span className="text-[11px] text-slate-400 mt-1 inline-block">100% on-time settlement</span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Saved Beneficiaries</span>
                <p className="text-2xl font-extrabold text-indigo-400 mt-1">{recipients.length}</p>
                <span className="text-[11px] text-slate-400 mt-1 inline-block">Verified bank accounts</span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Settlement Rail</span>
                <p className="text-2xl font-extrabold text-teal-400 mt-1">Polygon USDC</p>
                <span className="text-[11px] text-slate-400 mt-1 inline-block">~$0.01 Gas · &lt;2 min</span>
              </div>
            </div>

            {/* Two Column Layout: Calculator & Recent Transfers */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Live FX Calculator */}
              <div className="lg:col-span-5">
                <FxCalculatorCard onStartTransfer={handleStartTransferFromQuote} />
              </div>

              {/* Right Column: Recent Transfers */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between pb-2">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Recent Transfers</h3>
                    <p className="text-xs text-slate-400">Click any transfer to inspect blockchain hashes and audit logs</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('history')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center space-x-1"
                  >
                    <span>View All</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {transfers.length === 0 ? (
                    <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center">
                      <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-300">No transfers yet</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Use the instant calculator to send your first transfer to Rahul!
                      </p>
                    </div>
                  ) : (
                    transfers.slice(0, 5).map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTransfer(t)}
                        className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center space-x-3.5">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                              t.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : t.status === 'COMPLIANCE_HOLD'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            }`}
                          >
                            {t.status === 'COMPLETED' ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : t.status === 'COMPLIANCE_HOLD' ? (
                              <AlertTriangle className="w-5 h-5" />
                            ) : (
                              <Clock className="w-5 h-5 animate-pulse" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-bold text-white text-sm">
                                {t.recipient?.fullName || 'Rahul Patel'}
                              </p>
                              <span className="font-mono text-[10px] text-slate-500">
                                {t.transferNumber}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {t.sourceCurrency} {t.sourceAmount.toLocaleString()} →{' '}
                              <strong className="text-slate-200">
                                ${t.targetAmount.toFixed(2)} {t.targetCurrency}
                              </strong>{' '}
                              via {t.recipient?.bankAccount.bankName || 'US Bank'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              t.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : t.status === 'COMPLIANCE_HOLD'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            }`}
                          >
                            {t.status}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-1 font-mono">
                            {new Date(t.createdAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RECIPIENTS TAB */}
        {activeTab === 'recipients' && (
          <RecipientManager
            recipients={recipients}
            onRefresh={refreshData}
            onSendToRecipient={handleSendToRecipient}
          />
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Transfer History & Receipts</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Complete audit log of all remittances, on-chain transaction hashes, and FedNow bank credits
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="COMPLIANCE_HOLD">Compliance Hold</option>
                  <option value="AWAITING_FUNDING">Awaiting Funding</option>
                  <option value="CRYPTO_TRANSFER_PENDING">Crypto Transfer Pending</option>
                </select>
              </div>
            </div>

            {/* History Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-4 py-3.5">Transfer Ref</th>
                    <th className="px-4 py-3.5">Beneficiary</th>
                    <th className="px-4 py-3.5">Sent Amount</th>
                    <th className="px-4 py-3.5">Received (USD)</th>
                    <th className="px-4 py-3.5">Rail & Stablecoin</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredHistory.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTransfer(t)}
                      className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3.5 font-mono font-semibold text-indigo-400">
                        {t.transferNumber}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-white">
                        {t.recipient?.fullName || 'Rahul Patel'}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {t.recipient?.bankAccount.bankName}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-200">
                        {t.sourceCurrency} {t.sourceAmount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-emerald-400">
                        ${t.targetAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-300">
                        {t.stablecoinAmount} {t.stablecoinSymbol} on {t.networkId}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            t.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : t.status === 'COMPLIANCE_HOLD'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                        {new Date(t.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button className="text-emerald-400 hover:text-emerald-300 font-semibold text-xs">
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ADMIN TAB */}
        {activeTab === 'admin' && (
          <AdminDashboard
            onInspectTransfer={(t) => setSelectedTransfer(t)}
            onRefreshAll={refreshData}
          />
        )}
      </main>

      {/* MODALS */}
      {isWizardOpen && (
        <TransferWizard
          initialQuote={wizardQuote}
          onClose={() => setIsWizardOpen(false)}
          onSuccess={(t) => {
            refreshData();
          }}
        />
      )}

      {selectedTransfer && (
        <TransferDetailModal
          transfer={selectedTransfer}
          currentUser={currentUser}
          onClose={() => setSelectedTransfer(null)}
          onRefresh={refreshData}
        />
      )}

      {isTestRunnerOpen && (
        <TestRunnerModal onClose={() => setIsTestRunnerOpen(false)} />
      )}

      {isKycModalOpen && (
        <KycVerificationModal
          verification={verification}
          profile={profile}
          onClose={() => setIsKycModalOpen(false)}
          onRefresh={refreshUser}
        />
      )}
    </div>
  );
}
