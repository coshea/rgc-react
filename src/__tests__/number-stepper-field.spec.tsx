import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { NumberStepperField } from "@/components/number-stepper-field";

function Controlled({
  initial,
  onChange,
  ...props
}: {
  initial: number;
  onChange?: (value: number) => void;
} & Omit<
  React.ComponentProps<typeof NumberStepperField>,
  "value" | "onChange"
>) {
  const [value, setValue] = useState(initial);
  return (
    <NumberStepperField
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("NumberStepperField", () => {
  it("labels the value and both buttons", () => {
    render(<NumberStepperField label="Order" value={2} onChange={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "Order" })).toHaveValue("2");
    expect(
      screen.getByRole("button", { name: "Decrease Order" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Increase Order" }),
    ).toBeInTheDocument();
  });

  it("steps the value up and down", () => {
    const onChange = vi.fn();
    render(<Controlled label="Day #" initial={2} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Increase Day #" }));
    expect(onChange).toHaveBeenLastCalledWith(3);

    fireEvent.click(screen.getByRole("button", { name: "Decrease Day #" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease Day #" }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("stops at the minimum and maximum", () => {
    render(
      <NumberStepperField
        label="Players"
        value={1}
        onChange={vi.fn()}
        minValue={1}
        maxValue={1}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Decrease Players" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Increase Players" }),
    ).toBeDisabled();
  });

  it("shows years without a thousands separator", () => {
    render(
      <NumberStepperField
        aria-label="Payment year"
        value={2026}
        onChange={vi.fn()}
        isYear
      />,
    );

    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.queryByText("2,026")).not.toBeInTheDocument();
    // The hidden input is what screen readers announce.
    expect(screen.getByRole("textbox", { name: "Payment year" })).toHaveValue(
      "2026",
    );
  });

  it("keeps the buttons in the tab order", () => {
    render(<NumberStepperField label="Order" value={0} onChange={vi.fn()} />);

    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("tabindex", "0");
    }
  });

  it("shows the description and error message", () => {
    render(
      <NumberStepperField
        label="Winners per place"
        value={3}
        onChange={vi.fn()}
        description="Tournament default: 2"
        errorMessage="Pick at least one winner"
      />,
    );

    expect(screen.getByText("Tournament default: 2")).toBeInTheDocument();
    expect(screen.getByText("Pick at least one winner")).toBeInTheDocument();
  });
});
