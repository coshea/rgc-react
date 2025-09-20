// Global test setup: mock expensive or environment-incompatible modules.
import React from "react";
import { vi } from "vitest";

// Mock @iconify/react with a lightweight functional component that does not schedule timers.
vi.mock("@iconify/react", () => {
  const Icon = (props: any) =>
    React.createElement("span", {
      "data-icon": props.icon || "mock-icon",
      className: props.className || "",
    });
  return { Icon, default: Icon } as any;
});
