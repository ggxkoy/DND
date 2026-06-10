import { PORT } from "./src/config.mjs";
import { initStore } from "./src/store.mjs";
import { createApp } from "./src/routes.mjs";

await initStore();

const app = createApp();

app.listen(PORT, () => {
  console.log(`Dragons & Dungeons is listening on http://localhost:${PORT}`);
});
