import path from "node:path";
import express from "express";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

app.use("/vendor/three", express.static(path.join(ROOT_DIR, "node_modules", "three")));
app.use(express.static(PUBLIC_DIR));

app.use((req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Messenger clone is listening on http://localhost:${PORT}`);
});
