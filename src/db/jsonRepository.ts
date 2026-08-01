/**
 * JSON-file-backed repository for local development.
 * Used when USE_LOCAL_JSON=true (set automatically by local-server.ts).
 * Reads from data/subscriptions.json and keeps mutations in memory.
 */
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  Subscription,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  SubscriptionListParams,
  PaginatedResponse,
  SubscriptionStatus,
  SubscriptionCategory,
} from '../types/subscription';

const DATA_FILE = path.resolve(__dirname, '../../data/subscriptions.json');

let store: Subscription[] = [];

function loadStore() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    store = JSON.parse(raw) as Subscription[];
  } catch {
    store = [];
  }
}

loadStore();

export const jsonRepository = {
  async create(input: CreateSubscriptionInput): Promise<Subscription> {
    const now = new Date().toISOString();
    const subscription: Subscription = {
      id: uuidv4(),
      ...input,
      status: input.status ?? ('ACTIVE' as SubscriptionStatus),
      createdAt: now,
      updatedAt: now,
    };
    store.push(subscription);
    return subscription;
  },

  async getById(id: string): Promise<Subscription | null> {
    return store.find((s) => s.id === id) ?? null;
  },

  async update(id: string, input: UpdateSubscriptionInput): Promise<Subscription | null> {
    const idx = store.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    const updated: Subscription = {
      ...store[idx],
      ...input,
      id,
      updatedAt: new Date().toISOString(),
    };
    store[idx] = updated;
    return updated;
  },

  async delete(id: string): Promise<boolean> {
    const idx = store.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error(`Item not found: ${id}`);
    store.splice(idx, 1);
    return true;
  },

  async list(params: SubscriptionListParams = {}): Promise<PaginatedResponse<Subscription>> {
    const {
      page = 1,
      pageSize = 20,
      search,
      category,
      status,
      renewalMonth,
      sortBy = 'renewalDate',
      sortOrder = 'asc',
    } = params;

    let items = [...store];

    if (status) items = items.filter((s) => s.status === (status as SubscriptionStatus));
    if (category) items = items.filter((s) => s.category === (category as SubscriptionCategory));
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((s) => s.serviceName.toLowerCase().includes(q));
    }
    if (renewalMonth) {
      items = items.filter((s) => new Date(s.renewalDate).getMonth() + 1 === renewalMonth);
    }

    items.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'renewalDate') cmp = a.renewalDate.localeCompare(b.renewalDate);
      else if (sortBy === 'amount') cmp = a.amount - b.amount;
      else if (sortBy === 'serviceName') cmp = a.serviceName.localeCompare(b.serviceName);
      else if (sortBy === 'createdAt') cmp = a.createdAt.localeCompare(b.createdAt);
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    const total = items.length;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);

    return { items: paged, total, page, pageSize, hasMore: start + pageSize < total };
  },
};
