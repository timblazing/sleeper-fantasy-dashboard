import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => <Skeleton className="h-24 w-full" key={index} />)}
      </div>
      <Skeleton className="h-[26rem] w-full" />
      <Skeleton className="h-[32rem] w-full" />
      <Skeleton className="h-[28rem] w-full" />
    </main>
  );
}
