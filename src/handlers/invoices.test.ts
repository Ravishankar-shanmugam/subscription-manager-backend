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

  it('extracts file payload from multipart/form-data body', () => {
    const body =
      '--boundary123\r\n'
      + 'Content-Disposition: form-data; name="file"; filename="google-one.pdf"\r\n'
      + 'Content-Type: application/pdf\r\n\r\n'
      + 'invoice-data\r\n'
      + '--boundary123--\r\n';

    const event = {
      headers: { 'Content-Type': 'multipart/form-data; boundary=boundary123' },
      body,
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

    expect(payload?.buffer.toString('utf8')).toBe('invoice-data');
    expect(payload?.fileName).toBe('google-one.pdf');
    expect(payload?.contentType).toBe('application/pdf');
  });
});
