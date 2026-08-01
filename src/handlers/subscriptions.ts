import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { subscriptionService } from '../services/subscriptionService';
import { ok, created, noContent, badRequest, handleError } from '../utils/response';
import type { CreateSubscriptionInput, SubscriptionListParams } from '@subscription-manager/shared';

export async function listSubscriptions(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const q = event.queryStringParameters || {};
    const params: SubscriptionListParams = {
      search: q.search,
      category: q.category as never,
      status: q.status as never,
      renewalMonth: q.renewalMonth ? parseInt(q.renewalMonth, 10) : undefined,
      sortBy: (q.sortBy as never) || 'renewalDate',
      sortOrder: (q.sortOrder as 'asc' | 'desc') || 'asc',
      page: q.page ? parseInt(q.page, 10) : 1,
      pageSize: q.pageSize ? parseInt(q.pageSize, 10) : 20,
    };
    const result = await subscriptionService.list(params);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function getSubscription(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const id = event.pathParameters?.id;
    if (!id) return badRequest('Missing subscription ID');
    const sub = await subscriptionService.getById(id);
    return ok(sub);
  } catch (err) {
    return handleError(err);
  }
}

export async function createSubscription(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) return badRequest('Request body is required');
    const input = JSON.parse(event.body) as CreateSubscriptionInput;
    if (!input.serviceName) return badRequest('serviceName is required');
    if (!input.amount || input.amount <= 0) return badRequest('amount must be positive');
    const sub = await subscriptionService.create(input);
    return created(sub);
  } catch (err) {
    return handleError(err);
  }
}

export async function updateSubscription(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const id = event.pathParameters?.id;
    if (!id) return badRequest('Missing subscription ID');
    if (!event.body) return badRequest('Request body is required');
    const input = JSON.parse(event.body);
    const sub = await subscriptionService.update(id, input);
    return ok(sub);
  } catch (err) {
    return handleError(err);
  }
}

export async function deleteSubscription(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const id = event.pathParameters?.id;
    if (!id) return badRequest('Missing subscription ID');
    await subscriptionService.delete(id);
    return noContent();
  } catch (err) {
    return handleError(err);
  }
}
