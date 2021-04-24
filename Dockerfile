FROM node:11.15.0-alpine

RUN mkdir /app
WORKDIR /app

COPY app.js .
COPY LICENSE .
COPY package.json .
COPY views ./views
COPY public ./public

RUN npm install

EXPOSE 3000

CMD ["node", "app.js"]