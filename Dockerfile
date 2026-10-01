FROM node:20-alpine

RUN corepack enable

WORKDIR /repo
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter api build

# Set after install/build so pnpm still installs devDependencies. The built
# image runs with production semantics: GraphiQL, Swagger (/docs*) and
# Apollo introspection are off (#91, #109). docker-compose.yml overrides
# this to `development` for the local stack.
ENV NODE_ENV=production

WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
