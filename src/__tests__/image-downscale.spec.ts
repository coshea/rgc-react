import { afterEach, describe, expect, it, vi } from "vitest";
import { downscaleImage } from "@/utils/image";

function stubBitmap(width: number, height: number) {
  const close = vi.fn();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width, height, close })),
  );
  return close;
}

function stubCanvas(outputBytes: number) {
  const calls: string[] = [];
  const context = {
    fillStyle: "",
    fillRect: vi.fn(() => calls.push("fill")),
    drawImage: vi.fn(() => calls.push("draw")),
  };
  const canvas = {
    width: 0,
    height: 0,
    context,
    calls,
    getContext: () => context,
    toBlob: (cb: (b: Blob | null) => void) =>
      cb(new Blob([new Uint8Array(outputBytes)], { type: "image/jpeg" })),
  };
  vi.spyOn(document, "createElement").mockReturnValue(
    canvas as unknown as HTMLCanvasElement,
  );
  return canvas;
}

const photo = (bytes: number, type = "image/jpeg", name = "IMG_9508.jpeg") =>
  new File([new Uint8Array(bytes)], name, { type });

describe("downscaleImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shrinks a large phone photo to the max dimension as JPEG", async () => {
    const close = stubBitmap(4032, 3024);
    const canvas = stubCanvas(300_000);
    const out = await downscaleImage(photo(6_000_000), 1200);
    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(900);
    expect(out.type).toBe("image/jpeg");
    expect(out.name).toBe("IMG_9508.jpg");
    expect(out.size).toBe(300_000);
    expect(close).toHaveBeenCalled();
  });

  it("paints a white background so transparent PNGs don't turn black", async () => {
    stubBitmap(3000, 3000);
    const canvas = stubCanvas(300_000);
    await downscaleImage(photo(6_000_000, "image/png", "logo.png"), 1200);
    expect(canvas.context.fillStyle).toBe("#ffffff");
    expect(canvas.context.fillRect).toHaveBeenCalledWith(0, 0, 1200, 1200);
    expect(canvas.calls).toEqual(["fill", "draw"]);
  });

  it("keeps a small photo as is", async () => {
    stubBitmap(800, 600);
    const file = photo(200_000);
    expect(await downscaleImage(file, 1200)).toBe(file);
  });

  it("keeps GIFs and non-images", async () => {
    stubBitmap(4000, 4000);
    const gif = photo(6_000_000, "image/gif", "a.gif");
    const pdf = photo(10, "application/pdf", "a.pdf");
    expect(await downscaleImage(gif)).toBe(gif);
    expect(await downscaleImage(pdf)).toBe(pdf);
  });

  it("falls back to the original when decoding fails", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("decode failed");
      }),
    );
    const file = photo(6_000_000);
    expect(await downscaleImage(file)).toBe(file);
  });
});
