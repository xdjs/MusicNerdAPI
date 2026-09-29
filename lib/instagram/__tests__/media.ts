import { vi } from "vitest";

/**
 * A fetch response carrying an image body, for the thumbnail tests.
 *
 * @param body - The bytes the reader yields.
 * @param type - The content-type header.
 * @param length - The content-length header, if any.
 * @returns A minimal Response-shaped object.
 */
export function media(body: Buffer, type = "image/jpeg", length?: string) {
  let done = false;
  return {
    ok: true,
    headers: { get: (key: string) => (key === "content-type" ? type : (length ?? null)) },
    body: {
      getReader: () => ({
        read: async () => (done ? { done: true } : ((done = true), { done: false, value: body })),
        cancel: vi.fn(),
      }),
    },
  };
}
