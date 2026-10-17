# syntax=docker/dockerfile:1
FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi && npm install --global pnpm@12.11.2
COPY --chown=node:node . .
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi && pnpm install --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
ENV RAYON_NUM_THREADS=2
RUN pnpm build
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi && pnpm --filter @challenge/worker deploy --legacy --prod /runtime/worker

FROM node:24.19.0-bookworm-slim AS web
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM node:24.19.0-bookworm-slim AS worker
WORKDIR /app
COPY --from=build --chown=node:node /runtime/worker ./
ENV NODE_ENV=production
ENV WORKER_HOST=0.0.0.0
ENV WORKER_PORT=3001
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]

FROM build AS maintenance
ENV NODE_ENV=production
USER node
CMD ["node", "--import", "tsx", "scripts/maintenance-scheduler.mjs"]

FROM build AS operator
ENV NODE_ENV=production
USER node
ENTRYPOINT ["node", "scripts/deploy-database.mjs"]
