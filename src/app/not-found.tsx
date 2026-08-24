import { SearchXIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <Empty className="min-h-64 border">
        <EmptyHeader>
          <EmptyMedia variant="icon"><SearchXIcon /></EmptyMedia>
          <EmptyTitle>League not found</EmptyTitle>
          <EmptyDescription>This isn&apos;t a valid Sleeper league id. Check the link and try again.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link href="/" />}>Back to connect screen</Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
