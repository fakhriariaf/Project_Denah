import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Mail, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { denahDesignTokens } from "@/lib/design-system";

const meta = {
  title: "Design System/Components",
  parameters: {
    layout: "padded",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const CoreComponents: Story = {
  render: () => (
    <div className="grid max-w-5xl gap-5 lg:grid-cols-2" style={{ color: denahDesignTokens.color.textPrimary }}>
      <Card className="shadow-sage" style={{ borderColor: denahDesignTokens.color.border }}>
        <CardHeader>
          <CardTitle>Action Controls</CardTitle>
          <CardDescription>Button, badge, input, dan checkbox dasar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button style={{ backgroundColor: denahDesignTokens.color.primaryDark }}>
              <Plus />
              Tambah Unit
            </Button>
            <Button variant="outline">
              <Search />
              Cari Data
            </Button>
            <Button variant="secondary">Filter Status</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge>Tersedia</Badge>
            <Badge variant="secondary">Booking</Badge>
            <Badge variant="outline">KPR</Badge>
            <Badge variant="destructive">Overdue</Badge>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: denahDesignTokens.color.textPrimary }}>Email Karyawan</span>
            <div className="relative max-w-sm">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: denahDesignTokens.color.textSecondary }} />
              <Input className="h-10 pl-9" style={{ borderColor: denahDesignTokens.color.border }} placeholder="admin@denahproperty.com" />
            </div>
          </label>

          <label className="flex w-fit items-center gap-2 text-sm font-medium" style={{ color: denahDesignTokens.color.textSecondary }}>
            <Checkbox defaultChecked />
            Ingat pilihan saya
          </label>
        </CardContent>
      </Card>

      <Card className="shadow-sage" style={{ borderColor: denahDesignTokens.color.border }}>
        <CardHeader>
          <CardTitle>ERP Panel States</CardTitle>
          <CardDescription>Tabs dan skeleton untuk loading dashboard/list.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="finance" className="w-full">
            <TabsList>
              <TabsTrigger value="finance">Keuangan</TabsTrigger>
              <TabsTrigger value="marketing">Marketing</TabsTrigger>
              <TabsTrigger value="production">Produksi</TabsTrigger>
            </TabsList>
            <TabsContent value="finance" className="mt-4 space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </TabsContent>
            <TabsContent value="marketing" className="mt-4 text-sm" style={{ color: denahDesignTokens.color.textSecondary }}>
              Pipeline KPR dan booking memakai tab untuk workflow bertahap.
            </TabsContent>
            <TabsContent value="production" className="mt-4 text-sm" style={{ color: denahDesignTokens.color.textSecondary }}>
              Progress konstruksi memakai badge, progress bar, dan foto lapangan.
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  ),
};
