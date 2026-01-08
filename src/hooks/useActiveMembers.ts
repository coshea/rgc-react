import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/config/firebase";

export interface ActiveMemberRecord {
  userId: string;
  year: number;
  membershipType: "full" | "handicap";
  status: "confirmed" | "pending" | "refunded";
}

export function useActiveMembers(year = new Date().getFullYear()) {
  return useQuery({
    queryKey: ["activeMembers", year],
    queryFn: async () => {
      // Query for current and previous year to include recently active members
      const lastYear = year - 1;
      const q = query(
        collection(db, "memberPayments"),
        where("year", "in", [year, lastYear]),
        where("status", "==", "confirmed")
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as ActiveMemberRecord);
    },
    staleTime: 60_000,
  });
}

export function useIsActiveMember(
  userId?: string,
  year = new Date().getFullYear()
) {
  return useQuery({
    enabled: !!userId,
    queryKey: ["isActiveMember", userId, year],
    queryFn: async () => {
      if (!userId) return false;
      const q = query(
        collection(db, "memberPayments"),
        where("year", "==", year),
        where("status", "==", "confirmed"),
        where("userId", "==", userId)
      );
      const snap = await getDocs(q);
      return !snap.empty;
    },
    staleTime: 30_000,
  });
}
