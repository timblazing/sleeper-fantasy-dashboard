import type { Metadata } from "next";

import { DraftWorkspace } from "@/components/draft-workspace";
import { PageHeader } from "@/components/page-header";
import { getDraftGradeData } from "@/lib/draft-grades";

export const metadata: Metadata = { title: "Draft" };

export default async function DraftPage({ params, searchParams }: { params: Promise<{ leagueId: string }>; searchParams: Promise<{ draft?: string | string[] }> }) {
  const [{ leagueId }, query] = await Promise.all([params, searchParams]);
  const requested = typeof query.draft === "string" ? query.draft : undefined;
  const data = await getDraftGradeData(leagueId, requested);

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        description={
          data.selectedDraftId
            ? `${data.selectedLabel} graded pick by pick`
            : "Every completed draft in this league, graded pick by pick"
        }
        title="Draft"
      />

      <DraftWorkspace basePath={`/${leagueId}/draft`} data={data} />
    </div>
  );
}
