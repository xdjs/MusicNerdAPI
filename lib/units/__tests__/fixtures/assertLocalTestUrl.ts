import postgres from "postgres";

const LOCAL = new Set(["localhost", "127.0.0.1"]);
/** URL options that name a server in place of, or beside, the URL's host. */
const HOST_OPTIONS = ["host", "hostaddr"];

/**
 * Throws unless every server a test database URL can reach is local, since the test creates and
 * drops a database there. The hosts are read the way postgres-js reads them (a list such as
 * `localhost,db.example.com` connects to either), and a `host` or `hostaddr` option must be local
 * too, whatever this driver version does with it.
 *
 * @param url - The test database URL.
 */
export async function assertLocalTestUrl(url: string): Promise<void> {
  const client = postgres(url, { max: 1 });
  const hosts = [...client.options.host];
  await client.end({ timeout: 0 });
  for (const option of HOST_OPTIONS)
    for (const value of new URL(url).searchParams.getAll(option)) hosts.push(...value.split(","));
  const remote = hosts.map(host => host.trim()).filter(host => !LOCAL.has(host));
  if (remote.length)
    throw new Error(
      `MUSICNERD_UNITS_TEST_URL must point at localhost or 127.0.0.1, got ${remote.join(", ")}; this test creates and drops a database.`,
    );
}
