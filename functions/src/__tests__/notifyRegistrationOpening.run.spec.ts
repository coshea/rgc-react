import { beforeEach, describe, expect, it, vi } from "vitest";

const schedulerState = vi.hoisted(() => {
  return {
    handler: undefined as undefined | (() => Promise<void>),
  };
});

const firestoreState = vi.hoisted(() => {
  const get = vi.fn();
  const adminGet = vi.fn();
  const registrationsGet = vi.fn();
  const stream = vi.fn();
  const emailIssuesGet = vi.fn();
  const pendingGet = vi.fn();
  /** registrationOpeningEmailRetries docs, by tournament ID. */
  const pendingDocs = new Map<string, Record<string, unknown>>();
  const pendingRef = (id: string) => ({
    set: vi.fn(async (data: Record<string, unknown>) => {
      pendingDocs.set(id, data);
    }),
    delete: vi.fn(async () => {
      pendingDocs.delete(id);
    }),
  });
  const userGet = vi.fn();
  const batchSet = vi.fn();
  const batchCommit = vi.fn();
  const batch = vi.fn(() => ({
    set: batchSet,
    commit: batchCommit,
  }));

  const tournamentsQuery = {
    where: vi.fn(),
    orderBy: vi.fn(),
    get,
  };
  tournamentsQuery.where.mockReturnValue(tournamentsQuery);
  tournamentsQuery.orderBy.mockReturnValue(tournamentsQuery);

  const notificationsCollection = {
    doc: vi.fn((id: string) => ({ id })),
  };

  const db = {
    batch,
    collection: vi.fn((name: string) => {
      if (name === "tournaments") {
        return tournamentsQuery;
      }

      if (name.endsWith("/registrations")) {
        return { get: registrationsGet };
      }

      if (name === "admin") {
        return { get: adminGet };
      }

      if (name === "users") {
        return { stream };
      }

      if (name === "notifications") {
        return notificationsCollection;
      }

      if (name === "emailIssues") {
        return { get: emailIssuesGet };
      }

      if (name === "registrationOpeningEmailRetries") {
        return { get: pendingGet, doc: pendingRef };
      }

      throw new Error(`Unexpected collection: ${name}`);
    }),
    doc: vi.fn((path: string) => ({
      get: () => userGet(path),
    })),
  };

  return {
    adminGet,
    batch,
    batchCommit,
    batchSet,
    db,
    emailIssuesGet,
    get,
    notificationsCollection,
    pendingDocs,
    pendingGet,
    pendingRef,
    registrationsGet,
    stream,
    tournamentsQuery,
    userGet,
  };
});

const loggerState = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

const resendState = vi.hoisted(() => ({
  value: vi.fn(() => "test-resend-key"),
}));

const adminEmailState = vi.hoisted(() => ({
  send: vi.fn(),
}));

const batchState = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (_options: unknown, handler: () => Promise<void>) => {
    schedulerState.handler = handler;
    return handler;
  },
}));

vi.mock("firebase-admin", () => ({
  firestore: vi.fn(() => firestoreState.db),
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => "server-timestamp"),
    delete: vi.fn(() => "field-delete"),
  },
}));

vi.mock("../logger", () => ({
  logger: loggerState,
}));

vi.mock("../resendConfig", () => ({
  RESEND_API_KEY: resendState,
}));

vi.mock("../sendRegistrationOpeningEmails", () => ({
  sendRegistrationOpeningAdminEmail: adminEmailState.send,
  buildRegistrationOpeningMemberEmail: (recipient: {
    email: string;
    firstName?: string;
  }) => ({ to: [recipient.email], firstName: recipient.firstName }),
}));

vi.mock("../resendBatch", () => ({
  sendResendBatch: batchState.send,
}));

function createTournamentDoc(
  id: string,
  updateImpl: () => Promise<void>,
): {
  data: () => {
    registrationStart: Date;
    status: string;
    title: string;
  };
  id: string;
  ref: {
    update: ReturnType<typeof vi.fn>;
  };
} {
  return {
    id,
    data: () => ({
      registrationStart: new Date("2026-06-18T08:00:00.000Z"),
      status: "Upcoming",
      title: id,
    }),
    ref: {
      update: vi.fn(updateImpl),
    },
  };
}

async function* emptyUserStream(): AsyncGenerator<never, void, void> {
  return;
}

