FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 5000
ENV PORT=5000

CMD ["node", "server/index.js"]
