'use client';

import { TelegramLinkSection } from '@/components/profile/telegram-link-section';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/use-profile';
import { BADGE_COLORS } from '@/lib/badge-colors';
import { formatShortDate } from '@/lib/date';

interface SectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function Section({ title, description, children }: SectionProps) {
  return (
    <div className="bg-card border-border rounded-xl border p-5">
      <div className="grid gap-6 md:grid-cols-[2fr_3fr]">
        <div>
          <h2 className="font-medium">{title}</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{description}</p>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

function AccountInfo() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (!user) return null;

  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{user.email}</p>
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`rounded-full px-2.5 py-0.5 font-medium ${isAdmin ? BADGE_COLORS.orange : BADGE_COLORS.blue}`}
        >
          {isAdmin ? 'Администратор' : 'Пользователь'}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">в системе с {formatShortDate(user.createdAt)}</span>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Профиль</h1>
        <p className="text-muted-foreground text-sm">Управление настройками аккаунта</p>
      </div>

      <div className="space-y-4">
        <Section title="Аккаунт" description="Ваши данные в системе.">
          <AccountInfo />
        </Section>

        <Section
          title="Telegram"
          description="Привяжите аккаунт, чтобы получать отобранные статьи прямо в мессенджере."
        >
          <TelegramLinkSection />
        </Section>
      </div>
    </div>
  );
}
