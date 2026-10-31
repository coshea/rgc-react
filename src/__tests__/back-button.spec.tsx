import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import BackButton from "@/components/back-button";

function renderAt(initialEntries: string[]) {
  return render(
    <MemoryRouter
      initialEntries={initialEntries}
      initialIndex={initialEntries.length - 1}
    >
      <Routes>
        <Route path="/" element={<p>Home page</p>} />
        <Route path="/previous" element={<p>Previous page</p>} />
        <Route path="/current" element={<BackButton />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BackButton", () => {
  it("goes back to the previous page when there is history", () => {
    renderAt(["/previous", "/current"]);
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText("Previous page")).toBeInTheDocument();
  });

  it("goes home when the page is the first entry", () => {
    renderAt(["/current"]);
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText("Home page")).toBeInTheDocument();
  });
});
