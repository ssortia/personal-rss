export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <span className="text-primary text-3xl font-bold tracking-tight">Curio</span>
        <p className="text-muted-foreground mt-1 text-sm">Персональная читалка новостей</p>
      </div>
      {children}
    </div>
  );
}
