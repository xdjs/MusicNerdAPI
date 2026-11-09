/** A direct provider column and saved mapping must not identify different artists. */
export class ProviderIdentityConflictError extends Error {
  constructor() {
    super("This artist ID has conflicting saved profiles. Please try searching by name.");
    this.name = "ProviderIdentityConflictError";
  }
}
