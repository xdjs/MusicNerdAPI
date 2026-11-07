/**
 * Compatibility hook: staging cleanup is deferred until object generations can
 * be fenced. A signed PUT may recreate this key after deletion; removing by path
 * can delete a concurrent replacement. Use bucket retention/lifecycle review,
 * not an unversioned request-time delete. No storage operation is performed.
 *
 * @param _path - Staged key retained for the eventual lifecycle contract.
 * @returns Nothing. This does not assert that physical cleanup occurred.
 */
export async function removeStagedUpload(_path: string): Promise<void> {}
