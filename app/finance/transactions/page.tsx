import { redirect } from "next/navigation"

export default function FinanceTransactionsPage() {
  redirect("/finance?tab=transactions")
}
