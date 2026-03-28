import { APP_DESCRIPTION, APP_NAME } from '@repo/shared';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <img src="/logo.svg" alt={APP_NAME} width={56} height={56} />
        <div>
          <span className="text-primary text-3xl font-bold tracking-tight">{APP_NAME}</span>
          <p className="text-muted-foreground mt-1 text-sm">{APP_DESCRIPTION}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
