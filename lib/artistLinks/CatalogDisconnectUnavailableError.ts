/** A fail-closed migration/permission/storage failure, without private SQL parameters. */
export class CatalogDisconnectUnavailableError extends Error {
  constructor() {
    super(
      "Catalog disconnect could not be confirmed. Refresh the profile before retrying; if the account is still connected, try again after the service is ready.",
    );
    this.name = "CatalogDisconnectUnavailableError";
  }
}
