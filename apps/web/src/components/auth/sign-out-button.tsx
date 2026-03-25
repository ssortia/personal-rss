import { signOut } from '@/auth';

/** Server component — кнопка выхода из аккаунта через server action. */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/login' });
      }}
    >
      <button type="submit" className={className}>
        Выйти
      </button>
    </form>
  );
}
