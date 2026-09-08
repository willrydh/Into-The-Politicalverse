import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  { files: ["workers/insights/src/dashboard.js"], rules: { "@next/next/no-location-assign-relative-destination": "off" } },
  globalIgnores([".next/**", "**/.wrangler/**", "dist/**", "data/normalized/**", "next-env.d.ts", "workers/*/worker-configuration.d.ts"]),
]);
