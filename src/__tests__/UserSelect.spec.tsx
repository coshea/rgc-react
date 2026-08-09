import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Key } from "@heroui/react";
import { UserSelect } from "@/components/UserSelect";

type ComboBoxProps = {
  children?: React.ReactNode;
  value?: string | string[] | null;
  disabledKeys?: Key[];
};

const { comboBoxSpy } = vi.hoisted(() => ({
  comboBoxSpy: vi.fn<(props: ComboBoxProps) => void>(),
}));

vi.mock("@heroui/react", () => ({
  ComboBox: Object.assign(
    ({ children, ...props }: ComboBoxProps) => {
      comboBoxSpy(props);
      return <div data-testid="mock-combobox">{children}</div>;
    },
    {
      InputGroup: ({ children }: { children?: React.ReactNode }) => (
        <>{children}</>
      ),
      Trigger: () => null,
      Value: () => null,
      Popover: ({ children }: { children?: React.ReactNode }) => (
        <>{children}</>
      ),
    },
  ),
  EmptyState: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
  Label: ({ children }: { children?: React.ReactNode }) => (
    <label>{children}</label>
  ),
  ListBox: Object.assign(
    ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    {
      Item: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
      ),
      ItemIndicator: () => null,
    },
  ),
  useFilter: () => ({ contains: () => true }),
}));

describe("UserSelect", () => {
  const users = [
    { id: "user-a", displayName: "Alice" },
    { id: "user-b", displayName: "Bob" },
  ];

  it("preserves controlled missing ids in multi-select value and maxSelected gating", () => {
    render(
      <UserSelect
        users={users}
        value={["user-a", "removed-user"]}
        onChange={() => {}}
        multiple
        maxSelected={2}
      />,
    );

    expect(comboBoxSpy).toHaveBeenCalled();
    const props = comboBoxSpy.mock.calls.at(-1)?.[0];

    expect(props?.value).toEqual(["user-a", "removed-user"]);
    expect(props?.disabledKeys).toEqual(["user-b"]);
  });

  it("preserves a controlled missing id in single-select mode", () => {
    render(
      <UserSelect users={users} value="removed-user" onChange={() => {}} />,
    );

    expect(comboBoxSpy).toHaveBeenCalled();
    const props = comboBoxSpy.mock.calls.at(-1)?.[0];

    expect(props?.value).toBe("removed-user");
  });

  it("shows the removed hint when a controlled selected id is no longer in users", () => {
    render(
      <UserSelect
        users={users}
        value={["user-a", "removed-user"]}
        onChange={() => {}}
        multiple
        showRemovedHint
      />,
    );

    expect(screen.getByText("Removed User")).toBeInTheDocument();
  });
});
