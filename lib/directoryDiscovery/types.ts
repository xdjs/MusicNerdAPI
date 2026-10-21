/** What the directory-add research observer may see: a state and a public link fingerprint. */
export type DirectoryDiscoveryStatus = {
  state: "active" | "complete" | "failed" | "stopped";
  revision: string;
};
