#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="vitoria-lund"
SERVICE_NAME="dex-crm-mcp"
REGION="us-central1"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "Building container image..."
gcloud builds submit --tag "${IMAGE}" --project "${PROJECT_ID}"

echo "Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 256Mi \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "MCP_TRANSPORT=http"

# Get the service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format "value(status.url)")

echo ""
echo "Deployed successfully!"
echo "Service URL: ${SERVICE_URL}"
echo ""
echo "Set PUBLIC_URL so OAuth metadata returns the correct URLs:"
echo "  gcloud run services update ${SERVICE_NAME} \\"
echo "    --project ${PROJECT_ID} --region ${REGION} \\"
echo "    --set-env-vars \"PUBLIC_URL=${SERVICE_URL}\""
echo ""
echo "MCP endpoint: ${SERVICE_URL}/mcp"
echo "OAuth metadata: ${SERVICE_URL}/.well-known/oauth-authorization-server"
