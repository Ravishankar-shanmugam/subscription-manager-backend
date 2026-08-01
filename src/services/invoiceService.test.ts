import { buildSubscriptionInputFromText, extractTextFromInvoiceBuffer, inferAmount, inferBillingFrequency, inferCategory, inferRenewalDate, inferServiceName, normalizeText, uploadDocumentToS3 } from './invoiceService';

jest.mock('node:child_process', () => ({
  execFile: jest.fn((_, __, ___, callback) => callback?.(null)),
}));

describe('invoice inference', () => {
  it('extracts a service name and amount from invoice text', () => {
    const text = `Netflix
Invoice #123
Amount Due: $15.49
Renewal Date: 2026-08-01`;

    expect(normalizeText(text)).toContain('Netflix');
    expect(inferServiceName(text)).toBe('Netflix');
    expect(inferAmount(text)).toBe(15.49);
    expect(inferCategory(text)).toBe('STREAMING');
    expect(inferBillingFrequency(text)).toBe('MONTHLY');
    expect(inferRenewalDate(text)).toBe('2026-08-01');
  });

  it('falls back to plain text parsing for text-based invoice uploads', () => {
    const text = 'Netflix\nAmount Due: $15.49\nRenewal Date: 2026-08-01';
    const buffer = Buffer.from(text, 'utf8');

    expect(extractTextFromInvoiceBuffer(buffer)).toBe(text);
  });

  it('uploads document bytes to S3 with the expected metadata', async () => {
    const originalAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const originalSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';

    const result = await uploadDocumentToS3(Buffer.from('invoice-bytes'), {
      bucketName: 'subscription-app-docs',
      objectKey: 'uploads/test-invoice.txt',
      contentType: 'text/plain',
      fileName: 'test-invoice.txt',
    });

    expect(result).toEqual({
      bucket: 'subscription-app-docs',
      key: 'uploads/test-invoice.txt',
      fileName: 'test-invoice.txt',
      contentType: 'text/plain',
      uploadedToS3: true,
    });

    process.env.AWS_ACCESS_KEY_ID = originalAccessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = originalSecretAccessKey;
  });

  it('builds a subscription payload from extracted invoice text', () => {
    const text = 'Netflix\nAmount Due: $15.49\nRenewal Date: 2026-08-01';
    const payload = buildSubscriptionInputFromText(text);

    expect(payload.serviceName).toBe('Netflix');
    expect(payload.amount).toBe(15.49);
    expect(payload.category).toBe('STREAMING');
  });
});
