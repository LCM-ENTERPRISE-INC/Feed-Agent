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
ARG NGINX_CONF=nginx.http.conf
# Copy compiled static files
COPY --from=builder /app/dist /usr/share/nginx/html
# HTTP bootstrap (default) or HTTPS after DNS — selected at build time
COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf

EXPOSE 80 8080 443
CMD ["nginx", "-g", "daemon off;"]
