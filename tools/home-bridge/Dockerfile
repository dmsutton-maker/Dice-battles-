FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY bin ./bin
COPY src ./src
ENV PORT=8787 BRIDGE_DATA=/data/tasks.json
VOLUME /data
EXPOSE 8787
USER node
CMD ["node", "bin/relay.mjs"]
