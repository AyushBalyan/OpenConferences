'use client';

type SectionLayoutFrameProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  alerts?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
};

/** Standard section layout: header + optional alerts/toolbar (no horizontal subnav). */
export function SectionLayoutFrame({
  title,
  description,
  actions,
  alerts,
  toolbar,
  children,
}: SectionLayoutFrameProps) {
  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {alerts}
      {toolbar}
      {children}
    </>
  );
}
