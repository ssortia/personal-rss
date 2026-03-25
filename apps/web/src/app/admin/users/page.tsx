import { Suspense } from 'react';

import { Skeleton } from '../../../components/ui/skeleton';
import { requireAdminSession } from '../../../lib/auth-guard';

import { UsersTable } from './users-table';

export default async function AdminUsersPage() {
  const session = await requireAdminSession();
  const currentAdminId = session.user.id;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Пользователи</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <UsersTable currentAdminId={currentAdminId} />
      </Suspense>
    </div>
  );
}
