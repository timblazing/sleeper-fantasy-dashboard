import { getWeekGamesByTeam, getWeekHomeAwayByTeam } from "@/lib/espn";
import { getPlayerCatalog } from "@/lib/players";
import { getWeeklyProjections } from "@/lib/projections";
import { getPickCurve, getValues } from "@/lib/roster-audit";
import { getDraftPicks, getDraftTradedPicks, getLeague, getLeagueDrafts, getLeagueRosters, getLeagueUsers, getLosersBracket, getMatchups, getNflLeaguesForUsername, getNflState, getTransactions, getWinnersBracket } from "@/lib/sleeper";

/**
 * Every upstream read a page-data module makes, in one injectable record.
 *
 * The seam sits here rather than at `fetch` so a test can hand a module coherent league objects
 * instead of hand-rolled HTTP payloads. Members are typed off the live functions so a signature
 * change upstream breaks this file rather than silently drifting from it.
 */
export type LeagueSource = {
  getLeague: typeof getLeague;
  getNflState: typeof getNflState;
  getLeagueUsers: typeof getLeagueUsers;
  getLeagueRosters: typeof getLeagueRosters;
  getMatchups: typeof getMatchups;
  getTransactions: typeof getTransactions;
  getLeagueDrafts: typeof getLeagueDrafts;
  getDraftPicks: typeof getDraftPicks;
  /** Draft Grades separates the manager who used a slot from the one who originally owned it. */
  getDraftTradedPicks: typeof getDraftTradedPicks;
  /** League History walks `previous_league_id` back through seasons and reads each one's final bracket. */
  getWinnersBracket: typeof getWinnersBracket;
  getLosersBracket: typeof getLosersBracket;
  getPlayerCatalog: typeof getPlayerCatalog;
  getValues: typeof getValues;
  /** The pick-number → value curve Draft Grades benchmarks each selection against. */
  getPickCurve: typeof getPickCurve;
  getNflLeaguesForUsername: typeof getNflLeaguesForUsername;
  /**
   * Not in the Sleeper/RosterAudit set, but on the same seam: without these, a test of the
   * matchup or roster board would reach the real ESPN and projection feeds over the network.
   */
  getWeekGamesByTeam: typeof getWeekGamesByTeam;
  getWeekHomeAwayByTeam: typeof getWeekHomeAwayByTeam;
  getWeeklyProjections: typeof getWeeklyProjections;
};

/** The production wiring. Page-data entry points default to this, so `src/app/**` passes nothing. */
export const liveSource: LeagueSource = {
  getLeague, getNflState, getLeagueUsers, getLeagueRosters, getMatchups, getTransactions,
  getLeagueDrafts, getDraftPicks, getDraftTradedPicks, getPlayerCatalog, getValues, getPickCurve, getNflLeaguesForUsername,
  getWinnersBracket, getLosersBracket,
  getWeekGamesByTeam, getWeekHomeAwayByTeam, getWeeklyProjections,
};
