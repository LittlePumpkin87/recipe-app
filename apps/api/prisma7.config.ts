import "dotenv/config";
import { defineConfig } from "prisma/config";
import { join } from "node:path";
import { config } from "dotenv";

// The .env file lives in the repository root, two levels above apps/api
config({ path: join(__dirname, "..", "..", ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});