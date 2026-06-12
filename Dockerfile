## Stage 1: Build SPA
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

## Stage 2: nginx
FROM nginx:1.27-alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx template — envsubst runs at startup
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy built SPA
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom entrypoint that runs envsubst before nginx
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV BACKEND_HOST=backend

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
