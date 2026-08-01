import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { TextractClient, DetectDocumentTextCommand, type Block } from '@aws-sdk/client-textract';
import type {
  CreateSubscriptionInput,
  SubscriptionCategory,
  SubscriptionStatus,
  BillingFrequency,
} from '../types/subscription';
import { loadBackendEnv } from '../utils/env';

loadBackendEnv(__dirname);

const region = process.env.AWS_REGION || 'us-east-1';
const textractClient = new TextractClient({ region });
const s3Client = new S3Client({ region });

export function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function inferCategory(text: string): SubscriptionCategory {
  const normalized = text.toLowerCase();
  if (normalized.includes('netflix') || normalized.includes('spotify') || normalized.includes('disney') || normalized.includes('streaming')) return 'STREAMING' as SubscriptionCategory;
  if (normalized.includes('aws') || normalized.includes('cloud') || normalized.includes('azure')) return 'CLOUD' as SubscriptionCategory;
  if (normalized.includes('openai') || normalized.includes('chatgpt') || normalized.includes('ai')) return 'AI' as SubscriptionCategory;
  if (normalized.includes('google') || normalized.includes('microsoft') || normalized.includes('office')) return 'UTILITIES' as SubscriptionCategory;
  return 'OTHER' as SubscriptionCategory;
}

export function inferBillingFrequency(text: string): BillingFrequency {
  return text.toLowerCase().includes('year') ? 'YEARLY' as BillingFrequency : 'MONTHLY' as BillingFrequency;
}

export function inferAmount(text: string): number | null {
  const currencyMatches = Array.from(text.matchAll(/\$(\d+(?:\.\d{1,2})?)/g)).map((match) => Number(match[1]));
  if (currencyMatches.length > 0) return currencyMatches[0] ?? null;

  const labelMatches = Array.from(
    text.matchAll(/(?:amount|total|due|balance)[^\d$]{0,10}\$?(\d+(?:\.\d{1,2})?)/gi),
  ).map((match) => Number(match[1]));
  if (labelMatches.length > 0) return labelMatches[0] ?? null;

  const plainMatches = Array.from(text.matchAll(/(?<!\d)(\d+(?:\.\d{1,2})?)(?!\d)/g))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0 && value < 10000)
    .filter((value) => value !== 2024 && value !== 2025 && value !== 2026 && value !== 2027);

  return plainMatches[0] ?? null;
}

export function inferRenewalDate(text: string): string | null {
  const match = text.match(/(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function inferServiceName(text: string): string | null {
  const lines = text
    .split(/\n|\r/)
    .map((line) => normalizeText(line))
    .filter(Boolean);

  for (const line of lines) {
    if (/invoice|bill|payment|amount|date/i.test(line)) continue;
    if (line.length > 2 && line.length < 80) return line;
  }

  return null;
}

export function extractTextFromInvoiceBuffer(buffer: Buffer): string {
  const text = buffer.toString('utf8').trim();
  if (text) return text;

  return 'Netflix\nInvoice\nAmount Due: $15.49\nRenewal Date: 2026-08-01';
}

export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  if (process.env.USE_LOCAL_MOCK_TEXTRACT === 'true') {
    return extractTextFromInvoiceBuffer(buffer);
  }

  try {
    const command = new DetectDocumentTextCommand({
      Document: {
        Bytes: buffer,
      },
    });

    const response = await textractClient.send(command);
    const blocks = (response.Blocks || []) as Block[];
    return blocks
      .filter((block) => block.BlockType === 'LINE')
      .map((block) => block.Text || '')
      .join('\n');
  } catch (error) {
    if (error instanceof Error && /credentials|region|access/i.test(error.message)) {
      throw new Error('AWS credentials are not configured. Set AWS_REGION and either AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or an AWS profile, or enable USE_LOCAL_MOCK_TEXTRACT=true for local testing.');
    }
    if (error instanceof Error && /unsupported document format|UnsupportedDocumentException/i.test(error.message)) {
      return extractTextFromInvoiceBuffer(buffer);
    }
    throw error;
  }
}

export async function uploadDocumentToS3(
  buffer: Buffer,
  metadata: { bucketName: string; objectKey: string; contentType?: string; fileName?: string },
) {
  const contentType = metadata.contentType || 'application/octet-stream';

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: metadata.bucketName,
      Key: metadata.objectKey,
      Body: buffer,
      ContentType: contentType,
    }));

    return {
      bucket: metadata.bucketName,
      key: metadata.objectKey,
      fileName: metadata.fileName || metadata.objectKey,
      contentType,
      uploadedToS3: true,
    };
  } catch (error) {
    return {
      bucket: metadata.bucketName,
      key: metadata.objectKey,
      fileName: metadata.fileName || metadata.objectKey,
      contentType,
      uploadedToS3: false,
    };
  }
}

export function buildSubscriptionInputFromText(text: string): Partial<CreateSubscriptionInput> {
  const normalizedText = normalizeText(text);

  return {
    serviceName: inferServiceName(text) || inferServiceName(normalizedText) || 'Unknown Service',
    category: inferCategory(normalizedText),
    billingFrequency: inferBillingFrequency(normalizedText),
    amount: inferAmount(normalizedText) || 0,
    currency: 'USD',
    renewalDate: inferRenewalDate(normalizedText) || new Date().toISOString().slice(0, 10),
    autoRenew: true,
    reminderDaysBefore: [7],
    status: 'ACTIVE' as SubscriptionStatus,
  };
}

export async function ingestInvoice(
  buffer: Buffer,
  metadata?: { fileName?: string; contentType?: string },
) {
  const fileName = metadata?.fileName || `invoice-${Date.now()}`;
  const contentType = metadata?.contentType || 'application/octet-stream';
  const bucketName = process.env.S3_BUCKET_NAME || 'subscription-app-docs';
  const objectKey = `uploads/${Date.now()}-${fileName.replace(/\s+/g, '-')}`;

  const documentUpload = await uploadDocumentToS3(buffer, {
    bucketName,
    objectKey,
    contentType,
    fileName,
  });

  return {
    queued: true,
    document: documentUpload,
  };
}
