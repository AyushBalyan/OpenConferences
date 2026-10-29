export function SubmissionDate({ value }: { value?: string | null }) {
  if (!value || Number.isNaN(Date.parse(value))) {
    return (
      <span className="text-slate-500" aria-label="Submission date unavailable">
        —
      </span>
    );
  }
  const date = new Date(value);
  return (
    <time
      dateTime={value}
      title={date.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
      className="whitespace-nowrap text-sm tabular-nums text-slate-600"
    >
      {date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
    </time>
  );
}
