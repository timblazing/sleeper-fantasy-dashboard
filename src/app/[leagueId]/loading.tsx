import { Skeleton } from "@/components/ui/skeleton";

// Rendered inside the [leagueId] layout, so only the inset content is replaced.
export default function Loading() { return <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8"><div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"><Skeleton className="h-[34rem] w-full" /><Skeleton className="h-[34rem] w-full" /></div></div>; }
