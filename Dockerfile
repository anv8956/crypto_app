# Production Dockerfile for Borderless Full-Stack Service
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/src/shared ./src/shared
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Install tsx globally for production typescript runner
RUN npm install -g tsx

EXPOSE 3000

CMD ["tsx", "server.ts"]
