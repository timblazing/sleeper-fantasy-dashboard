"use client"

import * as React from "react"

/** Colors within this squared-RGB distance of the sampled background count as background. */
const MATCH_TOLERANCE = 48 * 48 * 3
/** Corners must agree this closely before we treat the image as having a flat background. */
const CORNER_AGREEMENT = 24 * 24 * 3

function distanceSquared(data: Uint8ClampedArray, a: number, b: number) {
  const dr = data[a] - data[b]
  const dg = data[a + 1] - data[b + 1]
  const db = data[a + 2] - data[b + 2]
  return dr * dr + dg * dg + db * db
}

/**
 * Clears an image's flat backdrop, returning a transparent-background data URL.
 *
 * League logos are uploaded as JPEGs, so a "transparent" logo arrives with its backdrop baked into
 * the pixels — CSS can't reach it. We flood-fill inward from the edges instead of clearing every
 * matching pixel, so a subject that happens to share the backdrop color keeps its interior.
 *
 * Returns `undefined` until the work finishes, and whenever it can't be done: no flat background,
 * a load failure, or a canvas the browser considers tainted. Callers fall back to the raw src.
 */
export function useKeyedImage(src?: string) {
  // Stored with the src it came from, so switching leagues drops the previous logo's result during
  // render rather than showing it for a frame against the new league's name.
  const [keyed, setKeyed] = React.useState<{ src: string; url: string }>()

  React.useEffect(() => {
    if (!src || typeof document === "undefined") return

    let cancelled = false
    const image = new Image()
    image.crossOrigin = "anonymous"

    image.onload = () => {
      if (cancelled) return
      try {
        const url = keyOutBackground(image)
        if (!cancelled && url) setKeyed({ src, url })
      } catch {
        // A tainted canvas throws on getImageData; the raw image is a fine fallback.
      }
    }
    image.src = src

    return () => {
      cancelled = true
    }
  }, [src])

  return keyed && keyed.src === src ? keyed.url : undefined
}

function keyOutBackground(image: HTMLImageElement) {
  const width = image.naturalWidth
  const height = image.naturalHeight
  if (!width || !height) return undefined

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return undefined

  context.drawImage(image, 0, 0)
  const picture = context.getImageData(0, 0, width, height)
  const data = picture.data

  // The corners must agree, or the backdrop isn't flat and keying would eat real content.
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + width - 1) * 4,
  ]
  if (corners.some((corner) => distanceSquared(data, corner, corners[0]) > CORNER_AGREEMENT)) {
    return undefined
  }
  const background = corners[0]

  // Flood fill from every edge pixel, clearing background-colored pixels as we reach them.
  const seen = new Uint8Array(width * height)
  const stack: number[] = []
  const push = (x: number, y: number) => {
    const pixel = y * width + x
    if (seen[pixel]) return
    seen[pixel] = 1
    if (distanceSquared(data, pixel * 4, background) <= MATCH_TOLERANCE) stack.push(pixel)
  }

  for (let x = 0; x < width; x++) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    push(0, y)
    push(width - 1, y)
  }

  let cleared = 0
  while (stack.length) {
    const pixel = stack.pop()!
    data[pixel * 4 + 3] = 0
    cleared++
    const x = pixel % width
    const y = (pixel - x) / width
    if (x > 0) push(x - 1, y)
    if (x < width - 1) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y < height - 1) push(x, y + 1)
  }

  // Nothing removed means there was no backdrop to remove; keep the original.
  if (cleared === 0) return undefined

  context.putImageData(picture, 0, 0)
  return canvas.toDataURL("image/png")
}
