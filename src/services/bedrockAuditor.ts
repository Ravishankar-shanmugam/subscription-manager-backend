import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import type { InvoiceAudit } from '../types/subscription';

const region = process.env.AWS_REGION || 'us-east-1';
const bedrockClient = new BedrockRuntimeClient({ region });
const modelId = process.env.BEDROCK_MODEL_ID || 'amazon.nova-micro-v1:0';

interface BedrockAuditInput {
  extractedText: string;
  forms: Record<string, string>;
}

function inferPurchaseChannel(text: string): InvoiceAudit['purchaseChannel'] {
  const normalized = text.toLowerCase();
  if (normalized.includes('physical store') || normalized.includes('in store') || normalized.includes('retail')) {
    return 'PHYSICAL_STORE';
  }
  if (normalized.includes('online') || normalized.includes('website') || normalized.includes('web order') || normalized.includes('app')) {
    return 'ONLINE';
  }
  return null;
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function fallbackAudit(input: BedrockAuditInput): InvoiceAudit {
  const lines = input.extractedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const title =
    lines.find((line) => !/invoice|bill|statement|amount|total|tax|date/i.test(line)) ||
    lines[0] ||
    'Unknown Invoice';

  const amountMatch = input.extractedText.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  const taxMatch = input.extractedText.match(/tax(?:es)?[^\d]*(\d+(?:\.\d{1,2})?)/i);

  return {
    title,
    price: Number(amountMatch?.[1] || 0),
    currency: 'USD',
    cardUsed: null,
    taxes: taxMatch ? Number(taxMatch[1]) : null,
    invoiceDate: null,
    vendor: title,
    purchaseChannel: inferPurchaseChannel(input.extractedText),
    forms: input.forms,
    extractedText: input.extractedText,
  };
}

export async function auditInvoiceWithBedrock(input: BedrockAuditInput): Promise<InvoiceAudit> {
  const systemPrompt =
    'You are an invoice auditor. Extract a strict JSON object only. Do not include markdown or prose.';

  const userPrompt = JSON.stringify(
    {
      task: 'Analyze invoice data from Amazon Textract and return normalized JSON only.',
      requiredSchema: {
        title: 'string',
        price: 'number',
        currency: 'string',
        cardUsed: 'string|null',
        taxes: 'number|null',
        invoiceDate: 'string|null (YYYY-MM-DD if available)',
        vendor: 'string|null',
        purchaseChannel: 'ONLINE|PHYSICAL_STORE|null',
      },
      rules: [
        'title must identify the subscription/service invoice title',
        'price is the total price billed',
        'currency defaults to USD if not explicit',
        'use null when a field is not found',
      ],
      textractForms: input.forms,
      textractText: input.extractedText,
    },
    null,
    2,
  );

  try {
    const response = await bedrockClient.send(
      new ConverseCommand({
        modelId,
        system: [{ text: systemPrompt }],
        messages: [
          {
            role: 'user',
            content: [{ text: userPrompt }],
          },
        ],
        inferenceConfig: {
          temperature: 0,
          maxTokens: 500,
        },
      }),
    );

    const text =
      response.output?.message?.content
        ?.map((part) => ('text' in part ? part.text : ''))
        .join('')
        .trim() || '';

    const jsonText = extractJsonObject(text);
    if (!jsonText) return fallbackAudit(input);

    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : null;
    const price = toNumber(parsed.price);

    return {
      title: title || fallbackAudit(input).title,
      price: price ?? 0,
      currency: typeof parsed.currency === 'string' && parsed.currency.trim() ? parsed.currency.trim() : 'USD',
      cardUsed: typeof parsed.cardUsed === 'string' && parsed.cardUsed.trim() ? parsed.cardUsed.trim() : null,
      taxes: toNumber(parsed.taxes),
      invoiceDate:
        typeof parsed.invoiceDate === 'string' && parsed.invoiceDate.trim() ? parsed.invoiceDate.trim() : null,
      vendor: typeof parsed.vendor === 'string' && parsed.vendor.trim() ? parsed.vendor.trim() : null,
      purchaseChannel:
        parsed.purchaseChannel === 'ONLINE' || parsed.purchaseChannel === 'PHYSICAL_STORE'
          ? parsed.purchaseChannel
          : inferPurchaseChannel(input.extractedText),
      forms: input.forms,
      extractedText: input.extractedText,
    };
  } catch {
    return fallbackAudit(input);
  }
}
