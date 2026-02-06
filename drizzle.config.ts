import { defineConfig } from "drizzle-kit";
import { join } from "path";
import { homedir } from "os";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: join(homedir(), ".aion", "aion.db"),
  },
});
