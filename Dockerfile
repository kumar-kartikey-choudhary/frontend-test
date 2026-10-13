# ---- build stage -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:prod

# ---- runtime stage ---------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=4000

# Host names this server will render pages for (comma separated). Anything else is refused, which keeps a
# forged Host header from steering the server. Set it to your real domain(s) when you run the container:
#   docker run -e NG_ALLOWED_HOSTS=www.pratikdairy.com,pratikdairy.com ...
ENV NG_ALLOWED_HOSTS=localhost,www.pratikdairy.com,pratikdairy.com
# Where the browser may call the API (used in the Content-Security-Policy). Defaults to the API in environment.ts.
# ENV API_ORIGIN=https://api.pratikdairy.com

COPY --from=build --chown=node:node /app/dist/pratik-dairy-frontend ./dist/pratik-dairy-frontend

# Do not run as root.
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/robots.txt >/dev/null || exit 1
CMD ["node", "dist/pratik-dairy-frontend/server/server.mjs"]
