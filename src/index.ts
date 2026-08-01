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

// Route table for Lambda — API Gateway maps routes to this single function
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const { httpMethod, resource } = event;

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
  if (resource === '/subscriptions' && httpMethod === 'GET') return listSubscriptions(event);
  if (resource === '/subscriptions' && httpMethod === 'POST') return createSubscription(event);
  if (resource === '/subscriptions/{id}' && httpMethod === 'GET') return getSubscription(event);
  if (resource === '/subscriptions/{id}' && httpMethod === 'PUT') return updateSubscription(event);
  if (resource === '/subscriptions/{id}' && httpMethod === 'DELETE') return deleteSubscription(event);
  if (resource === '/dashboard' && httpMethod === 'GET') return getDashboard();
  if (resource === '/reports' && httpMethod === 'GET') return getReports();
  if (resource === '/reminders' && httpMethod === 'GET') return getReminders();
  if (resource === '/invoices/upload' && httpMethod === 'POST') return uploadInvoice(event);

  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'NOT_FOUND', message: 'Route not found', statusCode: 404 }),
  };
};
