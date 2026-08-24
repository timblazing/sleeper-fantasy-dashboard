import { ConstructionIcon } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function ComingSoonPage({ description, title }: { description: string; title: string }) {
  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <PageHeader description={description} title={title} />

      <Empty className="min-h-64 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ConstructionIcon />
          </EmptyMedia>
          <EmptyTitle>{title} is coming soon</EmptyTitle>
          <EmptyDescription>This page is under development.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