describe("notify_registration_opening handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    schedulerState.handler = undefined;
    firestoreState.get.mockResolvedValue({ docs: [] });
    firestoreState.adminGet.mockResolvedValue({ docs: [] });
    firestoreState.registrationsGet.mockResolvedValue({ docs: [] });
    firestoreState.stream.mockReturnValue(emptyUserStream());
    firestoreState.emailIssuesGet.mockResolvedValue({ docs: [] });
    firestoreState.pendingDocs.clear();
    firestoreState.pendingGet.mockResolvedValue({ docs: [] });
    firestoreState.userGet.mockResolvedValue({ data: () => undefined });
    resendState.value.mockReturnValue("test-resend-key");
    adminEmailState.send.mockResolvedValue(undefined);
    batchState.send.mockImplementation(
      async (_key: string, emails: unknown[]) => ({
        sent: emails.length,
        failed: 0,
        failedIndices: [],
      }),
    );
  });

  it("continues processing tournaments after one tournament fails", async () => {
    const failedDoc = createTournamentDoc("Broken Tournament", async () => {
      throw new Error("write failed");
    });
    const successfulDoc = createTournamentDoc(
      "Healthy Tournament",
      async () => {
        return;
      },
    );

    firestoreState.get.mockResolvedValue({
      docs: [failedDoc, successfulDoc],
    });

    await import("../notifyRegistrationOpening.js");

    expect(schedulerState.handler).toBeTypeOf("function");
    await schedulerState.handler?.();

    expect(failedDoc.ref.update).toHaveBeenCalledTimes(1);
    expect(successfulDoc.ref.update).toHaveBeenCalledTimes(1);
    expect(loggerState.error).toHaveBeenCalledWith(
      "notify_registration_opening: tournament failed",
      expect.objectContaining({
        tournamentId: "Broken Tournament",
      }),
    );
    expect(loggerState.info).toHaveBeenCalledWith(
      "notify_registration_opening: tournament processed",
      expect.objectContaining({
        adminEmailCount: 0,
        tournamentId: "Healthy Tournament",
        recipientCount: 0,
      }),
    );
    expect(loggerState.info).toHaveBeenCalledWith(
      "notify_registration_opening: run complete",
      expect.objectContaining({
        adminEmailCount: 0,
        tournamentCount: 1,
        notificationCount: 0,
      }),
    );
  });

  it("skips users already registered for the tournament", async () => {
    const tournamentId = "Registered Tournament";

    firestoreState.get.mockResolvedValue({
      docs: [createTournamentDoc(tournamentId, async () => undefined)],
    });
    firestoreState.registrationsGet.mockResolvedValue({
      docs: [
        {
          data: () => ({
            ownerId: "registered-user",
            team: [{ id: "registered-user" }, { id: "teammate" }],
          }),
        },
      ],
    });
    firestoreState.stream.mockReturnValue(
      (async function* () {
        yield {
          id: "registered-user",
          data: () => ({
            notificationPreferences: {
              tournamentUpdates: true,
            },
          }),
        };

        yield {
          id: "open-user",
          data: () => ({
            notificationPreferences: {
              tournamentUpdates: true,
            },
          }),
        };
      })(),
    );

    await import("../notifyRegistrationOpening.js");

    expect(schedulerState.handler).toBeTypeOf("function");
    await schedulerState.handler?.();

    expect(firestoreState.batchSet).toHaveBeenCalledTimes(1);
    expect(firestoreState.batchSet.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        uid: "open-user",
        data: expect.objectContaining({ tournamentId }),
      }),
    );
  });

  it("sends a registration-opening email to admin recipients", async () => {
    const tournamentId = "Member-Member";

    firestoreState.get.mockResolvedValue({
      docs: [createTournamentDoc(tournamentId, async () => undefined)],
    });
    firestoreState.adminGet.mockResolvedValue({
      docs: [{ id: "admin-user", data: () => ({ isAdmin: true }) }],
    });
    firestoreState.userGet.mockResolvedValue({
      data: () => ({ email: "admin@example.com" }),
    });

    await import("../notifyRegistrationOpening.js");

    expect(schedulerState.handler).toBeTypeOf("function");
    await schedulerState.handler?.();

    expect(adminEmailState.send).toHaveBeenCalledWith(
      "test-resend-key",
      ["admin@example.com"],
      expect.objectContaining({
        tournamentTitle: tournamentId,
        tournamentUrl: `https://ridgefieldgolfclub.org/tournaments/${tournamentId}`,
      }),
    );
  });

  describe("member emails", () => {
    const tournamentId = "Spring Scramble";
    // The fixture tournament has no date, so the season falls back to now.
    const season = new Date().getUTCFullYear();

    function member(
      id: string,
      overrides: Record<string, unknown> = {},
    ): { id: string; data: () => Record<string, unknown> } {
      return {
        id,
        data: () => ({
          email: `${id}@example.com`,
          firstName: id,
          membershipType: "full",
          lastPaidYear: season,
          ...overrides,
        }),
      };
    }

    function setUp(options: {
      enabled: boolean;
      users: Array<ReturnType<typeof member>>;
      admins?: Array<{ id: string; email: string }>;
    }): void {
      firestoreState.get.mockResolvedValue({
        docs: [createTournamentDoc(tournamentId, async () => undefined)],
      });
      firestoreState.stream.mockReturnValue(
        (async function* () {
          yield* options.users;
        })(),
      );
      const admins = options.admins ?? [];
      firestoreState.adminGet.mockResolvedValue({
        docs: admins.map((a) => ({ id: a.id, data: () => ({ isAdmin: true }) })),
      });
      firestoreState.userGet.mockImplementation(async (path: string) => {
        if (path === "config/membershipSettings") {
          return {
            data: () => ({ automatedMemberEmailsEnabled: options.enabled }),
          };
        }
        const adminUser = admins.find((a) => path === `users/${a.id}`);
        return { data: () => (adminUser ? { email: adminUser.email } : undefined) };
      });
    }

    async function run(): Promise<void> {
      await import("../notifyRegistrationOpening.js");
      await schedulerState.handler?.();
    }

    it("does not email members when the feature flag is off", async () => {
      setUp({ enabled: false, users: [member("ann")] });
      await run();
      expect(batchState.send).not.toHaveBeenCalled();
    });

    it("emails only paid full members who allow tournament emails", async () => {
      setUp({
        enabled: true,
        users: [
          member("ann"),
          member("lapsed", { lastPaidYear: season - 1 }),
          member("handicap", { membershipType: "handicap" }),
          member("optout", {
            notificationPreferences: { emailTournamentUpdates: false },
          }),
          member("pushoff", {
            notificationPreferences: { tournamentUpdates: false },
          }),
          member("migrated", { isMigrated: true }),
          member("noemail", { email: "" }),
        ],
      });

      await run();

      expect(batchState.send).toHaveBeenCalledTimes(1);
      const [key, emails, options] = batchState.send.mock.calls[0] as [
        string,
        Array<{ to: string[] }>,
        { idempotencyPrefix: string },
      ];
      expect(key).toBe("test-resend-key");
      expect(emails.map((e) => e.to[0])).toEqual([
        "ann@example.com",
        "pushoff@example.com",
      ]);
      expect(options.idempotencyPrefix).toBe(
        `registration-opening/${tournamentId}`,
      );
      expect(loggerState.info).toHaveBeenCalledWith(
        "notify_registration_opening: tournament processed",
        expect.objectContaining({ memberEmailSent: 2, memberEmailFailed: 0 }),
      );
    });

    it("skips addresses flagged by the Resend webhook", async () => {
      setUp({ enabled: true, users: [member("ann"), member("Bounced")] });
      firestoreState.emailIssuesGet.mockResolvedValue({
        docs: [{ id: "bounced@example.com" }],
      });

      await run();

      const emails = batchState.send.mock.calls[0]?.[1] as Array<{
        to: string[];
      }>;
      expect(emails.map((e) => e.to[0])).toEqual(["ann@example.com"]);
    });

    it("skips the admin copy for admins who already got the member email", async () => {
      setUp({
        enabled: true,
        users: [member("ann")],
        admins: [
          { id: "ann", email: "ann@example.com" },
          { id: "board", email: "board@example.com" },
        ],
      });

      await run();

      expect(adminEmailState.send).toHaveBeenCalledWith(
        "test-resend-key",
        ["board@example.com"],
        expect.anything(),
      );
    });

    it("claims the tournament before sending any email", async () => {
      setUp({
        enabled: true,
        users: [member("ann")],
        admins: [{ id: "board", email: "board@example.com" }],
      });
      const order: string[] = [];
      const doc = createTournamentDoc(tournamentId, async () => {
        order.push("claim");
      });
      firestoreState.get.mockResolvedValue({ docs: [doc] });
      batchState.send.mockImplementation(async () => {
        order.push("send");
        return { sent: 1, failed: 0, failedIndices: [] };
      });
      adminEmailState.send.mockRejectedValue(new Error("admin send failed"));

      await run();

      expect(order).toEqual(["claim", "send"]);
      expect(doc.ref.update).toHaveBeenCalledTimes(1);
      expect(firestoreState.pendingDocs.size).toBe(0);
      expect(loggerState.error).toHaveBeenCalledWith(
        "notify_registration_opening: admin email failed",
        expect.objectContaining({ tournamentId }),
      );
    });

    it("releases the claim when it fails before any email goes out", async () => {
      setUp({ enabled: true, users: [member("ann")] });
      const doc = createTournamentDoc(tournamentId, async () => undefined);
      firestoreState.get.mockResolvedValue({ docs: [doc] });
      firestoreState.registrationsGet.mockRejectedValue(new Error("read failed"));

      await run();

      expect(batchState.send).not.toHaveBeenCalled();
      expect(doc.ref.update).toHaveBeenLastCalledWith({
        registrationOpeningNotificationSentAt: "field-delete",
      });
    });

    it("keeps failed recipients for retry and only skips admins who got the email", async () => {
      setUp({
        enabled: true,
        users: [member("ann"), member("bob")],
        admins: [
          { id: "ann", email: "ann@example.com" },
          { id: "bob", email: "bob@example.com" },
        ],
      });
      batchState.send.mockResolvedValue({
        sent: 1,
        failed: 1,
        failedIndices: [1],
      });

      await run();

      expect(firestoreState.pendingDocs.get(tournamentId)).toEqual(
        expect.objectContaining({
          attempts: 1,
          recipients: [
            { uid: "bob", email: "bob@example.com", firstName: "bob" },
          ],
        }),
      );
      expect(adminEmailState.send).toHaveBeenCalledWith(
        "test-resend-key",
        ["bob@example.com"],
        expect.anything(),
      );
    });

    it("keeps every recipient pending when all member emails fail", async () => {
      setUp({ enabled: true, users: [member("ann")] });
      batchState.send.mockRejectedValue(new Error("resend down"));

      await run();

      expect(loggerState.error).toHaveBeenCalledWith(
        "notify_registration_opening: member emails failed",
        expect.objectContaining({ tournamentId }),
      );
      expect(
        firestoreState.pendingDocs.get(tournamentId)?.recipients,
      ).toHaveLength(1);
      expect(loggerState.info).toHaveBeenCalledWith(
        "notify_registration_opening: run complete",
        expect.objectContaining({ tournamentCount: 1, memberEmailCount: 0 }),
      );
    });

    describe("retries", () => {
      function pending(
        attempts: number,
        recipients: Array<{ uid: string; email: string }>,
      ): void {
        firestoreState.pendingGet.mockResolvedValue({
          docs: [
            {
              id: tournamentId,
              data: () => ({ attempts, recipients }),
              ref: firestoreState.pendingRef(tournamentId),
            },
          ],
        });
        firestoreState.pendingDocs.set(tournamentId, { attempts, recipients });
      }

      function setUpRetry(tournament: Record<string, unknown>): void {
        setUp({ enabled: true, users: [] });
        firestoreState.get.mockResolvedValue({ docs: [] });
        const base = firestoreState.userGet.getMockImplementation();
        firestoreState.userGet.mockImplementation(async (path: string) =>
          path === `tournaments/${tournamentId}`
            ? { data: () => tournament }
            : base?.(path),
        );
      }

      const openTournament = {
        registrationStart: new Date("2026-06-18T08:00:00.000Z"),
        status: "Upcoming",
        title: tournamentId,
      };

      it("re-sends pending recipients who still haven't registered", async () => {
        setUpRetry(openTournament);
        pending(1, [
          { uid: "ann", email: "ann@example.com" },
          { uid: "joined", email: "joined@example.com" },
        ]);
        firestoreState.registrationsGet.mockResolvedValue({
          docs: [{ data: () => ({ ownerId: "joined", team: [] }) }],
        });

        await run();

        const emails = batchState.send.mock.calls[0]?.[1] as Array<{
          to: string[];
        }>;
        expect(emails.map((e) => e.to[0])).toEqual(["ann@example.com"]);
        expect(firestoreState.pendingDocs.has(tournamentId)).toBe(false);
        expect(adminEmailState.send).not.toHaveBeenCalled();
      });

      it("gives up after the last attempt", async () => {
        setUpRetry(openTournament);
        pending(2, [{ uid: "ann", email: "ann@example.com" }]);
        batchState.send.mockRejectedValue(new Error("resend down"));

        await run();

        expect(firestoreState.pendingDocs.has(tournamentId)).toBe(false);
        expect(loggerState.error).toHaveBeenCalledWith(
          "notify_registration_opening: giving up on member emails",
          expect.objectContaining({ tournamentId, attempt: 3 }),
        );
      });

      it("drops pending emails once registration has closed", async () => {
        setUpRetry({
          ...openTournament,
          registrationEnd: new Date("2026-01-01T00:00:00.000Z"),
        });
        pending(1, [{ uid: "ann", email: "ann@example.com" }]);

        await run();

        expect(batchState.send).not.toHaveBeenCalled();
        expect(firestoreState.pendingDocs.has(tournamentId)).toBe(false);
      });
    });
  });
});
