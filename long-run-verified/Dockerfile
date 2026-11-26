FROM node:24-bookworm-slim
WORKDIR /app/long-run-verified
COPY long-run-verified/package.json long-run-verified/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
WORKDIR /app
COPY long-run-verified/controller.js long-run-verified/server.js long-run-verified/composio.js ./long-run-verified/
COPY persistd/src/storage/drive-auth.js persistd/src/storage/drive-client.js ./persistd/src/storage/
USER node
ENV PORT=3000 LRV_BIND_HOST=0.0.0.0
EXPOSE 3000
CMD ["node","long-run-verified/server.js"]
