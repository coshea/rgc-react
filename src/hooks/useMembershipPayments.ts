import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/config/firebase";
import type { MembershipPayment } from "@/api/membership";

export function useMembershipPayments(year = new Date().getFullYear()) {
  return useQuery({
    queryKey: ["membershipPayments", year],
    queryFn: async () => {
      const q = query(
        collection(db, "memberPayments"),
        where("year", "==", year),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as MembershipPayment),
      }));
    },
    staleTime: 60_000,
  });
}
