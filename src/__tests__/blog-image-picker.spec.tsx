import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { BlogImagePicker } from "@/components/blog-image-picker";

const uploadBlogImageMock = vi.fn();
const listBlogImagesMock = vi.fn();
const addToastMock = vi.fn();

vi.mock("@/api/storage", () => ({
  uploadBlogImage: (file: File, name?: string) =>
    uploadBlogImageMock(file, name),
  listBlogImages: () => listBlogImagesMock(),
}));

vi.mock("@/providers/toast", () => ({
  addToast: (args: unknown) => addToastMock(args),
}));

function fileInput() {
  const input = screen.getByLabelText("Choose image file");
  if (!(input instanceof HTMLInputElement)) throw new Error("No file input");
  return input;
}

function pick(file: File) {
  fireEvent.change(fileInput(), { target: { files: [file] } });
}

const photo = new File(["x".repeat(2048)], "spring-day.png", {
  type: "image/png",
});

describe("BlogImagePicker", () => {
  beforeEach(() => {
    uploadBlogImageMock.mockReset();
    addToastMock.mockReset();
    listBlogImagesMock.mockReset().mockResolvedValue([]);
  });

  it("offers a drop zone with a file picker for images", async () => {
    render(<BlogImagePicker onChange={vi.fn()} />);

    expect(
      screen.getByText("Drag and drop an image here, or click to browse"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Choose Image/ }),
    ).toBeInTheDocument();
    expect(fileInput()).toHaveAttribute("accept", "image/*");
    expect(
      await screen.findByRole("heading", { name: "No images uploaded yet" }),
    ).toBeInTheDocument();
  });

  it("shows the chosen file with its name prefilled", () => {
    render(<BlogImagePicker onChange={vi.fn()} />);
    pick(photo);

    expect(screen.getByText("spring-day.png")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /Custom Filename/ }),
    ).toHaveValue("spring-day");
    expect(
      screen.queryByText("Drag and drop an image here, or click to browse"),
    ).not.toBeInTheDocument();
  });

  it("uploads with the custom name and selects the new image", async () => {
    uploadBlogImageMock.mockResolvedValue("https://img/spring.png");
    const onChange = vi.fn();
    render(<BlogImagePicker onChange={onChange} />);
    pick(photo);

    fireEvent.change(screen.getByRole("textbox", { name: /Custom Filename/ }), {
      target: { value: "spring-2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Upload$/ }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith("https://img/spring.png"),
    );
    expect(uploadBlogImageMock).toHaveBeenCalledWith(photo, "spring-2026");
    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ color: "success" }),
    );
    // Back to the empty drop zone for the next upload.
    expect(
      screen.getByText("Drag and drop an image here, or click to browse"),
    ).toBeInTheDocument();
  });

  it("removes the chosen file", () => {
    render(<BlogImagePicker onChange={vi.fn()} />);
    pick(photo);

    fireEvent.click(
      screen.getByRole("button", { name: "Remove spring-day.png" }),
    );
    expect(screen.queryByText("spring-day.png")).not.toBeInTheDocument();
  });

  it("rejects files that aren't images", () => {
    render(<BlogImagePicker onChange={vi.fn()} />);
    pick(new File(["%PDF"], "rules.pdf", { type: "application/pdf" }));

    fireEvent.click(screen.getByRole("button", { name: /^Upload$/ }));
    expect(uploadBlogImageMock).not.toHaveBeenCalled();
    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Invalid file", color: "warning" }),
    );
  });

  it("warns when the upload fails", async () => {
    uploadBlogImageMock.mockRejectedValue(new Error("network"));
    render(<BlogImagePicker onChange={vi.fn()} />);
    pick(photo);

    fireEvent.click(screen.getByRole("button", { name: /^Upload$/ }));
    await waitFor(() =>
      expect(addToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ color: "danger" }),
      ),
    );
    // The file stays so the admin can retry.
    expect(screen.getByText("spring-day.png")).toBeInTheDocument();
  });
});
