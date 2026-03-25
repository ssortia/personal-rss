'use client';

import type { Role } from '@repo/shared';

import { Input } from '../../../components/ui/input';

interface UsersTableFiltersProps {
  emailInput: string;
  roleFilter: Role | '';
  onEmailChange: (value: string) => void;
  onRoleChange: (value: Role | '') => void;
}

/** Панель фильтрации таблицы пользователей: поиск по email и выбор роли. */
export function UsersTableFilters({
  emailInput,
  roleFilter,
  onEmailChange,
  onRoleChange,
}: UsersTableFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Input
        placeholder="Поиск по email..."
        value={emailInput}
        onChange={(e) => onEmailChange(e.target.value)}
        className="max-w-xs"
      />
      <select
        value={roleFilter}
        onChange={(e) => onRoleChange(e.target.value as Role | '')}
        className="border-input bg-background focus:ring-ring rounded-md border px-3 py-2 text-sm focus:ring-2"
      >
        <option value="">Все роли</option>
        <option value="USER">USER</option>
        <option value="ADMIN">ADMIN</option>
      </select>
    </div>
  );
}
