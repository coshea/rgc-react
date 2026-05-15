import { useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import { toDate, type User } from "@/api/users";
import type { MembershipPayment } from "@/api/membership";
import { usePageTracking } from "@/hooks/usePageTracking";

// ─── Types ─────────────────────────────────────────────────────────────────────

type RowStatus = "ready" | "no-payment" | "done" | "error";

type BackfillRow = {
  user: User;
  proposedDate: Date | null;
  paymentYear: number | null;
  status: RowStatus;
  errorMsg?: string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function resolveDisplayName(user: User): string {
  if (user.displayName) return user.displayName;
  const full = [user.firstName ?? "", user.lastName ?? ""]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || user.email || "—";
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminBackfillCreatedAtPage() {
  usePageTracking("Admin Backfill Created At");

  const [rows, setRows] = useState<BackfillRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const readyCount = useMemo(
    () => rows.filter((r) => r.status === "ready").length,
    [rows],
  );
  const doneCount = useMemo(
    () => rows.filter((r) => r.status === "done").length,
    [rows],
  );
  const errorCount = useMemo(
    () => rows.filter((r) => r.status === "error").length,
    [rows],
  );
  const noPaymentCount = useMemo(
    () => rows.filter((r) => r.status === "no-payment").length,
    [rows],
  );

  async function loadPreview() {
    setLoading(true);
    setLoaded(false);
    setLoadError(null);
    setRows([]);

    try {
      // 1. Fetch all user docs
      const usersSnap = await getDocs(collection(db, "users"));

      // Eligible: no createdAt, migrationEligible !== true, not soft-deleted
      const eligibleUsers = usersSnap.docs
        .map((d) => {
          const data = d.data();
          return { id: d.id, ...data } as User & { emailVerified?: boolean };
        })
        .filter(
          (u) => !u.createdAt && u.migrationEligible !== true && !u.isMigrated,
        );

      // 2. Fetch all confirmed dues payments (across all years)
      const paymentsSnap = await getDocs(
        query(
          collection(db, "memberPayments"),
          where("purpose", "==", "dues"),
          where("status", "==", "confirmed"),
        ),
      );

      // Group by userId → find the earliest payment date per user
      const earliestByUser = new Map<string, { date: Date; year: number }>();

      paymentsSnap.docs.forEach((d) => {
        const p = d.data() as MembershipPayment;
        if (!p.userId) return;

        // Prefer paidAt; fall back to createdAt on the payment doc
        const date = toDate(p.paidAt) ?? toDate(p.createdAt);
        if (!date) return;

        const existing = earliestByUser.get(p.userId);
        if (!existing || date < existing.date) {
          earliestByUser.set(p.userId, { date, year: p.year });
        }
      });

      // 3. Build rows
      const newRows: BackfillRow[] = eligibleUsers.map((user) => {
        const earliest = earliestByUser.get(user.id);
        return {
          user,
          proposedDate: earliest?.date ?? null,
          paymentYear: earliest?.year ?? null,
          status: earliest ? "ready" : "no-payment",
        };
      });

      // Sort: ready-first, then alphabetically by name
      newRows.sort((a, b) => {
        if (a.status === "ready" && b.status !== "ready") return -1;
        if (a.status !== "ready" && b.status === "ready") return 1;
        return resolveDisplayName(a.user).localeCompare(
          resolveDisplayName(b.user),
        );
      });

      setRows(newRows);
      setLoaded(true);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  async function runBackfill() {
    setRunning(true);
    const updatedRows = [...rows];

    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i];
      if (row.status !== "ready" || !row.proposedDate) continue;

      try {
        await updateDoc(doc(db, "users", row.user.id), {
          createdAt: Timestamp.fromDate(row.proposedDate),
        });
        updatedRows[i] = { ...row, status: "done" };
      } catch (e) {
        updatedRows[i] = {
          ...row,
          status: "error",
          errorMsg: e instanceof Error ? e.message : "Unknown error",
        };
      }

      // Flush state update on each write so the table shows live progress
      setRows([...updatedRows]);
    }

    setRunning(false);
  }

  const chipColor: Record<
    RowStatus,
    "primary" | "success" | "warning" | "danger"
  > = {
    ready: "primary",
    done: "success",
    "no-payment": "warning",
    error: "danger",
  };

  const chipLabel: Record<RowStatus, string> = {
    ready: "Ready",
    done: "Done",
    "no-payment": "No payment",
    error: "Error",
  };

  return (
    <div className="min-h-screen px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Backfill Member Since Date</h1>
          <p className="mt-1 text-default-500 text-sm">
            One-time migration to populate the <strong>member since</strong>{" "}
            date for members who joined before this field was tracked. Defaults
            to each member's earliest confirmed membership payment date.
          </p>
        </div>

        {/* Criteria card */}
        <Card className="mb-6">
          <CardBody className="gap-2 text-sm text-default-600">
            <p>
              <strong>Included:</strong> Users missing a member-since date with{" "}
              <code className="text-xs bg-default-100 px-1 py-0.5 rounded">
                migrationEligible ≠ true
              </code>
              .
            </p>
            <p>
              <strong>Proposed date:</strong> Earliest confirmed membership dues
              payment (
              <code className="text-xs bg-default-100 px-1 py-0.5 rounded">
                paidAt
              </code>
              ). Members with no payment record appear as warnings and are{" "}
              <strong>not</strong> updated.
            </p>
            <p>
              <strong>Safe to re-run:</strong> Reload preview anytime;
              already-updated members will no longer appear (their{" "}
              <code className="text-xs bg-default-100 px-1 py-0.5 rounded">
                createdAt
              </code>{" "}
              is set).
            </p>
          </CardBody>
        </Card>

        {/* Action bar */}
        <div className="flex gap-3 mb-6">
          <Button
            color="primary"
            variant="flat"
            startContent={<Icon icon="lucide:search" className="w-4 h-4" />}
            onPress={loadPreview}
            isLoading={loading}
            isDisabled={running}
          >
            Load Preview
          </Button>

          {loaded && readyCount > 0 && !running && (
            <Button
              color="success"
              startContent={<Icon icon="lucide:play" className="w-4 h-4" />}
              onPress={runBackfill}
              isDisabled={loading}
            >
              Backfill {readyCount} {readyCount === 1 ? "Member" : "Members"}
            </Button>
          )}

          {running && (
            <div className="flex items-center gap-2 text-default-500 text-sm">
              <Spinner size="sm" />
              <span>Writing updates…</span>
            </div>
          )}
        </div>

        {/* Load error */}
        {loadError && (
          <Card className="mb-4 border-danger-200">
            <CardBody className="flex flex-row items-center gap-2 text-danger text-sm">
              <Icon icon="lucide:alert-circle" className="w-4 h-4 shrink-0" />
              {loadError}
            </CardBody>
          </Card>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center gap-2 text-default-500 text-sm">
            <Spinner size="sm" />
            <span>Loading users and payment history…</span>
          </div>
        )}

        {/* Results */}
        {loaded && (
          <>
            {/* Summary chips */}
            <div className="flex flex-wrap gap-3 mb-4">
              <Chip color="success" variant="flat" size="sm">
                {doneCount} updated
              </Chip>
              <Chip color="primary" variant="flat" size="sm">
                {readyCount} ready
              </Chip>
              <Chip color="warning" variant="flat" size="sm">
                {noPaymentCount} no payment found
              </Chip>
              {errorCount > 0 && (
                <Chip color="danger" variant="flat" size="sm">
                  {errorCount} errors
                </Chip>
              )}
            </div>

            {rows.length === 0 ? (
              <Card>
                <CardBody className="flex flex-col items-center gap-2 py-12 text-default-400">
                  <Icon icon="lucide:check-circle-2" className="w-10 h-10" />
                  <p className="font-medium">
                    All eligible members already have a member-since date.
                  </p>
                </CardBody>
              </Card>
            ) : (
              <Table aria-label="Backfill member-since date preview" isStriped>
                <TableHeader>
                  <TableColumn>Member</TableColumn>
                  <TableColumn>Email</TableColumn>
                  <TableColumn>Proposed Date</TableColumn>
                  <TableColumn>Status</TableColumn>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.user.id}>
                      <TableCell className="font-medium">
                        {resolveDisplayName(row.user)}
                      </TableCell>
                      <TableCell className="text-default-500 text-sm">
                        {row.user.email || "—"}
                      </TableCell>
                      <TableCell>
                        {row.proposedDate ? (
                          row.proposedDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        ) : (
                          <span className="text-default-400">
                            No payment on record
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          color={chipColor[row.status]}
                          variant="flat"
                          size="sm"
                          title={row.errorMsg}
                        >
                          {chipLabel[row.status]}
                        </Chip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
