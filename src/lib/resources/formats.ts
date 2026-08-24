// The league formats the resource catalogue is tagged against. Rankings and
// strategy diverge sharply between them — a dynasty trade value chart is
// actively wrong in a redraft league — so every resource declares which
// formats it actually applies to and the page filters on that.
export type ResourceFormat = "dynasty" | "redraft" | "guillotine";

export const RESOURCE_FORMAT_LABEL: Record<ResourceFormat, string> = {
  dynasty: "Dynasty",
  redraft: "Redraft",
  guillotine: "Guillotine",
};

export function isResourceFormat(value: string | undefined): value is ResourceFormat {
  return value === "dynasty" || value === "redraft" || value === "guillotine";
}

/**
 * The filter to preselect for a league, from `describeLeagueType`'s label.
 * Sleeper has no guillotine format, so only dynasty and redraft are reachable;
 * keeper leagues carry a partial roster forward but draft like redraft every
 * year, so redraft rankings are the better default for them.
 */
export function defaultFormatForLeague(leagueType: string): ResourceFormat {
  return leagueType.toLowerCase() === "dynasty" ? "dynasty" : "redraft";
}
