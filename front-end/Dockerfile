# Build Stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Force API calls to route through the local reverse proxy
ENV VITE_API_URL=/api
RUN npm run build

# Serve Stage
FROM nginx:alpine
# Copy compiled static files
COPY --from=builder /app/dist /usr/share/nginx/html
# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Generate self-signed certificate during container compilation
RUN apk add --no-cache openssl && \
    mkdir -p /etc/ssl/private /etc/ssl/certs && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/nginx-selfsigned.key \
    -out /etc/ssl/certs/nginx-selfsigned.crt \
    -subj "/C=BR/ST=SP/L=SP/O=FeedAgent/CN=localhost"

EXPOSE 8080 443
CMD ["nginx", "-g", "daemon off;"]
