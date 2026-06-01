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

  // Fetch bookings that are not cancelled to identify linked units and determine dynamic status
  const bookingsData = await db
    .select({
      customerId: bookings.customerId,
      unitCode: units.code,
      bookingStatus: bookings.status,
      paymentScheme: bookings.paymentScheme,
      unitStatus: units.status,
    })
    .from(bookings)
    .innerJoin(units, eq(bookings.unitId, units.id))
    .where(ne(bookings.status, "cancelled"))

  const data = customersData.map((c) => {
    const customerBookings = bookingsData.filter((b) => b.customerId === c.id)
    const linkedUnits = customerBookings.map((b) => b.unitCode)

    // Calculate dynamic integrated status based on active bookings and unit status
    let integratedStatus: string = c.status;
    if (customerBookings.length > 0) {
      const hasUnderConstruction = customerBookings.some(
        (b) => b.unitStatus === "construction" || b.unitStatus === "overdue"
      );
      const hasCompleted = customerBookings.some(
        (b) =>
          b.bookingStatus === "completed" ||
          b.unitStatus === "sold" ||
          b.unitStatus === "construction_done" ||
          b.unitStatus === "menunggu_serah_terima" ||
          b.unitStatus === "handover_complete"
      );
      const hasAkad = customerBookings.some((b) => b.bookingStatus === "akad");
      const hasKprProcess = customerBookings.some((b) => b.paymentScheme === "kpr" && b.unitStatus === "kpr_process");
      const hasActive = customerBookings.some((b) => b.bookingStatus === "active");

      if (hasUnderConstruction) {
        integratedStatus = "under_constructor"; // under constructor (Pembeli KPR - Unit Sedang Pembangunan)
      } else if (hasCompleted) {
        integratedStatus = "buyer"; // buyer (Pembeli KPR - Sukses)
      } else if (hasAkad) {
        integratedStatus = "akad"; // akad (Pembeli KPR - Proses Akad)
      } else if (hasKprProcess) {
        integratedStatus = "kpr_process"; // Proses KPR
      } else if (hasActive) {
        integratedStatus = "booking"; // Booking
      }
    }

    const paymentScheme = customerBookings.length > 0 ? customerBookings[0].paymentScheme : null;

    return {
      ...c,
      status: integratedStatus,
      originalStatus: c.status,
      unitCode: linkedUnits.length > 0 ? linkedUnits.join(", ") : null,
      paymentScheme,
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
