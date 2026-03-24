interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="py-16 text-center">
      <p className="text-foreground font-medium">{title}</p>
      {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
    </div>
  );
}
