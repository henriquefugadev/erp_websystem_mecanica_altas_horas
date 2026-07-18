import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // Testes de integração sobem um Postgres (pglite) e aplicam a migração
    // inteira — mais lentos que os unitários, então rodam em série por
    // arquivo para não competir por CPU/memória com múltiplas instâncias.
    fileParallelism: false,
    // pglite é um binário WASM; roda mais estável em processo filho (forks)
    // do que em worker_threads.
    pool: "forks",
  },
});
