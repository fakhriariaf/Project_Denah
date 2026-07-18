import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Entry route untuk BAST Konsumen. Halaman cetak tetap menjadi satu sumber
 * dokumen, sehingga URL /bast tidak lagi berakhir 404.
 */
export default async function BastKonsumenPage({ params }: Props) {
  const { id } = await params;
  redirect(`/marketing/bookings/${id}/bast/print`);
}
