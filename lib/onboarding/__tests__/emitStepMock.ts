import { vi } from "vitest";

/**
 * An `emitStep` double that yields one marker event naming the step.
 *
 * @returns The mock.
 */
export function emitStepMock() {
  return vi.fn(async function* (_artistId: string, step: string, _opts?: object) {
    yield { kind: "step", step, payload: null };
  });
}
