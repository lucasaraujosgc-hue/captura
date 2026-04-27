FROM node:22-alpine

WORKDIR /app

# Copia os arquivos de dependência primeiro para aproveitar cache do Docker
COPY package.json package-lock.json* ./

# Instala as dependências
RUN npm install

# Copia o resto dos arquivos do projeto
COPY . .

# Faz o build do React pelo Vite (gera a pasta dist/)
RUN npm run build

# Expõe a porta que o servidor Node escuta
EXPOSE 3000

# Script para rodar em produção
CMD ["npm", "start"]
