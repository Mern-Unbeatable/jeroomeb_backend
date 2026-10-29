const env = require("./config/env");
const { createApp } = require("./app");

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`);
});
