import { createApp } from "./app";

const port = 3444;

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error("PORT must be an integer between 0 and 65535");
}

const app = createApp();

app.listen(port, () => {
  console.log(`Express calculator listening on port ${port}`);
});
