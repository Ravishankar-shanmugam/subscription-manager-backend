# Backend

Node.js + TypeScript backend for the subscription manager application.

## What it does

The backend exposes the full API for the app and handles the invoice processing pipeline end to end.

### Main backend features

- Subscription CRUD API:
  - create a subscription
  - list subscriptions with pagination, search, category/status filters, and sorting
  - view subscription details
  - update subscriptions
  - archive subscriptions
  - delete subscriptions
- Dashboard API for summary metrics:
  - total subscriptions
  - active subscriptions
  - monthly spending
  - yearly spending
  - upcoming renewals
- Reports API:
  - spending by category
  - monthly and yearly totals
  - upcoming renewal summaries
- Reminders API:
  - returns subscriptions that are due for reminders
- Invoice upload API:
  - receives invoice files from the frontend
  - stores the uploaded file in S3
  - triggers an S3 event processor
- Invoice processing pipeline:
  - Textract extracts text and forms from uploaded invoices
  - Bedrock audits the Textract output and normalizes it into structured JSON
  - the resulting record is stored in DynamoDB
- Deduplication and upsert behavior:
  - invoice title is used as the unique identifier for DynamoDB records
  - repeated uploads for the same title update the existing record instead of creating duplicates
- Local development support:
  - local API server for development
  - mock Textract mode for offline testing
- AWS deployment support:
  - Lambda functions
  - API Gateway
  - S3 notifications
  - DynamoDB
  - CloudWatch logging

## Technology stack

- Node.js 22+
- TypeScript
- AWS SDK v3
- AWS Lambda
- Amazon API Gateway
- Amazon S3
- Amazon Textract
- Amazon Bedrock
- Amazon DynamoDB

## Prerequisites

- Node.js 22+
- npm 10+
- AWS credentials configured locally for S3, Textract, Bedrock, and DynamoDB access

## Install dependencies

```bash
cd backend
npm install
```

## Run locally

```bash
npm run dev
```

The local API server runs on `http://127.0.0.1:4000`.

## Build

```bash
npm run build
```

## Test

```bash
npm test -- --runInBand
```

## Environment variables

The backend reads values from `.env` in the backend folder. Example:

```env
PORT=4000
HOST=127.0.0.1
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET_NAME=subscription-app-docs
DYNAMODB_TABLE_NAME=subscription-manager-dev
BEDROCK_MODEL_ID=amazon.nova-micro-v1:0
USE_LOCAL_MOCK_TEXTRACT=true
```

## API endpoints

### Subscriptions

- `GET /subscriptions`
- `POST /subscriptions`
- `GET /subscriptions/:id`
- `PUT /subscriptions/:id`
- `DELETE /subscriptions/:id`

### Dashboard and reports

- `GET /dashboard`
- `GET /reports`
- `GET /reminders`

### Invoice processing

- `POST /invoices/upload`

## Invoice processing flow

1. The frontend uploads an invoice file to `POST /invoices/upload`.
2. The backend stores the file in S3 under the `uploads/` prefix.
3. S3 emits an object-created event for the uploaded file.
4. The `processInvoice` Lambda reads the file from S3.
5. Textract extracts both forms and text from the invoice.
6. Bedrock audits the extracted content and returns structured invoice data.
7. The backend normalizes the result and writes it to DynamoDB.
8. If the same invoice title appears again, the existing DynamoDB record is updated.

## Data model summary

The stored record includes:

- invoice title
- service name
- amount
- currency
- tax details
- card used
- invoice date
- renewal date
- reminders
- notes
- raw Textract/Bedrock audit payload

## AWS deployment

The project is deployed through GitHub Actions to AWS.

Notes:

- The Lambda runtime is `nodejs22.x`
- Bedrock access is granted through the Lambda execution role
- API Gateway and IAM updates are handled by the GitHub Actions deploy role

## Useful scripts

- `npm run dev` - start the local server
- `npm run build` - compile TypeScript
- `npm test` - run unit tests
- `npm run lint` - run ESLint
- `npm run type-check` - run TypeScript type-check only
