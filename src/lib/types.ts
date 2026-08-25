export type NflState = { season: string; week: number | null; display_week?: number; season_type: "pre" | "regular" | "post" | "off" };
export type SleeperLeague = { league_id: string; name: string; season: string; sport: string; status: string; avatar: string | null; previous_league_id: string | null; roster_positions: string[]; scoring_settings: Record<string, number>; metadata?: Record<string, string>; settings: Record<string, number> & { divisions?: number; num_teams?: number } };
export type SleeperUser = { user_id: string; display_name: string; username: string; avatar: string | null; metadata?: { team_name?: string } };
export type SleeperRoster = { roster_id: number; owner_id: string | null; players: string[] | null; starters: string[] | null; taxi: string[] | null; reserve: string[] | null; settings: { division?: number; wins?: number; losses?: number; ties?: number; fpts?: number; fpts_decimal?: number; fpts_against?: number; fpts_against_decimal?: number } };
export type SleeperMatchup = { matchup_id: number | null; roster_id: number; points: number; starters: string[] | null; starters_points: number[] | null; players_points: Record<string, number> | null };
export type SleeperTransaction = { transaction_id: string; type: "trade" | "waiver" | "free_agent"; status: string; created: number; roster_ids: number[]; adds: Record<string, number> | null; drops: Record<string, number> | null; draft_picks: SleeperTradedPick[] | null; waiver_budget: { sender: number; receiver: number; amount: number }[] | null; settings?: { waiver_bid?: number } };
/** A traded draft slot. `owner_id` holds it now; `roster_id` is the roster whose original slot it is. */
export type SleeperTradedPick = { season: string; round: number; roster_id: number; previous_owner_id: number | null; owner_id: number; draft_id?: number | string };
export type SleeperDraft = { draft_id: string; league_id: string; season: string; status: string; type: string; settings: { teams?: number; rounds?: number }; metadata?: { name?: string; description?: string } };
/**
 * One bracket game. `w`/`l` are the winning and losing roster ids, and `p` — present only on the
 * placement games — is the finish those two rosters are playing for (`p: 1` is the championship,
 * so the loser takes 2nd).
 */
export type SleeperBracketGame = { m: number; r: number; t1: number | null; t2: number | null; w: number | null; l: number | null; p?: number };
export type SleeperDraftPick = { player_id: string; picked_by: string; roster_id: number; round: number; draft_slot: number; pick_no: number; metadata?: { first_name?: string; last_name?: string; position?: string; team?: string } };
export type StandingRow = { rank: number; rosterId: number; division: number; name: string; manager: string; avatar: string | null; wins: number; losses: number; ties: number; pointsFor: number; pointsAgainst: number; value: number | null };
export type MatchupPair = { id: number; home: StandingRow; away: StandingRow; homeScore: number; awayScore: number };
export type ActivityItem = {
  id: string;
  type: string;
  detail: string;
  time: string;
  kind: "trade" | "add" | "drop";
  team: string | null;
  adds: NflPlayer[];
  drops: NflPlayer[];
  bid: number | null;
};
/** `avatar` is Sleeper's avatar id, not a URL — see `leagueAvatarUrl`. */
export type LeagueOption = { id: string; name: string; season: string; status: string; type: string; isDynasty: boolean; avatar: string | null };
export type LeagueDivision = { id: number; name: string };
export type SleeperAccount = { userId: string; username: string; displayName: string; avatar: string | null; leagues: LeagueOption[] };
export type DashboardData = { league: { id: string; name: string; season: string; teams: number; type: string; isDynasty: boolean; superflex: boolean; divisions: LeagueDivision[] }; state: { week: number; matchupWeek: number; seasonType: string }; standings: StandingRow[]; matchups: MatchupPair[]; featuredMatchup?: MatchupPair; activity: ActivityItem[]; account?: SleeperAccount; myRosterId?: number };

export type NflPlayer = { id: string; name: string; position: string | null; team: string | null; age: number | null; yearsExp: number | null; injuryStatus: string | null; injuryBodyPart: string | null; practiceParticipation: string | null; number: number | null; espnId: number | null; searchRank: number | null; depthChartOrder: number | null; status: string | null };
export type RosterSlot = { slot: string; player: NflPlayer | null; points: number | null; projection: number | null; projectionOpponent: string | null; projectionHome: boolean | null; game: PlayerGame | null };
export type RosterGroup = { label: string; slots: RosterSlot[] };
export type TeamRoster = { rosterId: number; name: string; manager: string; avatar: string | null; record: string; pointsFor: number; groups: RosterGroup[]; counts: Record<string, number> };
export type MatchupSide = { team: StandingRow; score: number; projectedScore: number | null; slots: RosterSlot[]; benchPoints: number };
export type MatchupDetail = { id: number; home: MatchupSide; away: MatchupSide; homeWinProbability: number | null; awayWinProbability: number | null };
export type TransactionAsset = { rosterId: number; teamName: string; adds: NflPlayer[]; drops: NflPlayer[]; picks: string[]; faab: number | null };
export type TransactionEntry = { id: string; type: "trade" | "waiver" | "free_agent"; status: string; week: number; created: number; time: string; bid: number | null; sides: TransactionAsset[] };
export type PlayerGame = { opponent: string | null; home: boolean; kickoff: string | null; state: "pre" | "in" | "post"; detail: string; bye: boolean };
