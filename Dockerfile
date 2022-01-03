FROM node:current-alpine3.14

RUN mkdir /app
WORKDIR /app

COPY LICENSE .
COPY README.md .
COPY package.json .
COPY build.txt .
COPY ./*.js ./
COPY views ./views
COPY public ./public

RUN npm config set @quote-of-the-day:registry=https://gitlab.com/api/v4/projects/32433382/packages/npm/
RUN npm install

EXPOSE 3000

CMD ["node", "--expose-gc", "app.js"]
