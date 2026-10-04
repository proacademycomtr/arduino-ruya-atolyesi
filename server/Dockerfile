# Arduino Rüya Atölyesi API — üretim imajı
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-fund --no-audit

COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000
CMD ["node", "src/index.js"]