FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_URL
ARG VITE_FINANCIAL_ACCESS_CODE

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_FINANCIAL_ACCESS_CODE=$VITE_FINANCIAL_ACCESS_CODE

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Serve avec nginx ----
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
