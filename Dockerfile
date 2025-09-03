FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
RUN chmod +x ./docker-entrypoint.sh
EXPOSE 8080
CMD ["./docker-entrypoint.sh"]
