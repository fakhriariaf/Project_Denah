import type { Preview } from "@storybook/nextjs-vite";
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "Sage Linen",
      values: [
        { name: "Sage Linen", value: "#F7F8F3" },
        { name: "Surface", value: "#FFFFFF" },
        { name: "Deep Sage", value: "#4F6F52" },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "todo",
    },
    layout: "centered",
  },
  decorators: [(Story) => <Story />],
};

export default preview;
