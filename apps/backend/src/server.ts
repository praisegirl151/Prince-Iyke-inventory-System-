import "dotenv/config";
import { app } from "./app.js";
import { env } from "./config.js";
import { prisma } from "./db.js";

const server = app.listen(env.PORT, () =>
  console.log(`Backend listening on http://localhost:${env.PORT}`),
);
async function shutdown() {
  server.close();
  await prisma.$disconnect();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
