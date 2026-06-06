import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/pricing.ts",
    "src/discounts.ts",
    "src/inventory.ts",
    "src/shipping.ts",
  ],
  format: ["esm"],
  dts: { tsconfig: "./tsconfig.json" },
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: ["@simplycms/objects"],
});
