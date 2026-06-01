import { getPublicSiteplanData } from "@/server/actions/public-siteplan";
import { PublicSiteplanViewer } from "@/components/siteplan/public-siteplan-viewer";
import { Building2 } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ project?: string }>;
}

export default async function PublicSiteplanPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const projectId = resolvedParams.project;
  const data = await getPublicSiteplanData(projectId);

  if (!data.project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-[#DDE8D8] flex items-center justify-center text-[#4F6F52] mb-6">
          <Building2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-[#243028] mb-2">Tidak Ada Proyek Publik</h2>
        <p className="text-[#66736A] max-w-md">
          Saat ini tidak ada proyek perumahan yang diaktifkan untuk publik. Silakan hubungi marketing untuk informasi lebih lanjut.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      <PublicSiteplanViewer initialData={data} />
    </div>
  );
}
