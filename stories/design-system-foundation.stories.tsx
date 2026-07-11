import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { denahDesignTokens, unitStatusColorMap } from "@/lib/design-system";

const meta = {
  title: "Design System/Foundation",
  parameters: {
    layout: "padded",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SageTokens: Story = {
  render: () => (
    <div className="max-w-5xl space-y-8" style={{ color: denahDesignTokens.color.textPrimary }}>
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: denahDesignTokens.color.primaryDark }}>
          Denah Property Design System
        </p>
        <h1 className="mt-2 text-page-title">Sage Green Foundation</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: denahDesignTokens.color.textSecondary }}>
          Token ini menjadi sumber review visual untuk komponen ERP, status unit,
          form, dashboard, dan login screen.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(denahDesignTokens.color).map(([name, value]) => (
          <div key={name} className="rounded-xl bg-white p-3" style={{ borderWidth: 1, borderColor: denahDesignTokens.color.border, boxShadow: denahDesignTokens.shadow.sage }}>
            <div className="h-16 rounded-lg border border-black/5" style={{ backgroundColor: value }} />
            <p className="mt-3 text-sm font-semibold capitalize">{name.replace(/([A-Z])/g, " $1")}</p>
            <p className="font-mono text-xs" style={{ color: denahDesignTokens.color.textSecondary }}>{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl bg-white p-5" style={{ borderWidth: 1, borderColor: denahDesignTokens.color.border, boxShadow: denahDesignTokens.shadow.sage }}>
        <h2 className="text-section-title">Typography ERP</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-page-title">Page title 24/600</p>
            <p className="text-section-title">Section title 18/600</p>
            <p className="text-card-title">Card title 16/600</p>
            <p className="text-body" style={{ color: denahDesignTokens.color.textSecondary }}>Body text 14/400 untuk interface harian.</p>
          </div>
          <div className="font-mono text-[13px] tabular-nums">
            <p>UNIT-A12-008</p>
            <p>INV-2026-05-0019</p>
            <p>BOOK-2026-00045</p>
            <p>Rp 875.000.000</p>
          </div>
        </div>
      </section>
    </div>
  ),
};

export const UnitStatus: Story = {
  render: () => (
    <div className="max-w-4xl rounded-xl bg-white p-5" style={{ borderWidth: 1, borderColor: denahDesignTokens.color.border, boxShadow: denahDesignTokens.shadow.sage }}>
      <h2 className="text-section-title" style={{ color: denahDesignTokens.color.textPrimary }}>Status Unit ERP</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(unitStatusColorMap).map(([status, item]) => (
          <div key={status} className="rounded-lg p-3" style={{ borderWidth: 1, borderColor: denahDesignTokens.color.border }}>
            <span
              className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ backgroundColor: item.bg, color: item.text }}
            >
              {item.label}
            </span>
            <p className="mt-2 font-mono text-xs" style={{ color: denahDesignTokens.color.textSecondary }}>{status}</p>
          </div>
        ))}
      </div>
    </div>
  ),
};
