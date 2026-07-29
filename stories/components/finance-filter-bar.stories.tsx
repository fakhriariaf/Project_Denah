import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { FinanceFilterBar } from "@/components/finance/finance-filter-bar";

/**
 * FinanceFilterBar is the shared filter row for the Finance module: a project
 * dropdown ("Semua Perumahan" + list), a period filter with presets and custom
 * range, and a debounced search input. Active filters surface as removable
 * chips. It only manages filter state — date-field logic lives in each tab.
 *
 * Responsive: wraps on tablet/desktop, stacks to a single column on mobile.
 *
 * Design / requirements: 1.3, 16.1, 16.2.
 */
const SAMPLE_PROJECTS = [
  { id: "p1", name: "Graha Mulia" },
  { id: "p2", name: "Bukit Asri Residence" },
  { id: "p3", name: "Taman Sari Estate" },
];

/**
 * Stateful wrapper so the controlled FinanceFilterBar is interactive inside
 * Storybook. Mirrors how FinanceShell owns the filter state.
 */
function FilterBarHarness({
  initialProjectId = null,
  initialStart = null,
  initialEnd = null,
  initialSearch = "",
}: {
  initialProjectId?: string | null;
  initialStart?: Date | null;
  initialEnd?: Date | null;
  initialSearch?: string;
}) {
  const [projectId, setProjectId] = React.useState<string | null>(initialProjectId);
  const [start, setStart] = React.useState<Date | null>(initialStart);
  const [end, setEnd] = React.useState<Date | null>(initialEnd);
  const [search, setSearch] = React.useState(initialSearch);

  return (
    <div className="w-full max-w-4xl">
      <FinanceFilterBar
        projects={SAMPLE_PROJECTS}
        selectedProjectId={projectId}
        onProjectChange={setProjectId}
        periodStart={start}
        periodEnd={end}
        onPeriodChange={(s, e) => {
          setStart(s);
          setEnd(e);
        }}
        searchQuery={search}
        onSearchChange={setSearch}
      />
    </div>
  );
}

const meta = {
  title: "Finance/FinanceFilterBar",
  component: FinanceFilterBar,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Shared finance filter bar: project dropdown, period presets + custom range, debounced search, and " +
          "removable active-filter chips. Responsive wrap/stack. Sage Green tokens, light theme only.",
      },
    },
  },
  // Each story overrides everything via `render` with a stateful harness;
  // these satisfy the component's required props for the meta type.
  args: {
    projects: SAMPLE_PROJECTS,
    selectedProjectId: null,
    onProjectChange: () => {},
    periodStart: null,
    periodEnd: null,
    onPeriodChange: () => {},
    searchQuery: "",
    onSearchChange: () => {},
  },
} satisfies Meta<typeof FinanceFilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default state: no filters applied ("Semua Perumahan", "Semua Periode"). */
export const Default: Story = {
  render: () => <FilterBarHarness />,
};

/** Active filters showing project and period chips. */
export const WithActiveFilters: Story = {
  render: () => (
    <FilterBarHarness
      initialProjectId="p1"
      initialStart={new Date(2026, 0, 1)}
      initialEnd={new Date(2026, 11, 31)}
      initialSearch="INV-BF"
    />
  ),
};

/** Project selected only — a single active chip. */
export const ProjectSelected: Story = {
  render: () => <FilterBarHarness initialProjectId="p2" />,
};
