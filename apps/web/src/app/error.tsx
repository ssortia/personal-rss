'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-muted-foreground text-sm">Что-то пошло не так</p>
      <button onClick={reset} className="text-primary text-sm hover:underline">
        Попробовать снова
      </button>
    </div>
  );
}
