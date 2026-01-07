import type { User } from "@/api/users";

/**
 * Duplicate detection utilities for finding potential duplicate users
 */

export interface DuplicateGroup {
  reason: "email" | "name" | "manual";
  users: User[];
  // For display: the common value that makes them duplicates
  matchValue: string;
}

/**
 * Normalize a string for comparison (lowercase, trim, collapse whitespace)
 */
function normalize(str: string | undefined): string {
  if (!str) return "";
  return str.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Find all duplicate users based on email or full name matching
 * Returns groups of users that are potential duplicates
 */
export function findDuplicates(users: User[]): DuplicateGroup[] {
  const duplicateGroups: DuplicateGroup[] = [];

  // Track which users we've already grouped to avoid duplicates
  const processedUserIds = new Set<string>();

  // 1. Find duplicates by email
  const emailMap = new Map<string, User[]>();
  users.forEach((user) => {
    const email = normalize(user.email);
    if (email) {
      if (!emailMap.has(email)) {
        emailMap.set(email, []);
      }
      emailMap.get(email)!.push(user);
    }
  });

  // Add email duplicates to groups
  emailMap.forEach((userList, email) => {
    if (userList.length > 1) {
      duplicateGroups.push({
        reason: "email",
        users: userList,
        matchValue: email,
      });
      userList.forEach((u) => processedUserIds.add(u.id));
    }
  });

  // 2. Find duplicates by full name (first + last)
  const nameMap = new Map<string, User[]>();
  users.forEach((user) => {
    // Only check name duplicates if not already in an email duplicate group
    if (processedUserIds.has(user.id)) return;

    const first = normalize(user.firstName);
    const last = normalize(user.lastName);

    // Need both first and last name to check for name duplicates
    if (first && last) {
      const fullName = `${first} ${last}`;
      if (!nameMap.has(fullName)) {
        nameMap.set(fullName, []);
      }
      nameMap.get(fullName)!.push(user);
    }
  });

  // Add name duplicates to groups
  nameMap.forEach((userList, fullName) => {
    if (userList.length > 1) {
      duplicateGroups.push({
        reason: "name",
        users: userList,
        matchValue: fullName,
      });
    }
  });

  return duplicateGroups;
}

/**
 * Suggest which user should be the "new" (primary) user to keep
 * Based on: most recent creation date, payment history, profile completeness
 * Primary use case: when a user signs up, merge their new account with manually created profile
 */
export function suggestPrimaryUser(users: User[]): User {
  // Sort by priority criteria
  const sorted = [...users].sort((a, b) => {
    // 1. Prefer most recently created user (newer account = user sign-up)
    const aCreated =
      a.createdAt instanceof Date
        ? a.createdAt.getTime()
        : a.createdAt &&
            typeof a.createdAt === "object" &&
            "toDate" in a.createdAt
          ? a.createdAt.toDate().getTime()
          : 0;
    const bCreated =
      b.createdAt instanceof Date
        ? b.createdAt.getTime()
        : b.createdAt &&
            typeof b.createdAt === "object" &&
            "toDate" in b.createdAt
          ? b.createdAt.toDate().getTime()
          : 0;
    if (aCreated !== bCreated) return bCreated - aCreated; // Newer first

    // 2. Prefer user with more recent payment
    const aYear = a.lastPaidYear ?? 0;
    const bYear = b.lastPaidYear ?? 0;
    if (aYear !== bYear) return bYear - aYear;

    // 3. Prefer user with more complete profile
    const aComplete = [a.firstName, a.lastName, a.phone, a.ghinNumber].filter(
      Boolean
    ).length;
    const bComplete = [b.firstName, b.lastName, b.phone, b.ghinNumber].filter(
      Boolean
    ).length;
    if (aComplete !== bComplete) return bComplete - aComplete;

    // 4. Prefer user with photo
    if (!!a.photoURL !== !!b.photoURL) {
      return a.photoURL ? -1 : 1;
    }

    // 5. Prefer board member (likely more established)
    if (!!a.boardMember !== !!b.boardMember) {
      return a.boardMember ? -1 : 1;
    }

    // 6. Default to lexicographic by ID (stable)
    return a.id.localeCompare(b.id);
  });

  return sorted[0];
}
