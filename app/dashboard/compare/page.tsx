import { requireAnyRole } from "@/server/permissions";
import { getProjectsList } from "@/server/actions/compare";
import { CompareShell } from "./compare-shell";

export const metadata = {
  title: "Perbandingan Proyek — Denah Property ERP",
};

export default async function ComparePage() {
  await requireAnyRole(["Super Admin", "Admin Kantor", "Direksi / Manager"]);

  const projectsList = await getProjectsList();

  return <CompareShell projects={projectsList} />;
}
