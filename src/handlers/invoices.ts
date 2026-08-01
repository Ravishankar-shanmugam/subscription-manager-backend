import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ingestInvoice } from '../services/invoiceService';
import { badRequest, created, handleError } from '../utils/response';

export interface InvoiceUploadPayload {
  buffer: Buffer;
  fileName?: string;
  contentType?: string;
}

function getContentType(event: APIGatewayProxyEvent): string {
  return event.headers?.['Content-Type'] || event.headers?.['content-type'] || '';
}

export function extractInvoicePayload(event: APIGatewayProxyEvent): InvoiceUploadPayload | null {
  if (!event.body) return null;

  const contentType = getContentType(event);

  if (contentType.includes('application/json') || contentType.includes('text/plain')) {
    try {
      const parsed = JSON.parse(event.body);
      const base64 = typeof parsed === 'string' ? parsed : parsed.file || parsed.body || '';
      if (!base64) return null;
      return {
        buffer: Buffer.from(base64, 'base64'),
        fileName: typeof parsed === 'string' ? undefined : parsed.filename || parsed.fileName || parsed.name,
        contentType: typeof parsed === 'string' ? undefined : parsed.contentType || parsed.content_type,
      };
    } catch {
      return null;
    }
  }

  if (contentType.includes('multipart/form-data')) {
    try {
      const parsed = JSON.parse(event.body);
      const base64 = parsed.file || parsed.body || '';
      if (!base64) return null;
      return {
        buffer: Buffer.from(base64, 'base64'),
        fileName: parsed.filename || parsed.fileName || parsed.name,
        contentType: parsed.contentType || parsed.content_type,
      };
    } catch {
      return null;
    }
  }

  return null;
}

export async function uploadInvoice(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const payload = extractInvoicePayload(event);
    if (!payload) return badRequest('No file content provided');

    const result = await ingestInvoice(payload.buffer, {
      fileName: payload.fileName,
      contentType: payload.contentType,
    });
    return created(result);
  } catch (err) {
    return handleError(err);
  }
}
