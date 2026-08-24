import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useKeyedImage } from "@/hooks/use-keyed-image";

// Each test paints a small RGBA bitmap, then checks which pixels the hook cleared.
let bitmap: { width: number; height: number; data: Uint8ClampedArray };
let output: Uint8ClampedArray | undefined;
let tainted = false;

function paint(width: number, height: number, pixel: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      const at = (y * width + x) * 4;
      data.set([r, g, b, 255], at);
    }
  }
  bitmap = { width, height, data };
}

const loads: { onload?: () => void }[] = [];

beforeEach(() => {
  loads.length = 0;
  output = undefined;
  tainted = false;

  window.Image = function (this: Record<string, unknown>) {
    const entry: { onload?: () => void } = {};
    loads.push(entry);
    return new Proxy(this, {
      get: (_t, key) =>
        key === "naturalWidth" ? bitmap.width : key === "naturalHeight" ? bitmap.height : undefined,
      set(_t, key, value) {
        if (key === "onload") entry.onload = value as () => void;
        return true;
      },
    });
  } as unknown as typeof window.Image;

  // jsdom has no canvas backend, so stand in a minimal 2D context over the painted bitmap.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        drawImage: () => {},
        getImageData: () => {
          if (tainted) throw new Error("tainted canvas");
          return { width: bitmap.width, height: bitmap.height, data: bitmap.data };
        },
        putImageData: (picture: { data: Uint8ClampedArray }) => {
          output = picture.data;
        },
      }) as unknown as CanvasRenderingContext2D
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,keyed");
});

/** Runs the hook against the painted bitmap and resolves the image load. */
async function key() {
  const hook = renderHook(() => useKeyedImage("/api/avatar?id=abc"));
  loads[0].onload?.();
  return hook;
}

const alpha = (x: number, y: number) => output![(y * bitmap.width + x) * 4 + 3];

describe("useKeyedImage", () => {
  it("clears a flat backdrop and leaves the subject opaque", async () => {
    // Yellow field with a dark 2x2 subject in the middle, like a league logo on a color plate.
    paint(6, 6, (x, y) => (x >= 2 && x <= 3 && y >= 2 && y <= 3 ? [10, 10, 10] : [255, 220, 0]));
    const { result } = await key();

    await waitFor(() => expect(result.current).toBe("data:image/png;base64,keyed"));
    expect(alpha(0, 0)).toBe(0);
    expect(alpha(5, 5)).toBe(0);
    expect(alpha(2, 2)).toBe(255);
    expect(alpha(3, 3)).toBe(255);
  });

  // Clearing every matching pixel would punch holes in a subject that shares the backdrop color.
  it("keeps background-colored pixels enclosed by the subject", async () => {
    // A dark ring around a single yellow pixel, on a yellow field.
    paint(7, 7, (x, y) => {
      const inRing = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      const isCenter = x === 3 && y === 3;
      return inRing && !isCenter ? [10, 10, 10] : [255, 220, 0];
    });
    const { result } = await key();

    await waitFor(() => expect(result.current).toBe("data:image/png;base64,keyed"));
    expect(alpha(0, 0)).toBe(0);
    expect(alpha(3, 3)).toBe(255);
  });

  // A photo-like logo has no flat backdrop; keying it would eat real content.
  it("leaves the image alone when the corners disagree", async () => {
    paint(4, 4, (x, y) => [x * 60, y * 60, 0]);
    const { result } = await key();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current).toBeUndefined();
  });

  it("leaves the image alone when it is already transparent-cornered but uniform", async () => {
    // A solid image with nothing to strip: every pixel is the background, so the fill
    // would erase the whole thing. It still keys, which is correct — but a subject-free
    // image is not something we render, so what matters is that it doesn't throw.
    paint(3, 3, () => [255, 220, 0]);
    const { result } = await key();
    await waitFor(() => expect(result.current).toBe("data:image/png;base64,keyed"));
  });

  it("gives up when the canvas is tainted", async () => {
    paint(4, 4, () => [255, 220, 0]);
    tainted = true;
    const { result } = await key();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current).toBeUndefined();
  });

  it("returns nothing when there is no src", () => {
    const { result } = renderHook(() => useKeyedImage(undefined));
    expect(result.current).toBeUndefined();
  });
});
