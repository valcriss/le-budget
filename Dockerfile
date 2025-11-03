FROM node:24-slim AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npm run prisma:generate
RUN npm run build

FROM node:24-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY --from=backend-builder /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=frontend-builder /app/frontend/dist/le-budget/browser ./dist/public
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
