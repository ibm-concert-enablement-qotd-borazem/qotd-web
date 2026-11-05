FROM registry.access.redhat.com/ubi8/nodejs-18:1

USER root

RUN dnf update -y && dnf upgrade -y

USER 1001

WORKDIR /opt/app-root/src

COPY LICENSE .
COPY README.md .
COPY package.json .
COPY build.txt .
COPY ./*.js ./
COPY ./*.json ./
COPY views ./views
COPY public ./public

USER root
RUN chown -R 1001:0 /opt/app-root/src && chmod -R g+rwX /opt/app-root/src
USER 1001

RUN npm config set @quote-of-the-day:registry=https://gitlab.com/api/v4/projects/32433382/packages/npm/ && \
    npm install

EXPOSE 3000

CMD ["node", "--expose-gc", "app.js"]
