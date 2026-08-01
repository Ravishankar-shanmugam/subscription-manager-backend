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

export interface Subscription {
  id: string;
  serviceName: string;
  category: SubscriptionCategory;
  billingFrequency: BillingFrequency;
  amount: number;
  currency: string;
  renewalDate: string;
  autoRenew: boolean;
  reminderDaysBefore: number[];
  notes?: string;
  websiteUrl?: string;
  status: SubscriptionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionInput {
  serviceName: string;
  category: SubscriptionCategory;
  billingFrequency: BillingFrequency;
  amount: number;
  currency: string;
  renewalDate: string;
  autoRenew: boolean;
  reminderDaysBefore: number[];
  notes?: string;
  websiteUrl?: string;
  status?: SubscriptionStatus;
}

export interface UpdateSubscriptionInput {
  serviceName?: string;
  category?: SubscriptionCategory;
  billingFrequency?: BillingFrequency;
  amount?: number;
  currency?: string;
  renewalDate?: string;
  autoRenew?: boolean;
  reminderDaysBefore?: number[];
  notes?: string;
  websiteUrl?: string;
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