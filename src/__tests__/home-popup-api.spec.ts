import { beforeEach, describe, expect, it, vi } from "vitest";

const { batchSetMock, commitMock } = vi.hoisted(() => ({
  batchSetMock: vi.fn(),
  commitMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  collection: vi.fn(() => "col"),
  deleteDoc: vi.fn(),
  deleteField: vi.fn(),
  doc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join("/") })),
  getCountFromServer: vi.fn(),
  getDocs: vi.fn(),
  increment: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
  Timestamp: { fromDate: (d: Date) => d },
  updateDoc: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(() => ({ set: batchSetMock, commit: commitMock })),
}));

vi.mock("@/config/firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "member-1" } },
}));

import { recordHomePopupDismissal } from "@/api/homePopups";
import {
  HOME_POPUP_ACTION,
  HOME_POPUP_RESPONSE_LINK_MAX,
} from "@/types/homePopup";

describe("recordHomePopupDismissal", () => {
  beforeEach(() => {
    batchSetMock.mockClear();
    commitMock.mockClear();
  });

  it("cuts a long link to what the rules accept, so the dismissal still saves", async () => {
    const link = `https://example.com/form?${"a".repeat(800)}`;
    await recordHomePopupDismissal("member-1", "popup-1", 2, {
      action: HOME_POPUP_ACTION.CLICKED,
      link,
    });

    expect(batchSetMock).toHaveBeenCalledTimes(2);
    const response = batchSetMock.mock.calls[1][1] as { link: string };
    expect(response.link).toHaveLength(HOME_POPUP_RESPONSE_LINK_MAX);
    expect(link.startsWith(response.link)).toBe(true);
    expect(commitMock).toHaveBeenCalled();
  });
});
