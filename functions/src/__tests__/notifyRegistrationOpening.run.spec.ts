import { beforeEach, describe, expect, it, vi } from "vitest";

const schedulerState = vi.hoisted(() => {
  return {
    handler: undefined as undefined | (() => Promise<void>),
  };
});

const firestoreState = vi.hoisted(() => {
  const get = vi.fn();
  const registrationsGet = vi.fn();
  const stream = vi.fn();
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

      if (name === "users") {
        return { stream };
      }

      if (name === "notifications") {
        return notificationsCollection;
      }

      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  return {
    batch,
    batchCommit,
    batchSet,
    db,
    get,
    notificationsCollection,
    registrationsGet,
    stream,
    tournamentsQuery,
  };
});

const loggerState = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
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
  },
}));

vi.mock("../logger", () => ({
  logger: loggerState,
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
    firestoreState.registrationsGet.mockResolvedValue({ docs: [] });
    firestoreState.stream.mockReturnValue(emptyUserStream());
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

    await import("../notifyRegistrationOpening");

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
        tournamentId: "Healthy Tournament",
        recipientCount: 0,
      }),
    );
    expect(loggerState.info).toHaveBeenCalledWith(
      "notify_registration_opening: run complete",
      expect.objectContaining({
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

    await import("../notifyRegistrationOpening");

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
});
