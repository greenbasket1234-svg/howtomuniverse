export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'accent';

export function Badge({
  tone = 'neutral',
  children,
  style,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return <span className={`badge badge-${tone}`} style={style}>{children}</span>;
}
