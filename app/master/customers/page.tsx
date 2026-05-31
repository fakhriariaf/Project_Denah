import { db } from "@/db"
import { customers, units } from "@/db/schema/master"
import { bookings } from "@/db/schema/marketing"
import { requireAuth, getSessionRole } from "@/server/permissions"
import { redirect } from "next/navigation"
import { CustomersShell } from "./customers-shell"
import { eq, ne, and } from "drizzle-orm"

export default async function CustomersPage() {
  const activeUser = await requireAuth()
  const {
    isSuperAdmin,
    isAdminKantor,
    isMarketing,
    isMarketingManager,
    isKeuangan,
    isDireksi,
  } = await getSessionRole(activeUser.id)

  // All authenticated users with these roles can access the customers page
  const hasAccess = isSuperAdmin || isAdminKantor || isMarketing || isKeuangan || isDireksi
  if (!hasAccess) {
    redirect("/unauthorized")
  }

  // canEdit: Can add and edit customer records
  // Marketing and Marketing Manager CAN create/edit customer (they deal with prospects)
  const canEdit = isSuperAdmin || isAdminKantor || isMarketing || isMarketingManager

  // canDelete: ONLY Super Admin & Admin Kantor can delete customers
  const canDelete = isSuperAdmin || isAdminKantor

  const customersData = await db.select().from(customers).orderBy(customers.createdAt)

  // Fetch bookings that are not cancelled to identify linked units
  const bookingsData = await db
    .select({
      customerId: bookings.customerId,
      unitCode: units.code,
    })
    .from(bookings)
    .innerJoin(units, eq(bookings.unitId, units.id))
    .where(ne(bookings.status, "cancelled"))

  const data = customersData.map((c) => {
    const linkedUnits = bookingsData
      .filter((b) => b.customerId === c.id)
      .map((b) => b.unitCode)

    return {
      ...c,
      unitCode: linkedUnits.length > 0 ? linkedUnits.join(", ") : null,
    }
  })

  return (
    <CustomersShell
      initialCustomers={data}
      isEditor={canEdit}
      canDelete={canDelete}
    />
  )
}
