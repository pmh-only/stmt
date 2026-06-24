FROM node:26-slim AS deps

WORKDIR /app
RUN npm install -g pnpm@10.13.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:26-slim AS build

WORKDIR /app
RUN npm install -g pnpm@10.13.1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:26-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=/data/stmt.db

RUN npm install -g pnpm@10.13.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=build /app/build ./build

VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "build"]
