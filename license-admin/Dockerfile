# LICITANTE PRIME - License Admin
# Dockerfile para deploy no Easypanel

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci

# Copiar código fonte
COPY . .

# Build da aplicação
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

# Copiar configuração do nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar build
COPY --from=builder /app/build /usr/share/nginx/html

# Expor porta
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
