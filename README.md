# Backend

Node.js + TypeScript backend for the subscription manager application.

## Prerequisites
- Node.js 22+
- npm 10+
- AWS credentials configured locally for S3/Textract/DynamoDB access

## Install dependencies
```bash
cd backend
npm install
```

## Run locally
```bash
npm run dev
```
The local API server runs on http://127.0.0.1:4000.

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
USE_LOCAL_MOCK_TEXTRACT=true
```

## GitHub Actions / AWS OIDC
For deployment from GitHub Actions, create these repository secrets:
- `AWS_ROLE_TO_ASSUME`: the ARN of the IAM role that GitHub Actions should assume
- `AWS_REGION`: the AWS region, typically `us-east-1`

The workflow uses the GitHub OIDC provider and does not require long-lived AWS access keys.

## Main endpoints
- `GET /subscriptions`
- `POST /subscriptions`
- `GET /subscriptions/:id`
- `PUT /subscriptions/:id`
- `DELETE /subscriptions/:id`
- `GET /dashboard`
- `GET /reports`
- `GET /reminders`
- `POST /invoices/upload`
