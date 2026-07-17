import { redirect } from "next/navigation"

export default function FinanceBudgetsPage() {
  redirect("/finance?tab=budgets")
}
