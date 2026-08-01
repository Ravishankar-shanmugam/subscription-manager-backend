import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  listSubscriptions,
  getSubscription,
  createSubscription,
  updateSubscription,
  deleteSubscription,
} from './handlers/subscriptions';
import { getDashboard, getReports, getReminders } from './handlers/dashboard';
import { uploadInvoice } from './handlers/invoices';

function normalizePath(event: APIGatewayProxyEvent): string {
  const stage = event.requestContext?.stage;
  const rawPath = event.path || event.requestContext?.path || '/';

  let path = rawPath;

  if (stage) {
    if (path === `/${stage}`) {
      path = '/';
    } else if (path.startsWith(`/${stage}/`)) {
      path = path.slice(stage.length + 1);
    }
  }

  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  const normalized = path.replace(/\/+$/, '');
  return normalized || '/';
}

// Route table for Lambda — API Gateway maps routes to this single function
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const { httpMethod } = event;
  const path = normalizePath(event);

  // CORS preflight
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      },
      body: '',
    };
  }

  // Routing
  if (path === '/subscriptions' && httpMethod === 'GET') return listSubscriptions(event);
  if (path === '/subscriptions' && httpMethod === 'POST') return createSubscription(event);

  if (path.startsWith('/subscriptions/')) {
    const id = path.split('/')[2];
    if (id) {
      event.pathParameters = { ...(event.pathParameters || {}), id };
      if (httpMethod === 'GET') return getSubscription(event);
      if (httpMethod === 'PUT') return updateSubscription(event);
      if (httpMethod === 'DELETE') return deleteSubscription(event);
    }
  }

  if (path === '/dashboard' && httpMethod === 'GET') return getDashboard();
  if (path === '/reports' && httpMethod === 'GET') return getReports();
  if (path === '/reminders' && httpMethod === 'GET') return getReminders();
  if (path === '/invoices/upload' && httpMethod === 'POST') return uploadInvoice(event);

  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'NOT_FOUND', message: 'Route not found', statusCode: 404 }),
  };
};
