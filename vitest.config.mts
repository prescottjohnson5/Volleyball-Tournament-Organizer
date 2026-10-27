import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws when imported outside a React Server Component bundle; tests run in plain Node.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { STRIPE_SUPPRESS_NOTICES: "true" },
    // The PGlite database tests play whole tournaments through SQL. Under parallel load (and on
    // small CI runners) they can exceed the 5s default, which is a timing failure, not a bug.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
