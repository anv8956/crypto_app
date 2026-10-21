import React, { useState } from 'react';
import {
  ArrowLeftRight,
  ShieldCheck,
  Send,
  Users,
  History,
  ShieldAlert,
  Bell,
  CheckCircle2,
  Terminal,
  ExternalLink,
  ChevronDown,
  UserCheck,
} from 'lucide-react';
import { NotificationItem, User, UserProfile, Verification } from '../../shared/types';
import { setClientUserId } from '../api';

interface NavbarProps {
  currentUser: User | null;
  profile: UserProfile | null;
  verification: Verification | null;
  allUsers: { id: string; email: string; role: string; name: string }[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  notifications: NotificationItem[];
  onOpenTestRunner: () => void;
  onOpenKycModal: () => void;
  onSwitchUser: (userId: string) => void;
  onOpenSendWizard: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  profile,
  verification,
  allUsers,
  activeTab,
  setActiveTab,
  notifications,
  onOpenTestRunner,
  onOpenKycModal,
  onSwitchUser,
  onOpenSendWizard,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      {/* Sandbox Notification Banner */}
      <div className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-indigo-950/90 border-b border-emerald-500/20 px-4 py-1.5 text-xs text-slate-300 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-emerald-400">Sandbox Environment</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-300 hidden sm:inline">
            Simulated liquidity rails on Polygon PoS (USDC) & instant FedNow / IMPS local bank clearing.
          </span>
        </div>
        <button
          onClick={onOpenTestRunner}
          className="flex items-center space-x-1.5 text-indigo-400 hover:text-indigo-300 font-mono text-xs cursor-pointer transition-colors"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Run Automated Test Suite (10+ Tests)</span>
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <ArrowLeftRight className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-tight text-white">BORDERLESS</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  USDC Rails
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Stablecoin Cross-Border Remittance</p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('recipients')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'recipients'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Recipients
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Transfers & History
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'admin'
                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              <span>Admin & Compliance</span>
            </button>
          </nav>

          {/* Right Controls */}
          <div className="flex items-center space-x-3">
            {/* Quick Send CTA */}
            <button
              onClick={onOpenSendWizard}
              className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-semibold px-4 py-2 rounded-xl shadow-md shadow-emerald-500/20 text-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Send Money</span>
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-slate-950">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-3 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">Notifications</span>
                    <span className="text-[11px] text-slate-400">{notifications.length} total</span>
                  </div>
                  <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No notifications yet</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-left border border-slate-700/40 text-xs"
                        >
                          <p className="font-semibold text-slate-200">{n.title}</p>
                          <p className="text-slate-400 mt-1 line-clamp-2">{n.body}</p>
                          <span className="text-[10px] text-slate-500 mt-1 block">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Active Persona / User Selector */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 pl-2 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs font-bold border border-indigo-500/30">
                  {profile?.legalFirstName?.charAt(0) || 'A'}
                </div>
                <div className="hidden sm:block text-xs">
                  <p className="font-semibold text-slate-200 leading-tight">
                    {profile?.legalFirstName || 'Aman'} {profile?.legalLastName?.charAt(0) || 'S'}.
                  </p>
                  <p className="text-[10px] text-emerald-400 leading-tight flex items-center space-x-1">
                    <span>{currentUser?.role === 'COMPLIANCE_OFFICER' ? 'Admin / AML' : currentUser?.role}</span>
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <p className="text-xs font-medium text-slate-400">Switch Persona (Interactive Demo)</p>
                  </div>
                  <div className="mt-1 space-y-1">
                    {allUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          onSwitchUser(u.id);
                          setShowUserMenu(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                          currentUser?.id === u.id
                            ? 'bg-slate-800 text-white font-medium'
                            : 'text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <div>
                          <p className="font-semibold">{u.name || u.email}</p>
                          <p className="text-[10px] text-slate-400">{u.role} | {u.email}</p>
                        </div>
                        {currentUser?.id === u.id && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenKycModal();
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800 transition-colors text-left"
                    >
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      <span>KYC Verification & Limits</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
