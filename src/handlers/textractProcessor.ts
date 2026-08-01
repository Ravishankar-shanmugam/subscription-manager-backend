import type { S3Event, S3EventRecord } from 'aws-lambda';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { buildSubscriptionInputFromText, extractTextFromImage } from '../services/invoiceService';
import { subscriptionService } from '../services/subscriptionService';
import type { CreateSubscriptionInput } from '../types/subscription';
import { loadBackendEnv } from '../utils/env';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

loadBackendEnv(__dirname);

function getBucketAndKey(record: S3EventRecord) {
  return {
    bucket: record.s3.bucket.name,
    key: decodeURIComponent(record.s3.object.key.replace(/\+/g, ' ')),
  };
}

async function getDocumentBody(bucket: string, key: string): Promise<Buffer> {
  const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks: Buffer[] = [];
  const stream = response.Body as NodeJS.ReadableStream;

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export async function processInvoiceFromS3(event: S3Event) {
  const processed: Array<{ bucket: string; key: string; created: boolean; serviceName: string }> = [];

  for (const record of event.Records || []) {
    const { bucket, key } = getBucketAndKey(record);
    if (!key.startsWith('uploads/')) continue;

    const body = await getDocumentBody(bucket, key);
    const extractedText = await extractTextFromImage(body);

    const inferred = buildSubscriptionInputFromText(extractedText);
    const serviceName = inferred.serviceName || 'Unknown Service';
    const upsertInput: CreateSubscriptionInput = {
      serviceName,
      category: inferred.category || 'OTHER',
      billingFrequency: inferred.billingFrequency || 'MONTHLY',
      amount: inferred.amount && inferred.amount > 0 ? inferred.amount : 0,
      currency: inferred.currency || 'USD',
      renewalDate: inferred.renewalDate || new Date().toISOString().slice(0, 10),
      autoRenew: inferred.autoRenew ?? true,
      reminderDaysBefore: inferred.reminderDaysBefore ?? [7],
      status: inferred.status || 'ACTIVE',
      notes: key,
    };

    const upsertResult = await subscriptionService.upsertByServiceName(upsertInput);
    processed.push({
      bucket,
      key,
      created: upsertResult.created,
      serviceName: upsertResult.subscription.serviceName,
    });
  }

  if (processed.length === 0) {
    return { created: false, message: 'No upload records processed' };
  }

  return {
    processedCount: processed.length,
    processed,
  };
}
