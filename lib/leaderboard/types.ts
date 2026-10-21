/** One contributor on the leaderboard, as the SQL returns it. The all-time
 *  counts arrive as numeric strings (`COUNT(*)` is a bigint), a period's as
 *  integers (`::int`); MusicNerdWeb returned them that way too. */
export type LeaderboardEntry = {
  userId: string;
  wallet: string | null;
  username: string | null;
  email: string | null;
  artistsCount: number | string;
  ugcCount: number | string;
  isHidden: boolean;
};
