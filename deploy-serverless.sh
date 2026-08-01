#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Ensure the backend folder is the Serverless service root
export SLS_SERVICE_PATH="$PWD"

if [ -f .env ]; then
  set -a
  while IFS= read -r line; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    key="${line%%=*}"
    value="${line#*=}"
    export "$key=$value"
  done < .env
  set +a
fi

if ! command -v serverless >/dev/null 2>&1; then
  npm install -g serverless
fi

npm install
npm run build --workspace=shared
npm run build --workspace=backend
npx serverless deploy --stage dev
