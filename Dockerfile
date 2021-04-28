FROM node:11.15.0-alpine

RUN mkdir /app
WORKDIR /app

COPY LICENSE .
COPY README.md .
COPY package.json .
COPY build.txt .
COPY ./*.js ./
COPY views ./views
COPY public ./public
COPY data ./data

RUN npm install

EXPOSE 3000 8080

CMD ["node", "app.js"]