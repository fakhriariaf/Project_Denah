import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import LoginPage from "@/app/(auth)/login/page";
import { LoginBranding } from "@/app/(auth)/login/_components/login-branding";

const meta = {
  title: "Auth/Login Page",
  component: LoginPage,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof LoginPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DesktopBaseline: Story = {};

/** Branding panel in isolation — easier to iterate on marketing copy/stats. */
export const BrandingOnly: StoryObj = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="hidden max-w-3xl lg:block">
      <LoginBranding />
    </div>
  ),
};
