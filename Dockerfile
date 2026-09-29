FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run lint -- --max-warnings=0 && npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=5000
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node server.js ./
COPY --chown=node:node config/ ./config/
COPY --chown=node:node controllers/ ./controllers/
COPY --chown=node:node middleware/ ./middleware/
COPY --chown=node:node models/ ./models/
COPY --chown=node:node routes/ ./routes/
COPY --chown=node:node services/ ./services/
COPY --chown=node:node scripts/ ./scripts/
COPY --from=frontend --chown=node:node /build/dist ./frontend/dist
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:5000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
