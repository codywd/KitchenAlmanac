export function PageIntro({
  actions,
  children,
  eyebrow,
  title,
}: {
  actions?: React.ReactNode;
  children?: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="ka-page-intro">
      <div>
        <p className="ka-kicker">{eyebrow}</p>
        <h1 className="ka-title-small">{title}</h1>
        {children ? <p className="ka-copy">{children}</p> : null}
      </div>
      {actions ? (
        <div aria-label="Page actions" className="ka-page-actions">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
