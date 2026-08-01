import { differenceInDays, parseISO } from 'date-fns';
import { subscriptionRepository } from '../db/subscriptionRepository';
import { jsonRepository } from '../db/jsonRepository';
import type {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  SubscriptionListParams,
  DashboardStats,
  ReportData,
  UpcomingRenewal,
  SpendingByCategory,
  SubscriptionCategory,
} from '@subscription-manager/shared';

const repo = process.env.USE_LOCAL_JSON === 'true' ? jsonRepository : subscriptionRepository;

export const subscriptionService = {
  list: (params: SubscriptionListParams) => repo.list(params),

  getById: async (id: string) => {
    const sub = await repo.getById(id);
    if (!sub) throw { statusCode: 404, message: `Subscription ${id} not found` };
    return sub;
  },

  create: (input: CreateSubscriptionInput) => repo.create(input),

  findMatching: async (serviceName: string) => {
    const all = await repo.list({ pageSize: 1000 });
    const normalized = serviceName.toLowerCase();
    return all.items.find((sub) => sub.serviceName.toLowerCase().includes(normalized) || normalized.includes(sub.serviceName.toLowerCase())) ?? null;
  },

  update: async (id: string, input: UpdateSubscriptionInput) => {
    const sub = await repo.update(id, input);
    if (!sub) throw { statusCode: 404, message: `Subscription ${id} not found` };
    return sub;
  },

  delete: async (id: string) => {
    try {
      await repo.delete(id);
    } catch {
      throw { statusCode: 404, message: `Subscription ${id} not found` };
    }
  },
};

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const all = await repo.list({ pageSize: 1000 });
    const active = all.items.filter((s) => s.status === 'ACTIVE');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingRenewals: UpcomingRenewal[] = active
      .map((sub) => ({
        subscription: sub,
        daysUntilRenewal: differenceInDays(parseISO(sub.renewalDate), today),
      }))
      .filter(({ daysUntilRenewal }) => daysUntilRenewal >= 0 && daysUntilRenewal <= 30)
      .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);

    const monthlySpending = active.reduce((sum, s) => {
      return sum + (s.billingFrequency === 'MONTHLY' ? s.amount : s.amount / 12);
    }, 0);

    return {
      totalSubscriptions: all.total,
      activeSubscriptions: active.length,
      monthlySpending: Math.round(monthlySpending * 100) / 100,
      yearlySpending: Math.round(monthlySpending * 12 * 100) / 100,
      upcomingRenewals,
      renewalsNext7Days: upcomingRenewals.filter((u) => u.daysUntilRenewal <= 7).length,
      renewalsNext30Days: upcomingRenewals.length,
    };
  },
};

export const reportService = {
  async getReports(): Promise<ReportData> {
    const all = await repo.list({ pageSize: 1000, status: 'ACTIVE' as never });
    const active = all.items;

    const categoryMap = new Map<SubscriptionCategory, SpendingByCategory>();

    for (const sub of active) {
      const monthly = sub.billingFrequency === 'MONTHLY' ? sub.amount : sub.amount / 12;
      const yearly = sub.billingFrequency === 'YEARLY' ? sub.amount : sub.amount * 12;

      const existing = categoryMap.get(sub.category);
      if (existing) {
        existing.monthly += monthly;
        existing.yearly += yearly;
        existing.count += 1;
      } else {
        categoryMap.set(sub.category, { category: sub.category, monthly, yearly, count: 1 });
      }
    }

    const byCategory = Array.from(categoryMap.values()).map((c) => ({
      ...c,
      monthly: Math.round(c.monthly * 100) / 100,
      yearly: Math.round(c.yearly * 100) / 100,
    }));

    const monthlySpending = byCategory.reduce((s, c) => s + c.monthly, 0);
    const yearlySpending = byCategory.reduce((s, c) => s + c.yearly, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingRenewals: UpcomingRenewal[] = active
      .map((sub) => ({
        subscription: sub,
        daysUntilRenewal: differenceInDays(parseISO(sub.renewalDate), today),
      }))
      .filter(({ daysUntilRenewal }) => daysUntilRenewal >= 0)
      .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal)
      .slice(0, 10);

    return {
      monthlySpending: Math.round(monthlySpending * 100) / 100,
      yearlySpending: Math.round(yearlySpending * 100) / 100,
      byCategory,
      upcomingRenewals,
    };
  },
};

export const reminderService = {
  async getDueReminders() {
    const all = await repo.list({ pageSize: 1000, status: 'ACTIVE' as never });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return all.items
      .flatMap((sub) =>
        sub.reminderDaysBefore.map((days) => ({
          subscriptionId: sub.id,
          serviceName: sub.serviceName,
          renewalDate: sub.renewalDate,
          amount: sub.amount,
          currency: sub.currency,
          daysUntilRenewal: days,
          channels: ['API'] as const,
        })),
      )
      .filter(({ daysUntilRenewal, subscriptionId }) => {
        const sub = all.items.find((s) => s.id === subscriptionId)!;
        const actualDays = differenceInDays(parseISO(sub.renewalDate), today);
        return actualDays === daysUntilRenewal;
      });
  },
};
