export function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="chart-empty-state">
      <span>📊</span>
      <p>{message}</p>
    </div>
  );
}
