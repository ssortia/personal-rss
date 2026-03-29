import type { ReactNode } from 'react';

interface PreferencesSectionProps {
  title: string;
  description: string;
  children: ReactNode;
}

/** Секция настроек с заголовком слева и контентом справа — используется на странице интересов и в форме добавления источника. */
export function PreferencesSection({ title, description, children }: PreferencesSectionProps) {
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
