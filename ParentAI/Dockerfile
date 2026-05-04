FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

RUN npm install --production

COPY server.js ./

EXPOSE 3001

CMD ["node", "server.js"]
