export function ComicCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`comic-card ${className}`}>{children}</div>;
}
