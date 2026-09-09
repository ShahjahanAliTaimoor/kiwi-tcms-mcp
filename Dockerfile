# Kiwi TCMS MCP — HTTP transport, for hosting as a remote connector.
FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY src ./src

ENV MCP_HTTP_HOST=0.0.0.0
ENV MCP_HTTP_PORT=8787
EXPOSE 8787

# KIWI_URL, KIWI_USERNAME, KIWI_PASSWORD and MCP_AUTH_TOKEN must be provided at runtime.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/health || exit 1

CMD ["node", "src/http.js"]
