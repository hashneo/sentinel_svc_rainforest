FROM mhart/alpine-node:6.2.1

COPY ./ /app

WORKDIR /app

RUN npm install
RUN npm install forever -g

EXPOSE 8080

ENTRYPOINT ["forever", "server.js"]