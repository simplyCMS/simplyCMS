import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/loaders/index.ts", "src/seo/index.ts"],
  format: ["esm"],
  dts: { tsconfig: "./tsconfig.json" },
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: ["@simplysoftua/objects"],
});
