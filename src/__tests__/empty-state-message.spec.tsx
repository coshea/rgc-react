import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Button } from "@heroui/react";

import { EmptyStateMessage } from "@/components/empty-state-message";

describe("EmptyStateMessage", () => {
  it("renders the title as a heading with its icon and description", () => {
    const { container } = render(
      <EmptyStateMessage
        icon="lucide:trophy"
        title="No tournament wins yet"
        description="Wins show up here after results are posted."
      />,
    );

    expect(
      screen.getByRole("heading", { name: "No tournament wins yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Wins show up here after results are posted."),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-icon="lucide:trophy"]'),
    ).toBeInTheDocument();
  });

  it("leaves out the icon and description when not given", () => {
    const { container } = render(<EmptyStateMessage title="Nothing yet" />);

    expect(container.querySelector("[data-icon]")).not.toBeInTheDocument();
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });

  it("renders an action", () => {
    const onPress = vi.fn();
    render(
      <EmptyStateMessage
        title="No blog posts found"
        action={<Button onPress={onPress}>Create Your First Post</Button>}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Create Your First Post" }),
    );
    expect(onPress).toHaveBeenCalled();
  });
});
