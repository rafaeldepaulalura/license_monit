# LICITANTE PRIME - License Server
# Dockerfile para deploy no Easypanel

FROM node:18-alpine

# Criar diretório da aplicação
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências de produção
RUN npm ci --only=production

# Copiar código fonte
COPY src ./src

# Expor porta
EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Comando para iniciar
CMD ["node", "src/server.js"]
