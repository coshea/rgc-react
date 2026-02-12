import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/config/firebase";
import type { MembershipType } from "@@/types";
import type { User } from "@/api/users";

export interface ActiveMemberRecord {
  userId: string;
  year: number;
  membershipType?: MembershipType;
  status: "confirmed" | "pending" | "refunded";
}

export function useActiveMembers(year = new Date().getFullYear()) {
  return useQuery({
    queryKey: ["activeMembers", year],
    queryFn: async () => {
      const lastYear = year - 1;
      const toYear = (value: unknown) => {
        if (typeof value === "number") return value;
        if (typeof value === "string") {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      };

      const snap = await getDocs(collection(db, "users"));
      const records: ActiveMemberRecord[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Omit<User, "id">;
        if (data?.isMigrated === true) return;
        const lastPaidYear = toYear(data.lastPaidYear);
        if (typeof lastPaidYear !== "number") return;
        if (lastPaidYear < lastYear) return;
        records.push({
          userId: docSnap.id,
          year: lastPaidYear,
          membershipType: data.membershipType,
          status: "confirmed",
        });
      });
      return records;
    },
    staleTime: 60_000,
  });
}

export function useIsActiveMember(
  userId?: string,
  year = new Date().getFullYear(),
) {
  return useQuery({
    enabled: !!userId,
    queryKey: ["isActiveMember", userId, year],
    queryFn: async () => {
      if (!userId) return false;
      const snap = await getDoc(doc(db, "users", userId));
      if (!snap.exists()) return false;
      const data = snap.data() as Omit<User, "id">;
      const lastPaidYear =
        typeof data.lastPaidYear === "number"
          ? data.lastPaidYear
          : typeof data.lastPaidYear === "string"
            ? Number(data.lastPaidYear)
            : null;
      return typeof lastPaidYear === "number" && lastPaidYear >= year;
    },
    staleTime: 30_000,
  });
}
