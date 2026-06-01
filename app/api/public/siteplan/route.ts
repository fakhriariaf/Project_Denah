import { NextRequest, NextResponse } from "next/server";
import { getPublicSiteplanData } from "@/server/actions/public-siteplan";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project") || undefined;

    const data = await getPublicSiteplanData(projectId);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Error in GET /api/public/siteplan:", error);
    return NextResponse.json(
      { error: "Gagal memuat data" },
      { status: 500 }
    );
  }
}
