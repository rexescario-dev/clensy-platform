FROM node:20-alpine

RUN corepack enable

WORKDIR /repo
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter api build

WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
