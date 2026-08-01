import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';

export function resolveEnvFile(startDir = process.cwd()): string | null {
  const candidates = [
    path.resolve(startDir, '.env'),
    path.resolve(startDir, '../.env'),
    path.resolve(startDir, '../../.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../.env'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

export function loadBackendEnv(startDir = process.cwd()): string | null {
  const envFile = resolveEnvFile(startDir);
  if (envFile) {
    config({ path: envFile });
    return envFile;
  }

  config();
  return null;
}
