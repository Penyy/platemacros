interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, right }: Props) {
  return (
    <header className="px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {right}
      </div>
    </header>
  );
}
