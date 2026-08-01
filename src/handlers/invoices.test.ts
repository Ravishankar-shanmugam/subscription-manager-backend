import type { APIGatewayProxyEvent } from 'aws-lambda';
import { extractInvoicePayload } from './invoices';

describe('invoice upload handler', () => {
  it('extracts a base64 file payload from a JSON request body', () => {
    const fileContent = 'invoice-data';
    const event = {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: Buffer.from(fileContent).toString('base64') }),
      httpMethod: 'POST',
      isBase64Encoded: false,
      multiValueHeaders: {},
      path: '/invoices/upload',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as never,
      resource: '/invoices/upload',
    } as unknown as APIGatewayProxyEvent;

    const payload = extractInvoicePayload(event);

    expect(payload?.buffer.toString('utf8')).toBe(fileContent);
  });
});
