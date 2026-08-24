"use client";

import { useEffect } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <Empty className="min-h-64 border">
        <EmptyHeader>
          <EmptyMedia variant="icon"><TriangleAlertIcon /></EmptyMedia>
          <EmptyTitle>This league page could not be loaded</EmptyTitle>
          <EmptyDescription>Sleeper did not return the data this page needs. Try again shortly.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => retry()}>Try again</Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
