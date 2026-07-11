import type { StorybookConfig } from "@storybook/nextjs-vite";
import { mergeConfig, type UserConfig } from "vite";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  staticDirs: ["../public"],
  viteFinal: async (baseConfig) =>
    mergeConfig(baseConfig, {
      build: {
        // Storybook bundles its own Docs, iframe runtime, and axe-core into the
        // preview build. Those chunks are review tooling only, not ERP runtime.
        chunkSizeWarningLimit: 1300,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes("node_modules")) {
                return undefined;
              }

              const normalizedId = id.replace(/\\/g, "/");
              const packageMatch = normalizedId.match(
                /node_modules\/((?:@[^/]+\/)?[^/]+)/
              );
              const packageName = packageMatch?.[1]?.replace(/[@/]/g, "-");

              if (id.includes("axe-core")) {
                return "vendor-axe-core";
              }

              if (id.includes("@storybook")) {
                return `vendor-${packageName}`;
              }

              if (id.includes("@base-ui")) {
                return "vendor-base-ui";
              }

              if (id.includes("lucide-react")) {
                return "vendor-icons";
              }

              if (id.includes("next")) {
                return "vendor-next";
              }

              if (id.includes("react") || id.includes("react-dom")) {
                return "vendor-react";
              }

              return undefined;
            },
          },
        },
      },
    } satisfies UserConfig),
};

export default config;
