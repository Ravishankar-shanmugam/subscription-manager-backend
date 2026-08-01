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
} from '../types/subscription';

const repo = process.env.USE_LOCAL_JSON === 'true' ? jsonRepository : subscriptionRepository;

function normalizeServiceName(serviceName: string): string {
  return serviceName.replace(/\s+/g, ' ').trim().toLowerCase();
}

function resolveUniqueTitle(input: { invoiceTitle?: string; serviceName: string }): string {
  return (input.invoiceTitle || input.serviceName || 'Unknown Invoice').trim();
}

export const subscriptionService = {
  list: (params: SubscriptionListParams) => repo.list(params),

  getById: async (id: string) => {
    const sub = await repo.getById(id);
    if (!sub) throw { statusCode: 404, message: `Subscription ${id} not found` };
    return sub;
  },

  create: async (input: CreateSubscriptionInput) => {
    const existing = await subscriptionService.findByInvoiceTitle(resolveUniqueTitle(input));
    if (existing) {
      const updated = await subscriptionService.update(existing.id, {
        ...input,
        serviceName: existing.serviceName,
        invoiceTitle: existing.invoiceTitle || existing.serviceName,
      });
      return updated;
    }

    return repo.create(input);
  },

  upsertByInvoiceTitle: async (input: CreateSubscriptionInput) => {
    const uniqueTitle = resolveUniqueTitle(input);
    const existing = await subscriptionService.findByInvoiceTitle(uniqueTitle);

    if (existing) {
      const updated = await subscriptionService.update(existing.id, {
        ...input,
        serviceName: existing.serviceName,
        invoiceTitle: existing.invoiceTitle || existing.serviceName,
      });
      return { created: false, subscription: updated };
    }

    const created = await repo.create({
      ...input,
      serviceName: uniqueTitle,
      invoiceTitle: uniqueTitle,
    });
    return { created: true, subscription: created };
  },

  upsertByServiceName: async (input: CreateSubscriptionInput) => {
    return subscriptionService.upsertByInvoiceTitle(input);
  },

  findByInvoiceTitle: async (invoiceTitle: string) => {
    const normalized = normalizeServiceName(invoiceTitle);
    const all = await repo.list({ pageSize: 1000 });
    return (
      all.items.find((sub) => {
        const uniqueTitle = sub.invoiceTitle || sub.serviceName;
        return normalizeServiceName(uniqueTitle) === normalized;
      }) ?? null
    );
  },

  findByServiceName: async (serviceName: string) => {
    return subscriptionService.findByInvoiceTitle(serviceName);
  },

  findMatching: async (serviceName: string) => {
    return subscriptionService.findByServiceName(serviceName);
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
