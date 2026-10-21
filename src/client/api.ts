import {
  ExchangeQuote,
  Recipient,
  Transfer,
  NotificationItem,
  AuditLogItem,
  SupportedNetwork,
  SupportedStablecoin,
  CountryCorridor,
  User,
  UserProfile,
  Verification,
} from '../shared/types';
import { TestResult } from '../server/tests/test-suite';

let currentUserId = 'user_aman_in';

export const setClientUserId = (userId: string) => {
  currentUserId = userId;
  localStorage.setItem('borderless_active_user_id', userId);
};

export const getClientUserId = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('borderless_active_user_id') || currentUserId;
  }
  return currentUserId;
};

const fetchApi = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': getClientUserId(),
    ...(options?.headers as Record<string, string>),
  };

  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'API request failed');
  }
  return data as T;
};

export const apiClient = {
  getMe: () =>
    fetchApi<{
      user: User;
      profile: UserProfile;
      verification: Verification;
      allUsers: { id: string; email: string; role: string; name: string }[];
    }>('/auth/me'),

  getCorridors: () =>
    fetchApi<{
      corridors: CountryCorridor[];
      networks: SupportedNetwork[];
      stablecoins: SupportedStablecoin[];
      baseRates: Record<string, number>;
    }>('/corridors'),

  getQuote: (body: {
    sourceCurrency: string;
    targetCurrency: string;
    sourceAmount?: number;
    targetAmount?: number;
    networkId?: string;
    stablecoinSymbol?: string;
  }) =>
    fetchApi<ExchangeQuote>('/quote', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getRecipients: () => fetchApi<Recipient[]>('/recipients'),

  createRecipient: (body: {
    fullName: string;
    email: string;
    phone?: string;
    country: string;
    payoutMethod: string;
    relationship: string;
    bankName: string;
    accountNumber: string;
    routingNumber?: string;
    ifscCode?: string;
    iban?: string;
    accountType?: 'CHECKING' | 'SAVINGS';
  }) =>
    fetchApi<Recipient>('/recipients', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getTransfers: () => fetchApi<Transfer[]>('/transfers'),

  getTransferById: (id: string) => fetchApi<Transfer>(`/transfers/${id}`),

  createTransfer: (body: {
    quoteId: string;
    recipientId: string;
    idempotencyKey?: string;
    purposeOfPayment?: string;
    senderNotes?: string;
    paymentMethod?: string;
    autoExecute?: boolean;
  }) =>
    fetchApi<Transfer>('/transfers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  executeTransferAction: (id: string, action: string, notes?: string) =>
    fetchApi<Transfer>(`/transfers/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, notes }),
    }),

  getAdminMetrics: () =>
    fetchApi<{
      totalTransfers: number;
      totalVolumeUSD: number;
      completedCount: number;
      inReviewCount: number;
      pendingCount: number;
      failedCount: number;
      successRate: number;
      activeCorridors: number;
      avgSettlementSeconds: number;
    }>('/admin/metrics'),

  getComplianceQueue: () => fetchApi<Transfer[]>('/admin/compliance-queue'),

  getAuditLogs: () => fetchApi<AuditLogItem[]>('/admin/audit-logs'),

  resetDatabase: () =>
    fetchApi<{ success: boolean; message: string }>('/admin/reset-database', {
      method: 'POST',
    }),

  getNotifications: () => fetchApi<NotificationItem[]>('/notifications'),

  markNotificationRead: (id: string) =>
    fetchApi<{ success: boolean }>(`/notifications/${id}/read`, {
      method: 'POST',
    }),

  runTests: () =>
    fetchApi<{
      passed: number;
      failed: number;
      total: number;
      durationMs: number;
      results: TestResult[];
    }>('/tests/run'),

  verifyKyc: (body: { documentType: string; documentNumber: string; taxId?: string; tier?: string }) =>
    fetchApi<{ success: boolean; verification: Verification; profile: UserProfile }>('/auth/verify-kyc', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
