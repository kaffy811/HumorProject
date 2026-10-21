import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    // Local screenshots, QA bundles and private acceptance exports.
    "deliverables/**",
    "next-env.d.ts",
    // Separate admin app with its own lint config.
    "admin/**",
  ]),
]);

export default eslintConfig;
