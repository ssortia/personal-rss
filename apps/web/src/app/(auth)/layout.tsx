import { APP_DESCRIPTION, APP_NAME } from '@repo/types';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <span className="text-primary text-3xl font-bold tracking-tight">{APP_NAME}</span>
        <p className="text-muted-foreground mt-1 text-sm">{APP_DESCRIPTION}</p>
      </div>
      {children}
    </div>
  );
}
