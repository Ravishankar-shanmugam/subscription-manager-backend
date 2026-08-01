import {
  PutCommand,
  GetCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { dynamoDb, TABLE_NAME } from './dynamoClient';
import type {
  Subscription,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  SubscriptionListParams,
  PaginatedResponse,
  SubscriptionStatus,
  SubscriptionCategory,
} from '../types/subscription';

// ─── DynamoDB Schema ──────────────────────────────────────────────────────────
// PK: SUBSCRIPTION#{id}
// SK: METADATA
// GSI1PK: STATUS#{status}   GSI1SK: RENEWAL#{renewalDate}
// GSI2PK: CATEGORY#{category}   GSI2SK: RENEWAL#{renewalDate}
// Future: PK: USER#{userId}#SUBSCRIPTION#{id} for multi-user
// ─────────────────────────────────────────────────────────────────────────────

function toDbItem(sub: Subscription) {
  return {
    PK: `SUBSCRIPTION#${sub.id}`,
    SK: 'METADATA',
    GSI1PK: `STATUS#${sub.status}`,
    GSI1SK: `RENEWAL#${sub.renewalDate}`,
    GSI2PK: `CATEGORY#${sub.category}`,
    GSI2SK: `RENEWAL#${sub.renewalDate}`,
    ...sub,
  };
}

function fromDbItem(item: Record<string, unknown>): Subscription {
  const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, ...sub } = item;
  return sub as unknown as Subscription;
}

export const subscriptionRepository = {
  async create(input: CreateSubscriptionInput): Promise<Subscription> {
    const now = new Date().toISOString();
    const subscription: Subscription = {
      id: uuidv4(),
      ...input,
      status: input.status ?? ('ACTIVE' as SubscriptionStatus),
      createdAt: now,
      updatedAt: now,
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: toDbItem(subscription),
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );

    return subscription;
  },

  async getById(id: string): Promise<Subscription | null> {
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `SUBSCRIPTION#${id}`, SK: 'METADATA' },
      }),
    );

    if (!result.Item) return null;
    return fromDbItem(result.Item);
  },

  async update(id: string, input: UpdateSubscriptionInput): Promise<Subscription | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const updated: Subscription = {
      ...existing,
      ...input,
      id,
      updatedAt: new Date().toISOString(),
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: toDbItem(updated),
        ConditionExpression: 'attribute_exists(PK)',
      }),
    );

    return updated;
  },

  async delete(id: string): Promise<boolean> {
    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: `SUBSCRIPTION#${id}`, SK: 'METADATA' },
        ConditionExpression: 'attribute_exists(PK)',
      }),
    );
    return true;
  },

  async list(params: SubscriptionListParams = {}): Promise<PaginatedResponse<Subscription>> {
    const { page = 1, pageSize = 20, search, category, status, renewalMonth, sortBy = 'renewalDate', sortOrder = 'asc' } = params;

    // For MVP we use Scan with client-side filtering.
    // In production, use GSI queries for status/category filters.
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'SK = :sk',
        ExpressionAttributeValues: { ':sk': 'METADATA' },
      }),
    );

    let items: Subscription[] = (result.Items || []).map((item) =>
      fromDbItem(item as Record<string, unknown>),
    );

    // Filtering
    if (status) {
      items = items.filter((s) => s.status === (status as SubscriptionStatus));
    }
    if (category) {
      items = items.filter((s) => s.category === (category as SubscriptionCategory));
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((s) => s.serviceName.toLowerCase().includes(q));
    }
    if (renewalMonth) {
      items = items.filter((s) => {
        const m = new Date(s.renewalDate).getMonth() + 1;
        return m === renewalMonth;
      });
    }

    // Sorting
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

    return {
      items: paged,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  },
};
