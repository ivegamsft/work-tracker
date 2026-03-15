# syntax=docker/dockerfile:1.7
FROM node:20-bookworm-slim AS base
WORKDIR /workspace

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY data/package.json data/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate --schema=data/prisma/schema.prisma \
 && rm -f packages/shared/tsconfig.tsbuildinfo \
 && npm run build -w @e-clat/shared \
 && rm -rf node_modules/@e-clat/shared \
 && mkdir -p node_modules/@e-clat/shared \
 && cp packages/shared/package.json node_modules/@e-clat/shared/package.json \
 && cp -R packages/shared/dist node_modules/@e-clat/shared/dist \
 && npm run build -w @e-clat/api

FROM deps AS dev
COPY . .
ENV NODE_ENV=development
ENV PORT=3000
CMD ["npm", "run", "dev", "-w", "@e-clat/api"]

FROM node:20-bookworm-slim AS runtime
WORKDIR /workspace
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/package.json ./package.json
COPY --from=build /workspace/package-lock.json ./package-lock.json
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /workspace/packages/shared/dist ./packages/shared/dist
COPY --from=build /workspace/data/prisma ./data/prisma
EXPOSE 8080
CMD ["node", "apps/api/dist/index.js"]
