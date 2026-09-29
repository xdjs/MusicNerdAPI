/**
 * A delay.
 *
 * @param ms - How long.
 * @returns Once the time has passed.
 */
export function wait(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(() => resolve(), ms));
}
