FROM node:24.18.0-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@12.9.1
COPY . .
RUN pnpm install --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM build AS web
ENV NODE_ENV=production
ENV PORT=3000
USER node
EXPOSE 3000
CMD ["pnpm", "start:web"]

FROM build AS worker
ENV NODE_ENV=production
ENV WORKER_HOST=0.0.0.0
ENV WORKER_PORT=3001
USER node
EXPOSE 3001
CMD ["pnpm", "start:worker"]
