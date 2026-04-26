export function Section({
  children,
  className = "",
  title,
  description,
}: {
  children: React.ReactNode;
  className?: string;
  description?: string;
  title: string;
}) {
  return (
    <section className={`ka-section ${className}`}>
      <div className="ka-section-header">
        <h2 className="ka-section-title">{title}</h2>
        {description ? (
          <p className="ka-section-description">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
