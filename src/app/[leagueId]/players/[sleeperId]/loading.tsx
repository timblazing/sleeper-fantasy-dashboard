import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the real layout — hero band, value chart, then the tab strip — so the page does not
 *  reflow when the profile lands. */
export default function PlayerProfileLoading() {
  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-6 lg:p-8">
      <Skeleton className="h-8 w-28" />

      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="flex flex-col gap-2" key={index}>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>

      <Skeleton className="h-8 w-80" />
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => <Skeleton className="h-14 w-full" key={index} />)}
        </CardContent>
      </Card>
    </div>
  );
}
