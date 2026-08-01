import type { S3Event, S3EventRecord } from 'aws-lambda';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  AnalyzeDocumentCommand,
  DetectDocumentTextCommand,
  TextractClient,
  type Block,
} from '@aws-sdk/client-textract';
import { auditInvoiceWithBedrock } from '../services/bedrockAuditor';
import { buildSubscriptionInputFromText, inferBillingFrequency, inferCategory } from '../services/invoiceService';
import { subscriptionService } from '../services/subscriptionService';
import type { CreateSubscriptionInput } from '../types/subscription';
import { loadBackendEnv } from '../utils/env';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const textractClient = new TextractClient({ region: process.env.AWS_REGION || 'us-east-1' });

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

function extractLines(blocks: Block[]): string {
  return blocks
    .filter((block) => block.BlockType === 'LINE' && block.Text)
    .map((block) => block.Text || '')
    .join('\n');
}

function extractFormFields(blocks: Block[]): Record<string, string> {
  const blockMap = new Map<string, Block>();
  const keyBlocks: Block[] = [];

  for (const block of blocks) {
    if (block.Id) blockMap.set(block.Id, block);
    if (block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes?.includes('KEY')) {
      keyBlocks.push(block);
    }
  }

  const getTextFromRelationships = (relationships?: Block['Relationships']) => {
    if (!relationships) return '';
    const childIds = relationships
      .filter((rel) => rel.Type === 'CHILD')
      .flatMap((rel) => rel.Ids || []);
    return childIds
      .map((id) => blockMap.get(id))
      .filter((b) => b && (b.BlockType === 'WORD' || b.BlockType === 'SELECTION_ELEMENT'))
      .map((b) => {
        if (!b) return '';
        if (b.BlockType === 'SELECTION_ELEMENT') return b.SelectionStatus === 'SELECTED' ? 'X' : '';
        return b.Text || '';
      })
      .filter(Boolean)
      .join(' ')
      .trim();
  };

  const formFields: Record<string, string> = {};

  for (const keyBlock of keyBlocks) {
    const keyText = getTextFromRelationships(keyBlock.Relationships);
    if (!keyText) continue;

    const valueRelationship = keyBlock.Relationships?.find((rel) => rel.Type === 'VALUE');
    const valueId = valueRelationship?.Ids?.[0];
    if (!valueId) continue;
    const valueBlock = blockMap.get(valueId);
    if (!valueBlock) continue;

    const valueText = getTextFromRelationships(valueBlock.Relationships);
    if (valueText) {
      formFields[keyText] = valueText;
    }
  }

  return formFields;
}

async function extractTextractData(bucket: string, key: string): Promise<{ forms: Record<string, string>; text: string }> {
  try {
    const formsResponse = await textractClient.send(
      new AnalyzeDocumentCommand({
        Document: {
          S3Object: {
            Bucket: bucket,
            Name: key,
          },
        },
        FeatureTypes: ['FORMS'],
      }),
    );

    const formBlocks = (formsResponse.Blocks || []) as Block[];
    const forms = extractFormFields(formBlocks);
    let text = extractLines(formBlocks);

    if (!text) {
      const textResponse = await textractClient.send(
        new DetectDocumentTextCommand({
          Document: {
            S3Object: {
              Bucket: bucket,
              Name: key,
            },
          },
        }),
      );
      text = extractLines((textResponse.Blocks || []) as Block[]);
    }

    return { forms, text };
  } catch (error) {
    if (error instanceof Error && /UnsupportedDocumentException|unsupported document format/i.test(error.message)) {
      console.warn('[textractProcessor] AnalyzeDocument FORMS unsupported, falling back to DetectDocumentText', {
        bucket,
        key,
      });

      const textResponse = await textractClient.send(
        new DetectDocumentTextCommand({
          Document: {
            S3Object: {
              Bucket: bucket,
              Name: key,
            },
          },
        }),
      );

      return {
        forms: {},
        text: extractLines((textResponse.Blocks || []) as Block[]),
      };
    }

    throw error;
  }
}

export async function processInvoiceFromS3(event: S3Event) {
  const processed: Array<{ bucket: string; key: string; created: boolean; invoiceTitle: string }> = [];

  for (const record of event.Records || []) {
    const { bucket, key } = getBucketAndKey(record);
    if (!key.startsWith('uploads/')) continue;

    await getDocumentBody(bucket, key);
    const textractData = await extractTextractData(bucket, key);
    console.info('[textractProcessor] Invoking Bedrock auditor', {
      bucket,
      key,
      extractedTextLength: textractData.text.length,
      formsFieldCount: Object.keys(textractData.forms).length,
    });

    const bedrockAudit = await auditInvoiceWithBedrock({
      extractedText: textractData.text,
      forms: textractData.forms,
    });
    console.info('[textractProcessor] Bedrock auditor completed', {
      bucket,
      key,
      invoiceTitle: bedrockAudit.title,
    });

    const inferred = buildSubscriptionInputFromText(textractData.text);
    const invoiceTitle = bedrockAudit.title || inferred.serviceName || 'Unknown Invoice';
    const upsertInput: CreateSubscriptionInput = {
      serviceName: invoiceTitle,
      invoiceTitle,
      category: inferred.category || inferCategory(`${invoiceTitle} ${textractData.text}`) || 'OTHER',
      billingFrequency: inferred.billingFrequency || inferBillingFrequency(textractData.text) || 'MONTHLY',
      amount: bedrockAudit.price > 0 ? bedrockAudit.price : inferred.amount && inferred.amount > 0 ? inferred.amount : 0,
      currency: bedrockAudit.currency || inferred.currency || 'USD',
      renewalDate: inferred.renewalDate || new Date().toISOString().slice(0, 10),
      autoRenew: inferred.autoRenew ?? true,
      reminderDaysBefore: inferred.reminderDaysBefore ?? [7],
      status: inferred.status || 'ACTIVE',
      notes: key,
      invoiceAudit: bedrockAudit,
    };

    const upsertResult = await subscriptionService.upsertByInvoiceTitle(upsertInput);
    processed.push({
      bucket,
      key,
      created: upsertResult.created,
      invoiceTitle: upsertResult.subscription.invoiceTitle || upsertResult.subscription.serviceName,
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
