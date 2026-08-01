export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

export type SubscriptionCategory =
  | 'STREAMING'
  | 'MUSIC'
  | 'AI'
  | 'CLOUD'
  | 'UTILITIES'
  | 'GAMING'
  | 'OTHER';

export type BillingFrequency = 'MONTHLY' | 'YEARLY';

export interface InvoiceAudit {
  title: string;
  price: number;
  currency: string;
  cardUsed: string | null;
  taxes: number | null;
  invoiceDate: string | null;
  vendor: string | null;
  forms: Record<string, string>;
  extractedText: string;
}

export interface Subscription {
  id: string;
  serviceName: string;
  invoiceTitle?: string;
  category: SubscriptionCategory;
  billingFrequency: BillingFrequency;
  amount: number;
  currency: string;
  renewalDate: string;
  autoRenew: boolean;
  reminderDaysBefore: number[];
  notes?: string;
  websiteUrl?: string;
  invoiceAudit?: InvoiceAudit;
  status: SubscriptionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionInput {
  serviceName: string;
  invoiceTitle?: string;
  category: SubscriptionCategory;
  billingFrequency: BillingFrequency;
  amount: number;
  currency: string;
  renewalDate: string;
  autoRenew: boolean;
  reminderDaysBefore: number[];
  notes?: string;
  websiteUrl?: string;
  invoiceAudit?: InvoiceAudit;
  status?: SubscriptionStatus;
}

export interface UpdateSubscriptionInput {
  serviceName?: string;
  invoiceTitle?: string;
  category?: SubscriptionCategory;
  billingFrequency?: BillingFrequency;
  amount?: number;
  currency?: string;
  renewalDate?: string;
  autoRenew?: boolean;
  reminderDaysBefore?: number[];
  notes?: string;
  websiteUrl?: string;
  invoiceAudit?: InvoiceAudit;
  status?: SubscriptionStatus;
}

export interface SubscriptionListParams {
  search?: string;
  category?: SubscriptionCategory;
  status?: SubscriptionStatus;
  renewalMonth?: number;
  sortBy?: 'renewalDate' | 'amount' | 'serviceName' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface UpcomingRenewal {
  subscription: Subscription;
  daysUntilRenewal: number;
}

export interface DashboardStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  monthlySpending: number;
  yearlySpending: number;
  upcomingRenewals: UpcomingRenewal[];
  renewalsNext7Days: number;
  renewalsNext30Days: number;
}

export interface SpendingByCategory {
  category: SubscriptionCategory;
  monthly: number;
  yearly: number;
  count: number;
}

export interface ReportData {
  monthlySpending: number;
  yearlySpending: number;
  byCategory: SpendingByCategory[];
  upcomingRenewals: UpcomingRenewal[];
}