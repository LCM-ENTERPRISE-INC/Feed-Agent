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

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
