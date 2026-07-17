import { redirect } from "next/navigation"

export default function FinancePaymentsPage() {
  redirect("/finance?tab=payments")
}
