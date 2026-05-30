import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/objects/index.ts", "src/ports/index.ts"],
  format: ["esm"],
  dts: { tsconfig: "./tsconfig.json" },
  sourcemap: true,
  clean: true,
  treeshake: true,
});
