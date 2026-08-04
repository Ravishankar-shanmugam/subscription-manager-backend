export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

export type SubscriptionCategory =
  | 'ENTERTAINMENT'
  | 'GROCERY'
  | 'FINANCE'
  | 'HEALTH'
  | 'PRODUCTIVITY'
  | 'EDUCATION'
  | 'TRAVEL'
  | 'UTILITIES'
  | 'STREAMING'
  | 'MUSIC'
  | 'AI'
  | 'CLOUD'
  | 'GAMING'
  | 'OTHER';

export type PurchaseChannel = 'ONLINE' | 'PHYSICAL_STORE' | 'UNKNOWN';

export type BillingFrequency = 'MONTHLY' | 'YEARLY';

export interface InvoiceAudit {
  title: string;
  price: number;
  currency: string;
  cardUsed: string | null;
  taxes: number | null;
  invoiceDate: string | null;
  vendor: string | null;
  purchaseChannel: PurchaseChannel | null;
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
  purchaseDate?: string;
  purchaseChannel?: PurchaseChannel;
  paymentCard?: string;
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
  purchaseDate?: string;
  purchaseChannel?: PurchaseChannel;
  paymentCard?: string;
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
  purchaseDate?: string;
  purchaseChannel?: PurchaseChannel;
  paymentCard?: string;
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
  purchaseChannel?: PurchaseChannel;
  paymentCard?: string;
  renewalMonth?: number;
  sortBy?: 'renewalDate' | 'purchaseDate' | 'amount' | 'serviceName' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ReportBucket {
  label: string;
  monthly: number;
  count: number;
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
  monthlyIncomeTarget: number;
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
  byMonth: ReportBucket[];
  byPurchaseChannel: ReportBucket[];
  byCard: ReportBucket[];
  upcomingRenewals: UpcomingRenewal[];
}