# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev=false
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV TZ=Europe/Paris
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 5000
ENV PORT=5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://localhost:5000/api/health || exit 1
CMD ["node", "dist/index.js"]


