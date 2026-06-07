interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, right }: Props) {
  return (
    <header className="px-[18px] pt-[max(env(safe-area-inset-top),1rem)] pb-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1
            className="text-[30px] leading-tight"
            style={{
              fontFamily: "Manrope, sans-serif",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--ink)",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="mt-1 text-[13px]"
              style={{ color: "var(--muted-foreground)", fontWeight: 500 }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {right}
      </div>
    </header>
  );
}
