import React from 'react';
import { BadgeCheck } from 'lucide-react';

export const VERIFIED_NAMES = ['ali', 'lio', 'tester'];

/**
 * Checks if a given user object or username is verified.
 * Verified users: Ali, Lio, Tester (case-insensitive).
 */
export function isUserVerified(userOrName) {
  if (!userOrName) return false;
  if (typeof userOrName === 'string') {
    return VERIFIED_NAMES.includes(userOrName.toLowerCase().trim());
  }
  if (userOrName.isVerified || userOrName.verified) return true;
  const name = userOrName.name || userOrName.username || '';
  return VERIFIED_NAMES.includes(name.toLowerCase().trim());
}

/**
 * Renders a verified badge icon next to verified users' names.
 * If userOrName is provided, only renders if the user is verified.
 */
export default function VerifiedBadge({
  userOrName,
  size = 14,
  className = 'text-[#17a398] fill-[#17a398]/20 shrink-0',
  title = 'Verified Dispensary Member',
}) {
  if (userOrName !== undefined && !isUserVerified(userOrName)) {
    return null;
  }
  return (
    <span title={title} className="inline-flex items-center shrink-0">
      <BadgeCheck size={size} className={className} />
    </span>
  );
}
