import fs from 'fs';
import path from 'path';
import {
  User,
  UserProfile,
  Verification,
  Recipient,
  ExchangeQuote,
  Transfer,
  TransferEvent,
  TransferStatus,
  BlockchainTransaction,
  FundingOrder,
  PayoutOrder,
  ComplianceCase,
  NotificationItem,
  AuditLogItem,
} from '../shared/types';
import {
  INITIAL_USERS,
  INITIAL_PROFILES,
  INITIAL_VERIFICATIONS,
  INITIAL_RECIPIENTS,
  INITIAL_TRANSFERS,
  INITIAL_NOTIFICATIONS,
} from '../../prisma/seed';

export interface DatabaseSchema {
  users: User[];
  profiles: UserProfile[];
  verifications: Verification[];
  recipients: Recipient[];
  quotes: ExchangeQuote[];
  transfers: Transfer[];
  notifications: NotificationItem[];
  auditLogs: AuditLogItem[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

class DatabaseStore {
  private data: DatabaseSchema;
  private isLoaded = false;

  constructor() {
    this.data = this.getDefaultState();
    this.load();
  }

  private getDefaultState(): DatabaseSchema {
    return {
      users: [...INITIAL_USERS],
      profiles: [...INITIAL_PROFILES],
      verifications: [...INITIAL_VERIFICATIONS],
      recipients: [...INITIAL_RECIPIENTS],
      quotes: [],
      transfers: [...(INITIAL_TRANSFERS as Transfer[])],
      notifications: [...INITIAL_NOTIFICATIONS],
      auditLogs: [
        {
          id: 'log_seed_init',
          userId: 'user_admin_elena',
          action: 'SYSTEM_BOOTSTRAP',
          entityType: 'System',
          entityId: 'global',
          details: { message: 'Initialized Borderless sandbox database with seed data' },
          createdAt: new Date().toISOString(),
        },
      ],
    };
  }

  private load(): void {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        if (parsed.users && parsed.transfers) {
          this.data = parsed;
          this.isLoaded = true;
          return;
        }
      }
    } catch (e) {
      console.warn('⚠️ Could not load database from disk, using fresh seed data:', e);
    }

    this.data = this.getDefaultState();
    this.save();
    this.isLoaded = true;
  }

  private save(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('❌ Failed to save database to disk:', e);
    }
  }

  // Users & Profiles
  public getUsers(): User[] {
    return this.data.users;
  }

  public findUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public findUserByEmail(email: string): User | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public findProfileByUserId(userId: string): UserProfile | undefined {
    return this.data.profiles.find((p) => p.userId === userId);
  }

  public findVerificationByUserId(userId: string): Verification | undefined {
    return this.data.verifications.find((v) => v.userId === userId);
  }

  public addUser(user: User, profile?: UserProfile, verification?: Verification): void {
    this.data.users.push(user);
    if (profile) this.data.profiles.push(profile);
    if (verification) this.data.verifications.push(verification);
    this.save();
  }

  public updateVerification(userId: string, updates: Partial<Verification>): Verification | undefined {
    const idx = this.data.verifications.findIndex((v) => v.userId === userId);
    if (idx !== -1) {
      this.data.verifications[idx] = {
        ...this.data.verifications[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.save();
      return this.data.verifications[idx];
    }
    return undefined;
  }

  // Recipients
  public getRecipientsBySenderId(senderId: string): Recipient[] {
    return this.data.recipients.filter((r) => r.senderId === senderId);
  }

  public findRecipientById(id: string): Recipient | undefined {
    return this.data.recipients.find((r) => r.id === id);
  }

  public addRecipient(recipient: Recipient): void {
    this.data.recipients.unshift(recipient);
    this.save();
  }

  // Quotes
  public saveQuote(quote: ExchangeQuote): void {
    this.data.quotes.push(quote);
    this.save();
  }

  public findQuoteById(id: string): ExchangeQuote | undefined {
    return this.data.quotes.find((q) => q.id === id);
  }

  public findQuoteByReference(quoteRef: string): ExchangeQuote | undefined {
    return this.data.quotes.find((q) => q.quoteReference === quoteRef);
  }

  // Transfers
  public getTransfers(): Transfer[] {
    return this.data.transfers;
  }

  public getTransfersByUserId(userId: string): Transfer[] {
    return this.data.transfers.filter(
      (t) => t.senderId === userId || t.recipientUserId === userId
    );
  }

  public findTransferById(id: string): Transfer | undefined {
    return this.data.transfers.find((t) => t.id === id);
  }

  public findTransferByIdempotencyKey(key: string): Transfer | undefined {
    return this.data.transfers.find((t) => t.idempotencyKey === key);
  }

  public addTransfer(transfer: Transfer): void {
    this.data.transfers.unshift(transfer);
    this.save();
  }

  public updateTransfer(id: string, updates: Partial<Transfer>): Transfer | undefined {
    const idx = this.data.transfers.findIndex((t) => t.id === id);
    if (idx !== -1) {
      this.data.transfers[idx] = {
        ...this.data.transfers[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.save();
      return this.data.transfers[idx];
    }
    return undefined;
  }

  public addTransferEvent(transferId: string, event: Omit<TransferEvent, 'id' | 'createdAt'>): TransferEvent {
    const transfer = this.findTransferById(transferId);
    if (!transfer) {
      throw new Error(`Transfer ${transferId} not found`);
    }

    const newEvent: TransferEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      transferId,
      ...event,
      createdAt: new Date().toISOString(),
    };

    if (!transfer.events) {
      transfer.events = [];
    }
    transfer.events.push(newEvent);
    transfer.status = event.newStatus;
    transfer.updatedAt = new Date().toISOString();
    this.save();
    return newEvent;
  }

  // Notifications
  public getNotificationsByUserId(userId: string): NotificationItem[] {
    return this.data.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addNotification(notification: Omit<NotificationItem, 'id' | 'createdAt' | 'isRead'>): NotificationItem {
    const item: NotificationItem = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...notification,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    this.data.notifications.unshift(item);
    this.save();
    return item;
  }

  public markNotificationRead(id: string): void {
    const n = this.data.notifications.find((item) => item.id === id);
    if (n) {
      n.isRead = true;
      this.save();
    }
  }

  // Audit Logs
  public addAuditLog(log: Omit<AuditLogItem, 'id' | 'createdAt'>): AuditLogItem {
    const item: AuditLogItem = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...log,
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(item);
    this.save();
    return item;
  }

  public getAuditLogs(limit = 100): AuditLogItem[] {
    return this.data.auditLogs.slice(0, limit);
  }

  // Reset database back to seed (useful for tests or demo resets)
  public resetToSeed(): void {
    this.data = this.getDefaultState();
    this.save();
  }
}

export const db = new DatabaseStore();
