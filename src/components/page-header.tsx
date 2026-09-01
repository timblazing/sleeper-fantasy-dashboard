/**
 * The one page heading every route renders. League and draft set the
 * pattern — a title with a one-line description that says what the reader is looking
 * at — and this keeps the type scale and spacing identical across all of them.
 */
export function PageHeader({ description, title }: { description: string; title: string }) {
  return (
    <header>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
    </header>
  );
}
