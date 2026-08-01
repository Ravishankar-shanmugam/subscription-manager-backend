/**
 * Local development Express server — wraps Lambda handlers to simulate API Gateway.
 * Not used in production (Lambda handles that).
 */
import express from 'express';
import { loadBackendEnv } from './utils/env';
import cors from 'cors';
import multer from 'multer';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import {
  listSubscriptions,
  getSubscription,
  createSubscription,
  updateSubscription,
  deleteSubscription,
} from './handlers/subscriptions';
import { getDashboard, getReports, getReminders } from './handlers/dashboard';
import { uploadInvoice } from './handlers/invoices';

loadBackendEnv(__dirname);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || '127.0.0.1';

function makeEvent(
  req: express.Request,
  resource: string,
  pathParameters: Record<string, string> | null = null,
): APIGatewayProxyEvent {
  return {
    httpMethod: req.method,
    resource,
    path: req.path,
    pathParameters,
    queryStringParameters: req.query as Record<string, string>,
    headers: req.headers as Record<string, string>,
    body: req.body ? JSON.stringify(req.body) : null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    isBase64Encoded: false,
    stageVariables: null,
    requestContext: {} as never,
  };
}

async function handle(
  res: express.Response,
  fn: () => Promise<import('aws-lambda').APIGatewayProxyResult>,
) {
  const result = await fn();
  const headers = result.headers as Record<string, string> | undefined;
  res.status(result.statusCode).set(headers || {});
  if (result.body) res.send(JSON.parse(result.body));
  else res.send();
}

app.get('/subscriptions', (req, res) =>
  handle(res, () => listSubscriptions(makeEvent(req, '/subscriptions'))),
);
app.post('/subscriptions', (req, res) =>
  handle(res, () => createSubscription(makeEvent(req, '/subscriptions'))),
);
app.get('/subscriptions/:id', (req, res) =>
  handle(res, () =>
    getSubscription(makeEvent(req, '/subscriptions/{id}', { id: req.params.id })),
  ),
);
app.put('/subscriptions/:id', (req, res) =>
  handle(res, () =>
    updateSubscription(makeEvent(req, '/subscriptions/{id}', { id: req.params.id })),
  ),
);
app.delete('/subscriptions/:id', (req, res) =>
  handle(res, () =>
    deleteSubscription(makeEvent(req, '/subscriptions/{id}', { id: req.params.id })),
  ),
);
app.get('/dashboard', (_req, res) => handle(res, () => getDashboard()));
app.get('/reports', (_req, res) => handle(res, () => getReports()));
app.get('/reminders', (_req, res) => handle(res, () => getReminders()));
app.post('/invoices/upload', upload.single('file'), (req, res) =>
  handle(res, () =>
    uploadInvoice({
      ...makeEvent(req, '/invoices/upload'),
      headers: {
        ...(req.headers as Record<string, string>),
        'Content-Type': 'application/json',
      },
      body: req.file
        ? JSON.stringify({
            file: req.file.buffer.toString('base64'),
            filename: req.file.originalname,
            contentType: req.file.mimetype,
          })
        : makeEvent(req, '/invoices/upload').body,
    }),
  ),
);

app.listen(PORT, HOST, () => {
  console.log(`✅ Backend dev server running at http://${HOST}:${PORT}`);
});
