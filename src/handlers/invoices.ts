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

function decodeBody(event: APIGatewayProxyEvent): Buffer {
  if (!event.body) return Buffer.alloc(0);
  return event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body, 'utf8');
}

function parseMultipartPayload(
  bodyBuffer: Buffer,
  contentType: string,
): InvoiceUploadPayload | null {
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
  if (!boundaryMatch) return null;

  const boundary = Buffer.from(`--${boundaryMatch[1].trim()}`, 'utf8');
  const headerSeparator = Buffer.from('\r\n\r\n', 'utf8');
  const lineBreak = Buffer.from('\r\n', 'utf8');
  let cursor = 0;

  while (cursor < bodyBuffer.length) {
    const boundaryStart = bodyBuffer.indexOf(boundary, cursor);
    if (boundaryStart === -1) break;

    const partStart = boundaryStart + boundary.length + lineBreak.length;
    const headerEnd = bodyBuffer.indexOf(headerSeparator, partStart);
    if (headerEnd === -1) break;

    const headersRaw = bodyBuffer.subarray(partStart, headerEnd).toString('utf8');
    const hasFileField = /name="file"/i.test(headersRaw);
    const fileNameMatch = headersRaw.match(/filename="([^"]+)"/i);
    const partContentTypeMatch = headersRaw.match(/content-type:\s*([^\r\n]+)/i);

    const dataStart = headerEnd + headerSeparator.length;
    const nextBoundaryPrefix = Buffer.from(`\r\n--${boundaryMatch[1].trim()}`, 'utf8');
    const dataEnd = bodyBuffer.indexOf(nextBoundaryPrefix, dataStart);
    if (dataEnd === -1) break;

    if (hasFileField) {
      return {
        buffer: bodyBuffer.subarray(dataStart, dataEnd),
        fileName: fileNameMatch?.[1],
        contentType: partContentTypeMatch?.[1]?.trim(),
      };
    }

    cursor = dataEnd + 2;
  }

  return null;
}

export function extractInvoicePayload(event: APIGatewayProxyEvent): InvoiceUploadPayload | null {
  if (!event.body) return null;

  const contentType = getContentType(event);
  const bodyBuffer = decodeBody(event);

  if (contentType.includes('application/json') || contentType.includes('text/plain')) {
    try {
      const parsed = JSON.parse(bodyBuffer.toString('utf8'));
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
    return parseMultipartPayload(bodyBuffer, contentType);
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
