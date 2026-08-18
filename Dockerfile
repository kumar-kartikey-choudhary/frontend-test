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
COPY --from=build /app/dist/pratik-dairy-frontend ./dist/pratik-dairy-frontend
EXPOSE 4000
CMD ["node", "dist/pratik-dairy-frontend/server/server.mjs"]
