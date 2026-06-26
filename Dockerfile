# Generado por acmsy (Node)
FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "npm start"]
