import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const ADMIN_NAMES = ['ali', 'lio', 'tester'];

/**
 * Checks if a given user object or username has admin privileges.
 * Designated admins: Lio, Ali, Tester (case-insensitive) + any user with role: 'admin' or isAdmin: true.
 */
export function isUserAdmin(userOrName) {
  if (!userOrName) return false;

  if (typeof userOrName === 'string') {
    return ADMIN_NAMES.includes(userOrName.trim().toLowerCase());
  }

  if (userOrName.isAdmin === true || userOrName.role === 'admin') {
    return true;
  }

  const name = userOrName.name || userOrName.username || '';
  if (name && ADMIN_NAMES.includes(name.trim().toLowerCase())) {
    return true;
  }

  const email = userOrName.email || '';
  const emailPrefix = email.split('@')[0] || '';
  if (ADMIN_NAMES.includes(emailPrefix.trim().toLowerCase())) {
    return true;
  }

  return false;
}

/**
 * Admin Badge component for highlighting admin accounts
 */
export function AdminBadge({ size = 14, className = 'text-[#f59e0b] fill-[#f59e0b]/20 shrink-0', title = 'Site Administrator' }) {
  return React.createElement(
    'span',
    { title, className: 'inline-flex items-center shrink-0' },
    React.createElement(ShieldCheck, { size, className })
  );
}

export default isUserAdmin;
