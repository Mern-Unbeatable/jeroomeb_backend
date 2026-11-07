const http = require("http");
const env = require("./config/env");
const { createApp } = require("./app");
const { attachSocket } = require("./shared/socket");

const app = createApp();
const server = http.createServer(app);
attachSocket(server);

server.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`);
});
