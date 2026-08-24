import { ConnectAccountDialog } from "@/components/connect-account-dialog";
import { LeagueShell } from "@/components/league-shell";
import { Overview } from "@/components/overview";
import { ACCOUNT_COOKIE, parseStoredAccount } from "@/lib/account-storage";
import { getShowcase } from "@/lib/showcase";
import { withUsername } from "@/lib/utils";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// There is no marketing page: `/` is the dashboard, with the connect dialog over it
// until an account is remembered. The backdrop is a real league so the blur has
// something to say about what the app does.
export default async function Home() {
  const stored = parseStoredAccount((await cookies()).get(ACCOUNT_COOKIE)?.value);
  if (stored) redirect(withUsername(`/${stored.leagueId}`, stored.username));

  // No backdrop when Sleeper is down: the dialog is what this page is for, and it
  // still works against an empty frame.
  const showcase = await getShowcase();

  return (
    <>
      {showcase ? (
        <div aria-hidden="true" className="pointer-events-none select-none">
          <LeagueShell league={showcase.league}>
            <Overview data={showcase.data} />
          </LeagueShell>
        </div>
      ) : (
        <div aria-hidden="true" className="min-h-svh bg-sidebar" />
      )}
      <ConnectAccountDialog />
    </>
  );
}
