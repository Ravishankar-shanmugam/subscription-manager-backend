import { processInvoiceFromS3 } from './textractProcessor';

describe('processInvoiceFromS3', () => {
  it('ignores non-upload records', async () => {
    const result = await processInvoiceFromS3({ Records: [] } as never);
    expect(result).toEqual({ created: false, message: 'No upload records processed' });
  });
});
