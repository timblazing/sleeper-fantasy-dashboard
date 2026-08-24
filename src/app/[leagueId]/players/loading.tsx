import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() { return <main className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col gap-6 p-6"><Skeleton className="h-9 w-48" /><Skeleton className="h-40 w-full" /><Skeleton className="h-10 w-full max-w-xl" /><Skeleton className="h-[34rem] w-full" /></main>; }
