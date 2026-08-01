import type { APIGatewayProxyResult } from 'aws-lambda';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export function ok<T>(data: T, message?: string): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ data, message }),
  };
}

export function created<T>(data: T): APIGatewayProxyResult {
  return {
    statusCode: 201,
    headers: CORS_HEADERS,
    body: JSON.stringify({ data }),
  };
}

export function noContent(): APIGatewayProxyResult {
  return {
    statusCode: 204,
    headers: CORS_HEADERS,
    body: '',
  };
}

export function badRequest(message: string): APIGatewayProxyResult {
  return {
    statusCode: 400,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: 'BAD_REQUEST', message, statusCode: 400 }),
  };
}

export function notFound(message: string): APIGatewayProxyResult {
  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: 'NOT_FOUND', message, statusCode: 404 }),
  };
}

export function internalError(message = 'Internal server error'): APIGatewayProxyResult {
  return {
    statusCode: 500,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: 'INTERNAL_ERROR', message, statusCode: 500 }),
  };
}

export function handleError(error: unknown): APIGatewayProxyResult {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const e = error as { statusCode: number; message: string };
    if (e.statusCode === 404) return notFound(e.message);
    if (e.statusCode === 400) return badRequest(e.message);
  }
  console.error('Unhandled error:', error);
  return internalError();
}
