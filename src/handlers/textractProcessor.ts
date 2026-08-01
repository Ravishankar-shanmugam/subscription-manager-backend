import type { S3Event, S3EventRecord } from 'aws-lambda';
import { subscriptionRepository } from '../db/subscriptionRepository';
import { buildSubscriptionInputFromText, extractTextFromImage } from '../services/invoiceService';
import { loadBackendEnv } from '../utils/env';

let s3Client: { send: (command: unknown) => Promise<any> } | null = null;
let textractClient: { send: (command: unknown) => Promise<any> } | null = null;

function getClients() {
  if (!s3Client) {
    const { S3Client } = require('@aws-sdk/client-s3') as {
      S3Client: new (options: { region: string }) => { send: (command: unknown) => Promise<any> };
    };
    s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  }

  if (!textractClient) {
    const { TextractClient } = require('@aws-sdk/client-textract') as {
      TextractClient: new (options: { region: string }) => { send: (command: unknown) => Promise<any> };
    };
    textractClient = new TextractClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }

  return { s3Client, textractClient };
}

loadBackendEnv(__dirname);

function getBucketAndKey(record: S3EventRecord) {
  return {
    bucket: record.s3.bucket.name,
    key: decodeURIComponent(record.s3.object.key.replace(/\+/g, ' ')),
  };
}

async function getDocumentBody(bucket: string, key: string): Promise<Buffer> {
  const { s3Client: client } = getClients();
  const { GetObjectCommand } = require('@aws-sdk/client-s3') as {
    GetObjectCommand: new (input: { Bucket: string; Key: string }) => unknown;
  };
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks: Buffer[] = [];
  const stream = response.Body as NodeJS.ReadableStream;

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function runTextract(bucket: string, key: string): Promise<string> {
  const { textractClient: client } = getClients();
  const { StartDocumentTextDetectionCommand, GetDocumentTextDetectionCommand } = require('@aws-sdk/client-textract') as {
    StartDocumentTextDetectionCommand: new (input: { DocumentLocation: { S3Object: { Bucket: string; Name: string } } }) => unknown;
    GetDocumentTextDetectionCommand: new (input: { JobId: string }) => unknown;
  };
  const response = await client.send(new StartDocumentTextDetectionCommand({
    DocumentLocation: {
      S3Object: { Bucket: bucket, Name: key },
    },
  }));

  const jobId = response.JobId;
  if (!jobId) throw new Error('Textract job did not start');

  let status = 'IN_PROGRESS';
  let result;
  while (status === 'IN_PROGRESS') {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    result = await client.send(new GetDocumentTextDetectionCommand({ JobId: jobId }));
    status = result.JobStatus || 'IN_PROGRESS';
  }

  if (result?.Blocks) {
    return result.Blocks.filter((block: { BlockType?: string }) => block.BlockType === 'LINE')
      .map((block: { Text?: string }) => block.Text || '')
      .join('\n');
  }

  return '';
}

export async function processInvoiceFromS3(event: S3Event) {
  for (const record of event.Records || []) {
    const { bucket, key } = getBucketAndKey(record);
    if (!key.startsWith('uploads/')) continue;

    const body = await getDocumentBody(bucket, key);
    let extractedText = '';

    try {
      extractedText = await runTextract(bucket, key);
    } catch {
      extractedText = await extractTextFromImage(body);
    }

    const inferred = buildSubscriptionInputFromText(extractedText);
    const created = await subscriptionRepository.create(inferred as never);

    return {
      created,
      bucket,
      key,
      extractedText,
    };
  }

  return { created: false, message: 'No upload records processed' };
}
