"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { rememberAccount } from "@/lib/account-storage";
import type { SleeperAccount } from "@/lib/types";
import { withUsername } from "@/lib/utils";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

// `/` renders a real dashboard behind this dialog. A returning visitor never gets here
// — the page redirects on the server when the account cookie is set.
export function ConnectAccountDialog() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const valid = username.trim().length > 0 && username.trim().length <= 50;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || loading) return;
    setError("");
    setLoading(true);
    try {
      const clean = username.trim();
      const response = await fetch(`/api/leagues?username=${encodeURIComponent(clean)}`);
      const result = (await response.json()) as SleeperAccount & { error?: string };
      if (!response.ok || !result.leagues?.length) throw new Error(result.error || "No NFL leagues were found.");
      rememberAccount({ leagueId: result.leagues[0].id, username: result.username });
      router.replace(withUsername(`/${result.leagues[0].id}`, result.username));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't load your Sleeper leagues.");
      setLoading(false);
    }
  }

  return (
    <Dialog open modal disablePointerDismissal>
      <DialogContent className="sm:max-w-md" overlayClassName="bg-background/20 supports-backdrop-filter:backdrop-blur-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Connect your Sleeper account</DialogTitle>
          <DialogDescription>Enter your Sleeper username. We&rsquo;ll find your current NFL leagues and open your dashboard.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="sleeper-username">Sleeper username</FieldLabel>
              <Input
                aria-describedby={error ? "username-error" : undefined}
                aria-invalid={Boolean(error)}
                autoCapitalize="none"
                autoComplete="username"
                autoFocus
                id="sleeper-username"
                onChange={(event) => { setUsername(event.target.value); setError(""); }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }}
                placeholder="e.g. TimBlazing"
                spellCheck={false}
                value={username}
              />
              {error ? <FieldError id="username-error">{error}</FieldError> : null}
            </Field>
            <Button disabled={!valid || loading} size="lg" type="submit">
              {loading ? <><LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden="true" />Finding leagues...</> : <>Open dashboard<ArrowRight data-icon="inline-end" aria-hidden="true" /></>}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
