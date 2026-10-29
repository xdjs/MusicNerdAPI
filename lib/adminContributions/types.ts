/** The contributions list's filters, as applied; empty strings for none. */
export type AdminContributionsQuery = {
  userId: string;
  query: string;
  origin: string;
  type: string;
  status: string;
  page: number;
};

/** Where a contribution came from. */
export type ContributionOrigin = "user" | "research" | "unknown";

/** One contribution on the admin contributions page. */
export type Contribution = {
  id: string;
  type: "link" | "lore" | "upload";
  origin: ContributionOrigin;
  artistId: string;
  artistName: string | null;
  title: string | null;
  url: string | null;
  userId: string | null;
  username: string | null;
  email: string | null;
  actorKind: string | null;
  status: string;
  createdAt: string | null;
  trigger: string | null;
  activityId: string | null;
};
