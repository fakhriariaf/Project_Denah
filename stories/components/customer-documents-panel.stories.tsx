import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CheckCircle2, Clock3, FileText, ShieldCheck } from "lucide-react";

type DocumentState = "verified" | "uploaded" | "empty";

type StoryDocument = {
  label: string;
  state: DocumentState;
};

function CustomerDocumentsPanelStandIn({
  title,
  requiredDocuments,
  supportingDocuments,
  showAkadSection,
}: {
  title: string;
  requiredDocuments: StoryDocument[];
  supportingDocuments: StoryDocument[];
  showAkadSection?: boolean;
}) {
  const verifiedCount = requiredDocuments.filter((document) => document.state === "verified").length;
  const completion = Math.round((verifiedCount / requiredDocuments.length) * 100);
  const allDocuments = [...requiredDocuments, ...supportingDocuments];

  return (
    <section className="w-[34rem] max-w-full space-y-4 bg-[#F7F8F3] p-4">
      <div className="rounded-2xl border border-[#D6DED2] bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-bold text-[#243028]">
            <ShieldCheck className="h-4 w-4 text-[#4F6F52]" />
            {title}
          </div>
          <span className="font-mono text-sm font-bold text-[#4F6F52]">{completion}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#DDE8D8]">
          <div className="h-full rounded-full bg-[#4F6F52]" style={{ width: `${completion}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {requiredDocuments.map((document) => (
            <DocumentPill key={document.label} document={document} />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#D6DED2] bg-white shadow-sm">
        <div className="border-b border-[#D6DED2] bg-[#F7F8F3] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#66736A]">
          Dokumen Identitas & Pendukung
        </div>
        <div className="divide-y divide-[#D6DED2]/60">
          {allDocuments.map((document) => (
            <div key={document.label} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DDE8D8] text-[#4F6F52]">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#243028]">{document.label}</p>
                <p className="text-xs text-[#66736A]">{getDocumentStateLabel(document.state)}</p>
              </div>
              {document.state === "verified" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : document.state === "uploaded" ? (
                <Clock3 className="h-4 w-4 text-amber-600" />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {showAkadSection && (
        <div className="rounded-2xl border border-[#D6DED2] bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-[#66736A]">Dokumen Akad / PPJB</p>
          <p className="mt-1 text-xs text-[#66736A]">
            Unggah PPJB yang sudah ditandatangani, lalu verifikasi sebelum menyelesaikan akad.
          </p>
        </div>
      )}
    </section>
  );
}

function DocumentPill({ document }: { document: StoryDocument }) {
  const classes = document.state === "verified"
    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
    : document.state === "uploaded"
      ? "border-amber-100 bg-amber-50 text-amber-700"
      : "border-[#D6DED2] bg-[#F7F8F3] text-[#A8B0AA]";

  return <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${classes}`}>{document.label}</span>;
}

function getDocumentStateLabel(state: DocumentState) {
  if (state === "verified") return "Terverifikasi";
  if (state === "uploaded") return "Menunggu verifikasi";
  return "Belum diunggah";
}

const meta = {
  title: "Marketing/CustomerDocumentsPanel",
  component: CustomerDocumentsPanelStandIn,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Dokumentasi visual pemisahan berkas booking Cash dan KPR. Komponen produksi memakai server action sehingga story ini merupakan replika presentasional untuk review UI.",
      },
    },
  },
} satisfies Meta<typeof CustomerDocumentsPanelStandIn>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cash: Story = {
  args: {
    title: "Dokumen Konsumen — Cash",
    requiredDocuments: [
      { label: "KTP", state: "verified" },
      { label: "Kartu Keluarga", state: "verified" },
    ],
    supportingDocuments: [{ label: "NPWP (opsional)", state: "empty" }],
    showAkadSection: true,
  },
};

export const Kpr: Story = {
  args: {
    title: "Berkas Pengajuan KPR",
    requiredDocuments: [
      { label: "KTP", state: "verified" },
      { label: "Kartu Keluarga", state: "verified" },
      { label: "NPWP", state: "uploaded" },
      { label: "Slip Gaji", state: "empty" },
    ],
    supportingDocuments: [{ label: "Dokumen Pendukung Bank", state: "empty" }],
    showAkadSection: false,
  },
};
