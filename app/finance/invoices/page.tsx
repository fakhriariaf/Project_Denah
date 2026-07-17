import { redirect } from "next/navigation"

export default function FinanceInvoicesPage() {
  redirect("/finance?tab=invoices")
}
