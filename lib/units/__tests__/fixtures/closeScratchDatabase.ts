type Closable = { end(options?: { timeout?: number }): Promise<unknown> };

/**
 * Tears down a real-Postgres test's scratch database: closes the test client, drops the database
 * through the admin connection and closes that, each step running even when an earlier one fails,
 * so a client that will not close never leaves the database behind. The first error is rethrown
 * once everything has run.
 *
 * @param input.client - The connection to the scratch database, if one was opened.
 * @param input.admin - The connection to the server's default database, if one was opened.
 * @param input.scratch - The scratch database's name; empty when none was created.
 */
export async function closeScratchDatabase(input: {
  client?: Closable;
  admin?: Closable & { unsafe(query: string): Promise<unknown> };
  scratch: string;
}): Promise<void> {
  const { client, admin, scratch } = input;
  const errors: unknown[] = [];
  const attempt = async (step: () => Promise<unknown> | undefined) => {
    try {
      await step();
    } catch (error) {
      errors.push(error);
    }
  };
  await attempt(() => client?.end({ timeout: 5 }));
  if (admin && scratch)
    await attempt(() => admin.unsafe(`drop database if exists ${scratch} with (force)`));
  await attempt(() => admin?.end({ timeout: 5 }));
  if (errors.length) throw errors[0];
}
