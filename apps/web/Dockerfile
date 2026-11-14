FROM node:22-alpine AS build
WORKDIR /src
RUN npm install -g pnpm@10.28.2
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web apps/web
COPY packages packages
RUN pnpm install --frozen-lockfile && pnpm build
WORKDIR /src/apps/web
EXPOSE 3000
CMD ["pnpm","start"]
