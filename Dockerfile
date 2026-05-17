FROM node:22-alpine

# Dependencias nativas para better-sqlite3
RUN apk add --no-cache python3 make g++ gcc

WORKDIR /app

# Instalar dependencias primero (cache de capas)
COPY package*.json ./
RUN npm ci --include=dev

# Copiar código fuente
COPY . .

# Build de Next.js
RUN npm run build

# Limpiar devDependencies después del build
RUN npm prune --omit=dev && npm cache clean --force

EXPOSE 3000

CMD ["npm", "run", "start:all"]
