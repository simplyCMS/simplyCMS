import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/queries.ts"],
  format: ["esm"],
  dts: { tsconfig: "./tsconfig.json" },
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: ["@simplycms/objects"],
});
