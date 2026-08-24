# API Endpoints Guide — ESPN, Sleeper, and RosterAudit

> Practical endpoint reference for NFL and fantasy-football applications.
>
> Last reviewed: **2026-08-18**

This guide combines:

- Sleeper's official public API documentation
- Community documentation for ESPN's undocumented public APIs
- RosterAudit's official developer documentation
- Live-verification notes from the original project, including observed API behavior that differs from documentation

The examples are NFL-focused, but most ESPN URL patterns work for other sports by changing the sport and league slugs.

---

## Table of Contents

1. [Quick reference](#1-quick-reference)
2. [Sleeper API](#2-sleeper-api)
3. [ESPN public API](#3-espn-public-api)
4. [RosterAudit API](#4-rosteraudit-api)
5. [Joining data across the APIs](#5-joining-data-across-the-apis)
6. [Caching and request strategy](#6-caching-and-request-strategy)
7. [Sources](#7-sources)

---

# 1. Quick reference

| API | Base URL | Auth | Best use |
|---|---|---|---|
| Sleeper | `https://api.sleeper.app/v1` | None | Fantasy leagues, rosters, matchups, transactions, drafts, player IDs |
| Sleeper stats/projections | `https://api.sleeper.com` | None | Undocumented player stats and projections |
| ESPN Site API | `https://site.api.espn.com/apis/site/v2/sports/football/nfl` | None | Scores, schedules, teams, rosters, news, game summaries |
| ESPN Core API | `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl` | None | Detailed stats, events, odds, play-by-play, season structure |
| ESPN Web API | `https://site.web.api.espn.com/apis` | None | Athlete pages, gamelogs, splits, search, league-wide player stats |
| ESPN CDN | `https://cdn.espn.com/core/nfl` | None | Lightweight/live scoreboard and game polling |
| ESPN Fantasy | `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl` | None for generic data | Fantasy projections, ownership, draft ranks, bye weeks |
| RosterAudit | `https://rosteraudit.com/wp-json/ra/v1` | Mostly public; some endpoints require `X-RA-Key` | Dynasty rankings, player values, picks, trades, projections, league history |

## Recommended division of responsibility

Use each API for what it is best at:

- **Sleeper** is the source of truth for the user's fantasy league.
- **ESPN** enriches fantasy data with NFL teams, games, player stats, news, odds, and live game context.
- **RosterAudit** adds dynasty-specific values, rankings, draft-pick values, projections, trade analysis, and historical league analytics.

A common flow is:

```text
Sleeper league
  -> Sleeper player_id
  -> Sleeper player.espn_id
  -> ESPN athlete/game data

Sleeper player_id
  -> RosterAudit sleeper_id
  -> dynasty value/rank/projection
```

---

# 2. Sleeper API

## 2.1 Basics

Documented base URL:

```text
https://api.sleeper.app/v1
```

Sleeper's documented API is:

- read-only
- public
- free for non-commercial use
- no API token required

Sleeper recommends staying below roughly **1,000 requests per minute** to avoid IP blocking.

For commercial use, consult Sleeper about licensing.

### Current NFL state

Do not calculate the current NFL week manually. Ask Sleeper:

```http
GET https://api.sleeper.app/v1/state/nfl
```

Example:

```bash
curl "https://api.sleeper.app/v1/state/nfl"
```

Useful fields include:

```json
{
  "week": 1,
  "season": "2026",
  "season_type": "pre",
  "display_week": 1,
  "previous_season": "2025"
}
```

Use this endpoint to bootstrap season/week context.

---

## 2.2 User endpoints

### Get a user

```http
GET /user/{username}
GET /user/{user_id}
```

Examples:

```bash
curl "https://api.sleeper.app/v1/user/someusername"
curl "https://api.sleeper.app/v1/user/12345678"
```

Typical response:

```json
{
  "user_id": "12345678",
  "username": "sleeperuser",
  "display_name": "SleeperUser",
  "avatar": "cc12ec49965eb7856f84d71cf85306af"
}
```

### Usage note

Store `user_id`, not only `username`. Usernames can change.

---

## 2.3 League endpoints

### Get a user's leagues

```http
GET /user/{user_id}/leagues/nfl/{season}
```

Example:

```bash
curl "https://api.sleeper.app/v1/user/12345678/leagues/nfl/2026"
```

Use this to discover a user's `league_id` values.

### Get one league

```http
GET /league/{league_id}
```

Example:

```bash
curl "https://api.sleeper.app/v1/league/123456789012345678"
```

Important fields:

```text
league_id
name
season
status
settings
scoring_settings
roster_positions
previous_league_id
draft_id
```

`scoring_settings` is particularly useful because it allows you to calculate fantasy points from raw stat data using the league's actual scoring rules.

### Get league users

```http
GET /league/{league_id}/users
```

Example:

```bash
curl "https://api.sleeper.app/v1/league/123456789012345678/users"
```

Use this to map `user_id` to manager display names and optional custom team names.

### Get rosters

```http
GET /league/{league_id}/rosters
```

Example:

```bash
curl "https://api.sleeper.app/v1/league/123456789012345678/rosters"
```

Important roster fields:

```text
roster_id
owner_id
co_owners
players
starters
reserve
taxi
settings
```

Join:

```text
roster.owner_id -> league user.user_id
```

### Get weekly matchups

```http
GET /league/{league_id}/matchups/{week}
```

Example:

```bash
curl "https://api.sleeper.app/v1/league/123456789012345678/matchups/1"
```

Sleeper returns **one object per roster**, not one object per matchup.

Pair teams by `matchup_id`:

```text
roster A matchup_id = 4
roster B matchup_id = 4
-> they are playing each other
```

Useful fields:

```text
roster_id
matchup_id
points
players
starters
players_points
starters_points
```

Notes:

- `players_points` can include bench players.
- `starters_points` is aligned with `starters`.
- `points` is already the team's matchup total.

### Transactions

```http
GET /league/{league_id}/transactions/{round}
```

For NFL fantasy leagues, `round` normally corresponds to the week.

Example:

```bash
curl "https://api.sleeper.app/v1/league/123456789012345678/transactions/4"
```

Useful for:

- trades
- waiver claims
- free-agent adds
- drops
- FAAB spending

### Traded picks

```http
GET /league/{league_id}/traded_picks
```

Example:

```bash
curl "https://api.sleeper.app/v1/league/123456789012345678/traded_picks"
```

This is useful for dynasty leagues because it includes future draft-pick ownership.

### Playoff brackets

```http
GET /league/{league_id}/winners_bracket
GET /league/{league_id}/losers_bracket
```

Examples:

```bash
curl "https://api.sleeper.app/v1/league/123456789012345678/winners_bracket"
curl "https://api.sleeper.app/v1/league/123456789012345678/losers_bracket"
```

Bracket objects use `roster_id` values rather than user IDs.

---

## 2.4 Draft endpoints

### Get drafts for a user

```http
GET /user/{user_id}/drafts/nfl/{season}
```

### Get drafts for a league

```http
GET /league/{league_id}/drafts
```

### Get one draft

```http
GET /draft/{draft_id}
```

### Get draft picks

```http
GET /draft/{draft_id}/picks
```

Example:

```bash
curl "https://api.sleeper.app/v1/draft/123456789012345678/picks"
```

Useful fields:

```text
pick_no
round
draft_slot
roster_id
player_id
picked_by
metadata
```

### Get traded picks for a draft

```http
GET /draft/{draft_id}/traded_picks
```

---

## 2.5 Player endpoints

### Fetch the player map

```http
GET /players/nfl
```

Example:

```bash
curl "https://api.sleeper.app/v1/players/nfl"
```

This returns a large map:

```json
{
  "4984": {
    "player_id": "4984",
    "full_name": "Josh Allen",
    "position": "QB",
    "team": "BUF",
    "active": true,
    "espn_id": 3918298
  }
}
```

The full response is large. Sleeper explicitly recommends caching it and fetching it **no more than once per day**.

### Filter player results

Sleeper now documents optional `position` and `active` filters:

```http
GET /players/nfl?position=QB
GET /players/nfl?active=true
GET /players/nfl?position=QB&active=true
```

Examples:

```bash
curl "https://api.sleeper.app/v1/players/nfl?position=QB&active=true"
```

These are preferable when you only need a subset of players.

### Important player fields

Useful fields frequently include:

```text
player_id
full_name
first_name
last_name
position
fantasy_positions
team
active
status
injury_status
injury_body_part
practice_participation
depth_chart_position
depth_chart_order
number
age
years_exp
search_rank
espn_id
gsis_id
sportradar_id
yahoo_id
```

The `espn_id` field is the easiest way to join Sleeper players to ESPN.

### Team defenses

Sleeper team-defense IDs are strings such as:

```text
BUF
SF
DAL
```

Do not assume every `player_id` is numeric.

---

## 2.6 Trending players

```http
GET /players/nfl/trending/add
GET /players/nfl/trending/drop
```

Optional parameters:

```text
lookback_hours
limit
```

Examples:

```bash
curl "https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=25"
curl "https://api.sleeper.app/v1/players/nfl/trending/drop?lookback_hours=24&limit=25"
```

Response:

```json
[
  {
    "player_id": "1111",
    "count": 45
  }
]
```

Good uses:

- waiver-wire trending list
- most-added players
- most-dropped players

Sleeper asks for attribution when displaying trending data.

---

## 2.7 Sleeper CDN

User/league avatars:

```text
https://sleepercdn.com/avatars/{avatar_id}
https://sleepercdn.com/avatars/thumbs/{avatar_id}
```

Common player/team image patterns used by Sleeper:

```text
https://sleepercdn.com/content/nfl/players/{player_id}.jpg
https://sleepercdn.com/images/team_logos/nfl/{lowercase_team_abbr}.png
```

---

## 2.8 Undocumented Sleeper stats and projections

> These endpoints are used by Sleeper's own application but are **not part of the documented `api.sleeper.app/v1` API**. Treat them as unstable implementation details.

Base URL:

```text
https://api.sleeper.com
```

### Weekly stats for many players

```http
GET /stats/nfl/{season}/{week}
```

Example:

```bash
curl "https://api.sleeper.com/stats/nfl/2026/1?season_type=regular&position[]=QB&position[]=RB&order_by=pts_ppr"
```

### Weekly projections for many players

```http
GET /projections/nfl/{season}/{week}
```

Example:

```bash
curl "https://api.sleeper.com/projections/nfl/2026/1?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&order_by=pts_ppr"
```

### One player's season totals

```http
GET /stats/nfl/player/{player_id}?season_type=regular&season={season}
GET /projections/nfl/player/{player_id}?season_type=regular&season={season}
```

Examples:

```bash
curl "https://api.sleeper.com/stats/nfl/player/4984?season_type=regular&season=2025"
curl "https://api.sleeper.com/projections/nfl/player/4984?season_type=regular&season=2026"
```

### One player's week-by-week data

Add:

```text
grouping=week
```

Example:

```bash
curl "https://api.sleeper.com/stats/nfl/player/4984?season_type=regular&season=2025&grouping=week"
```

Observed response shape:

```json
{
  "date": "2025-09-07",
  "week": 1,
  "season": "2025",
  "season_type": "regular",
  "player_id": "4984",
  "category": "stat",
  "stats": {
    "pass_yd": 250,
    "pass_td": 2,
    "rush_yd": 45,
    "pts_ppr": 24.5
  }
}
```

Useful stat keys can include raw football statistics and precomputed fantasy scoring such as:

```text
pass_yd
pass_td
pass_att
rush_yd
rush_att
rec
rec_yd
rec_tgt
fum_lost
off_snp
tm_off_snp
pts_std
pts_half_ppr
pts_ppr
pos_rank_ppr
```

### Re-score projections using league settings

Instead of blindly trusting `pts_ppr`, you can use raw projected stats and Sleeper's league scoring settings:

```ts
function scoreStats(
  stats: Record<string, number>,
  scoring: Record<string, number>,
) {
  return Object.entries(scoring).reduce((total, [key, multiplier]) => {
    return total + (stats[key] ?? 0) * multiplier;
  }, 0);
}
```

---

# 3. ESPN public API

## 3.1 Important warning

ESPN does **not** publish or support these endpoints as an official developer API.

They are undocumented APIs used by ESPN's websites/apps and have been reverse-engineered by the community. They can change without notice.

Most of the endpoints below require no authentication.

No official public rate limits are published. Cache responses and avoid aggressive polling.

---

## 3.2 ESPN hosts

ESPN exposes several useful API families.

| Host | Use it for |
|---|---|
| `site.api.espn.com` | Scoreboards, schedules, teams, rosters, news, game summaries |
| `sports.core.api.espn.com` | Detailed normalized resources, events, stats, odds, plays, season structure |
| `site.web.api.espn.com` | Athlete overview, gamelogs, stats, splits, search |
| `cdn.espn.com` | CDN-cached live game and scoreboard payloads |
| `lm-api-reads.fantasy.espn.com` | ESPN fantasy player projections, ownership, draft ranks, schedules |
| `now.core.api.espn.com` | Real-time news feeds |

Useful constants:

```ts
const ESPN_SITE =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

const ESPN_CORE =
  "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";

const ESPN_WEB = "https://site.web.api.espn.com/apis";

const ESPN_CDN = "https://cdn.espn.com/core/nfl";

const ESPN_FANTASY =
  "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";
```

---

## 3.3 Scoreboard and schedules

### Current NFL scoreboard

```http
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard
```

Example:

```bash
curl "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
```

This is one of the best general-purpose ESPN endpoints.

Typical top-level fields:

```text
leagues
season
week
events
```

Each event commonly includes:

```text
id
date
name
shortName
competitions
status
```

Competition data commonly includes:

```text
competitors
score
homeAway
team
records
linescores
broadcasts
venue
leaders
odds
```

### Specific NFL week

```http
GET /scoreboard?dates={season}&seasontype={type}&week={week}
```

Example regular-season Week 1:

```bash
curl "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=1"
```

Season types:

| Value | Meaning |
|---|---|
| `1` | Preseason |
| `2` | Regular season |
| `3` | Postseason |
| `4` | Offseason |

### Specific date

```bash
curl "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=20260913"
```

Date format:

```text
YYYYMMDD
```

### Date range

```bash
curl "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=20260903-20270110&limit=1000"
```

### Entire season

```bash
curl "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&limit=1000"
```

This is an easy way to harvest ESPN event IDs for a season.

---

## 3.4 Live scoreboard through ESPN CDN

For lightweight game-day polling:

```http
GET https://cdn.espn.com/core/nfl/scoreboard?xhr=1
```

Example:

```bash
curl "https://cdn.espn.com/core/nfl/scoreboard?xhr=1&limit=50"
```

The `xhr=1` query parameter is important for CDN endpoints.

---

## 3.5 Full game summary

### Site API summary

```http
GET /summary?event={EVENT_ID}
```

Example:

```bash
curl "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401671808"
```

This is the best one-call game deep dive.

Depending on the event, the response can include:

```text
boxscore
leaders
drives
scoringPlays
winprobability
standings
injuries
odds
pickcenter
gameInfo
plays
videos
article
```

### CDN game endpoints

```http
GET https://cdn.espn.com/core/nfl/game?xhr=1&gameId={EVENT_ID}
GET https://cdn.espn.com/core/nfl/boxscore?xhr=1&gameId={EVENT_ID}
GET https://cdn.espn.com/core/nfl/playbyplay?xhr=1&gameId={EVENT_ID}
GET https://cdn.espn.com/core/nfl/matchup?xhr=1&gameId={EVENT_ID}
```

These are useful when a UI needs to poll only one portion of a game package.

---

## 3.6 ESPN Core API

The Core API is more normalized than the Site API.

Base:

```text
https://sports.core.api.espn.com/v2/sports/football/leagues/nfl
```

A major difference is that Core API resources frequently return `$ref` URLs instead of embedding the related object.

List endpoints commonly look like:

```json
{
  "count": 32,
  "pageIndex": 1,
  "pageSize": 25,
  "items": [
    {
      "$ref": "https://sports.core.api.espn.com/v2/..."
    }
  ]
}
```

Use `limit=` to reduce pagination where supported:

```bash
curl "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/teams?limit=50"
```

### `.pvt` reference gotcha

Some ESPN responses contain internal references such as:

```text
sports.core.api.espn.pvt
```

If a `$ref` is otherwise valid but uses `.pvt`, replace it with:

```text
sports.core.api.espn.com
```

---

## 3.7 Season and week structure

### Season resource

```http
GET /seasons/{season}
```

Example:

```bash
curl "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026"
```

Useful for current season type and week metadata.

### Regular-season weeks

```http
GET /seasons/{season}/types/2/weeks
```

Example:

```bash
curl "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/weeks"
```

### Event IDs for a week

```http
GET /seasons/{season}/types/{season_type}/weeks/{week}/events
```

Example:

```bash
curl "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/weeks/1/events"
```

---

## 3.8 Teams

### All teams

```http
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams
```

Example:

```bash
curl "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams"
```

The team list is nested roughly as:

```text
sports[0].leagues[0].teams[].team
```

Do not hard-code ESPN numeric team IDs if you can avoid it. Build a map from this endpoint:

```ts
const teamsByAbbr = Object.fromEntries(
  data.sports[0].leagues[0].teams.map(({ team }) => [
    team.abbreviation,
    team.id,
  ]),
);
```

### One team

```http
GET /teams/{TEAM_ID}
```

Example:

```bash
curl "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/6"
```

### Team roster

```http
GET /teams/{TEAM_ID}/roster
```

```bash
curl "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/6/roster"
```

### Team schedule

```http
GET /teams/{TEAM_ID}/schedule?season={YEAR}
```

```bash
curl "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/6/schedule?season=2026"
```

### Depth chart

```http
GET /teams/{TEAM_ID}/depthcharts
```

```bash
curl "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/6/depthcharts"
```

### Injuries

```http
GET /teams/{TEAM_ID}/injuries
```

```bash
curl "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/6/injuries"
```

### Core team stats

Examples:

```bash
curl "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/teams/6/statistics"

curl "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/teams/6/leaders"

curl "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/teams/6/events"
```

---

## 3.9 Standings

A notable ESPN routing quirk: the community documentation reports that this path returns a stub:

```text
https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings
```

Use this instead:

```http
GET https://site.api.espn.com/apis/v2/sports/football/nfl/standings
```

Example:

```bash
curl "https://site.api.espn.com/apis/v2/sports/football/nfl/standings"
```

For conference-specific Core API standings:

```text
AFC group: 8
NFC group: 7
```

Examples:

```bash
curl "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/groups/8/standings"

curl "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/groups/7/standings"
```

---

## 3.10 Player and athlete endpoints

For NFL players, `{ATHLETE_ID}` is ESPN's numeric player ID.

When starting from Sleeper, this is usually:

```text
Sleeper player.espn_id
```

### Player overview

```http
GET https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{ATHLETE_ID}/overview
```

Example:

```bash
curl "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/3918298/overview"
```

This is an excellent endpoint for player cards because it can include profile information, current stats, upcoming game information, and news/context.

### Player gamelog

```http
GET .../athletes/{ATHLETE_ID}/gamelog
GET .../athletes/{ATHLETE_ID}/gamelog?season={YEAR}
```

Example:

```bash
curl "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/3918298/gamelog?season=2025"
```

### Player stats

```http
GET .../athletes/{ATHLETE_ID}/stats
```

### Player splits

```http
GET .../athletes/{ATHLETE_ID}/splits
```

### Player bio

```http
GET .../athletes/{ATHLETE_ID}/bio
```

### Player news

```http
GET .../athletes/{ATHLETE_ID}/news
```

### Headshot shortcut

No API request is needed if you already have an ESPN player ID:

```text
https://a.espncdn.com/i/headshots/nfl/players/full/{ATHLETE_ID}.png
```

Example:

```text
https://a.espncdn.com/i/headshots/nfl/players/full/3918298.png
```

---

## 3.11 Bulk athlete data

### Core v3 inline athlete list

```http
GET https://sports.core.api.espn.com/v3/sports/football/nfl/athletes?limit=20000&active=true
```

This is useful when you need a broad ESPN player map without following hundreds of Core v2 `$ref` links.

### Core v2 athlete list

```http
GET https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes?limit=1000&active=true
```

Core v2 is more reference-oriented and often requires follow-up requests.

---

## 3.12 League-wide player stats and leaders

### Web API player statistics

```http
GET https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byathlete
```

### Team statistics

```http
GET https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byteam
```

### Site API leaders

```http
GET https://site.api.espn.com/apis/site/v3/sports/football/nfl/leaders?season={YEAR}
```

Example:

```bash
curl "https://site.api.espn.com/apis/site/v3/sports/football/nfl/leaders?season=2026"
```

### Core leaders

```http
GET /seasons/{YEAR}/types/2/leaders
```

---

## 3.13 News

### NFL news

```http
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50
```

### Team news

```http
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?team={TEAM_ID}
```

### Athlete news

```http
GET https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{ATHLETE_ID}/news
```

### Fantasy-oriented player news

```http
GET https://site.api.espn.com/apis/fantasy/v2/games/ffl/news/players?playerId={ATHLETE_ID}&limit=50
```

---

## 3.14 Play-by-play, odds, and win probability

Core competition endpoints generally use this pattern:

```text
/events/{EVENT_ID}/competitions/{EVENT_ID}/...
```

For NFL games, the event and competition IDs are commonly the same.

### Plays

```http
GET /events/{EVENT_ID}/competitions/{EVENT_ID}/plays?limit=400
```

### Drives

```http
GET /events/{EVENT_ID}/competitions/{EVENT_ID}/drives
```

### Win probability

```http
GET /events/{EVENT_ID}/competitions/{EVENT_ID}/probabilities?limit=300
```

### Predictor

```http
GET /events/{EVENT_ID}/competitions/{EVENT_ID}/predictor
```

### Odds

```http
GET /events/{EVENT_ID}/competitions/{EVENT_ID}/odds
```

Example:

```bash
curl "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/401671808/competitions/401671808/odds"
```

---

## 3.15 ESPN Fantasy API

Generic ESPN Fantasy reads can be useful even if your league itself is hosted on Sleeper.

Base:

```text
https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl
```

### Player projections, ownership, and ranks

A high-value endpoint is:

```http
GET /seasons/{YEAR}/segments/0/leaguedefaults/3?view=kona_player_info
```

Use an `X-Fantasy-Filter` header to request more than the default result set.

Example:

```bash
curl \
  -H 'X-Fantasy-Filter: {"players":{"limit":2000,"sortPercOwned":{"sortPriority":4,"sortAsc":false}}}' \
  "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/segments/0/leaguedefaults/3?view=kona_player_info"
```

This can expose data such as:

- ESPN player ID
- percent owned
- percent started
- draft ranks
- auction values
- actual stats
- season projections
- weekly projections
- injury status
- positional eligibility

### Important filter gotcha

Without the `X-Fantasy-Filter` header, ESPN fantasy endpoints may return only a small/default subset, often 50 players.

### Pro-team schedules and bye weeks

```http
GET /seasons/{YEAR}?view=proTeamSchedules_wl
```

Example:

```bash
curl "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026?view=proTeamSchedules_wl"
```

This is a convenient source for NFL bye weeks.

---

## 3.16 ESPN search

### Prefix search

```http
GET https://site.web.api.espn.com/apis/common/v3/search?query={QUERY}&limit=10&mode=prefix&type=player,team&sport=football&league=nfl
```

Example:

```bash
curl "https://site.web.api.espn.com/apis/common/v3/search?query=allen&limit=10&mode=prefix&type=player,team&sport=football&league=nfl"
```

A richer search variant is also commonly used:

```http
GET https://site.web.api.espn.com/apis/search/v2?query={QUERY}&limit=100
```

---

## 3.17 ESPN usage gotchas

### The API is unofficial

Do not design your application as though these endpoints have a stable contractual schema.

Validate responses and tolerate missing fields.

### Core API `$ref` behavior

Core v2 frequently returns links instead of embedded objects. For UI-facing use cases, Site API or Web API endpoints are often easier.

### Team IDs are numeric and not alphabetical

Fetch `/teams` and build your own abbreviation-to-ID map.

### UTC dates

ESPN timestamps are commonly UTC. Prefer querying football by season/week rather than relying only on local calendar dates.

### Preseason week numbering

During preseason, ESPN week numbering can differ from Sleeper because ESPN's football calendar may count the Hall of Fame game separately. During the regular season, week numbers normally align.

---

# 4. RosterAudit API

## 4.1 Basics

Base URL:

```text
https://rosteraudit.com/wp-json/ra/v1
```

RosterAudit provides dynasty-focused data keyed heavily around **Sleeper player and league IDs**, which makes it a natural companion to Sleeper.

Most endpoints are public.

### API key

When using a RosterAudit API key:

```http
X-RA-Key: YOUR_API_KEY
```

Example:

```bash
curl \
  -H "X-RA-Key: $ROSTERAUDIT_API_KEY" \
  -H "User-Agent: MyFantasyApp/1.0" \
  "https://rosteraudit.com/wp-json/ra/v1/player-page/7564"
```

RosterAudit specifically requests a descriptive `User-Agent`. Generic/default Python and curl user agents may be blocked by its firewall.

### Keep the key server-side

Do not expose `X-RA-Key` from browser JavaScript.

Use a server route such as:

```text
browser
  -> /api/roster-audit/...
  -> RosterAudit with X-RA-Key
```

---

## 4.2 Rate limits

RosterAudit's documentation currently states:

```text
Most endpoints:       200 requests/minute
Trade calculator:      40 requests/hour without a key
Trade calculator:     120 requests/hour with a key
```

### Observed conflict

Live testing on **2026-08-17** found that `POST /trade/calculate` returned `401 API key required` without a key.

Until retested, treat `/trade/calculate` as **key-required in production**, even though the developer page describes unauthenticated trade usage.

---

## 4.3 Player search

```http
GET /players/search
```

Common parameters:

```text
q
position
limit
format_key
```

Example:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/players/search?q=jamarr&limit=5"
```

Position example:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/players/search?position=RB&limit=10"
```

Typical response envelope:

```json
{
  "players": [
    {
      "sleeper_id": "7564",
      "name": "Ja'Marr Chase",
      "position": "WR",
      "team": "CIN",
      "val_sf": 9200,
      "val_1qb": 9500,
      "trend_7d": "120"
    }
  ],
  "attribution": "Values by RosterAudit.com",
  "attribution_url": "https://rosteraudit.com"
}
```

### Direct player lookup

Documented endpoint:

```http
GET /players/{sleeper_id}
```

Example:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/players/7564"
```

This endpoint was documented but had not been live-probed in the project's verification pass.

---

## 4.4 Dynasty rankings

```http
GET /rankings
```

Common parameters:

```text
format
preset
position
per_page
page
sort
min_age
max_age
league_size
search
```

Basic example:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/rankings?format=sf&position=WR&per_page=20"
```

1QB example:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/rankings?format=1qb&position=QB&per_page=20"
```

Young-player filter:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/rankings?format=sf&max_age=24&sort=value&per_page=20"
```

### Prefer `preset` when you need an exact format

Live testing found that `/rankings` responds correctly to the hyphenated `preset` key and can ignore `format_key`.

Example:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/rankings?preset=sf-ppr&position=WR&per_page=50"
```

Observed preset keys included:

```text
sf-ppr
sf-ppr-tep
1qb-ppr
1qb-ppr-tep
```

Do not assume the API's preset list is identical to the static format cheat sheet. Populate UI options from `/presets` where possible.

### `per_page` behavior

The developer docs say `1-100`.

Live testing found requests below 10 were clamped to:

```text
per_page = 10
```

Do not depend on receiving fewer than 10 records.

---

## 4.5 Lightweight value map

```http
GET /rankings/values?format_key={format_key}
```

Example:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/rankings/values?format_key=sf_ppr"
```

Observed response:

```json
{
  "7564": {
    "sf": 9200,
    "1qb": 9500
  },
  "6794": {
    "sf": 8800,
    "1qb": 6200
  }
}
```

Unlike many RosterAudit endpoints, this is a **bare map**, not an object containing a `players` array.

It may also omit attribution fields, so an application that must display attribution should keep a fallback attribution constant.

---

## 4.6 Draft-pick values

```http
GET /picks
```

Example:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/picks"
```

Observed response shape:

```json
{
  "picks": [
    {
      "id": 1,
      "pick_season": 2026,
      "pick_round": 1,
      "pick_slot": "early",
      "val_sf": 5005,
      "val_1qb": 5005,
      "label": "2026 Early 1st",
      "sort_order": 1
    }
  ],
  "pick_curve_sf": {},
  "pick_curve_1qb": {},
  "attribution": "Values by RosterAudit.com",
  "attribution_url": "https://rosteraudit.com"
}
```

### Rankings + picks

`/rankings` does **not** return draft picks even though RosterAudit's rankings UI can show them mixed with players.

If you want a combined dynasty asset ranking:

```text
1. GET /rankings
2. GET /picks
3. choose val_sf or val_1qb
4. normalize both into a shared asset shape
5. sort by value
```

RosterAudit says pick values are calibrated to the same value scale as players, so this merge is reasonable.

---

## 4.7 Movers

```http
GET /movers
```

Parameters:

```text
position
limit
```

Examples:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/movers?limit=10"

curl "https://rosteraudit.com/wp-json/ra/v1/movers?position=RB&limit=10"
```

Observed response envelope:

```json
{
  "risers": [],
  "fallers": [],
  "pct_movers": [],
  "updated": "...",
  "attribution": "Values by RosterAudit.com",
  "attribution_url": "https://rosteraudit.com"
}
```

### `pct_change` warning

The project's live verification found obviously incorrect `pct_change` values in `pct_movers`.

Use:

```text
trend_7d
trend_30d
```

and avoid displaying `pct_change` unless you re-verify that RosterAudit has fixed the upstream calculation.

### 1QB warning

Observed `/movers` records contained only `val_sf`, not `val_1qb`.

In a 1QB application, use movers for trend direction but do not mislabel `val_sf` as the league's 1QB value.

---

## 4.8 Scoring presets

```http
GET /presets
```

Example:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/presets"
```

Observed shape was a numerically-keyed object rather than an array:

```json
{
  "0": {
    "key": "sf-ppr",
    "label": "SF PPR",
    "format_key": "sf_ppr"
  },
  "1": {
    "key": "sf-ppr-tep",
    "label": "SF PPR TEP",
    "format_key": "sf_ppr_tep"
  },
  "attribution": "Values by RosterAudit.com",
  "attribution_url": "https://rosteraudit.com"
}
```

Do not simply run `Object.values()` and assume every result is a preset, because attribution strings can be mixed into the same object.

Filter by object shape:

```ts
const presets = Object.values(payload).filter(
  (value): value is Preset =>
    typeof value === "object" &&
    value !== null &&
    "key" in value &&
    "format_key" in value,
);
```

### Two key styles

RosterAudit uses two similar but different identifiers:

```text
preset key:  sf-ppr-tep
format_key:  sf_ppr_tep
```

Observed usage:

```text
/rankings       -> preset=sf-ppr-tep
/rankings/values -> format_key=sf_ppr_tep
```

Do not interchange them.

---

## 4.9 Player stats

Public endpoint:

```http
GET /player-stats/{sleeper_id}
```

Example:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/player-stats/9509"
```

Observed envelope:

```json
{
  "season": "2025",
  "weekly": [],
  "summary": {},
  "career": [],
  "attribution": "Values by RosterAudit.com",
  "attribution_url": "https://rosteraudit.com"
}
```

### Type inconsistency

Observed behavior:

- `weekly[]` values were mostly numbers
- `summary` and `career[]` often used numeric strings
- advanced metrics could be `null`
- `season` was a string

Validate and coerce external data instead of passing raw API objects directly into UI components.

---

## 4.10 Full player page

Key-backed endpoint:

```http
GET /player-page/{sleeper_id}
```

Example:

```bash
curl \
  -H "X-RA-Key: $ROSTERAUDIT_API_KEY" \
  -H "User-Agent: MyFantasyApp/1.0" \
  "https://rosteraudit.com/wp-json/ra/v1/player-page/7564"
```

RosterAudit describes this as a combined player payload containing dynasty value, history, stats, and cliff-risk information.

The original project verification confirmed that it returned `401` without a key but did not record a successful keyed response shape. Inspect a real successful response before tightly coupling UI fields to it.

### Weekly player-page stats

```http
GET /player-page/{sleeper_id}/weekly/{season}
```

Example:

```bash
curl \
  -H "X-RA-Key: $ROSTERAUDIT_API_KEY" \
  -H "User-Agent: MyFantasyApp/1.0" \
  "https://rosteraudit.com/wp-json/ra/v1/player-page/9509/weekly/2025"
```

Live testing also observed this endpoint to require a key.

---

## 4.11 Stats Explorer and leaderboard

### Stats Explorer

```http
GET /stats-explorer?position={POSITION}
```

Example:

```bash
curl \
  -H "X-RA-Key: $ROSTERAUDIT_API_KEY" \
  -H "User-Agent: MyFantasyApp/1.0" \
  "https://rosteraudit.com/wp-json/ra/v1/stats-explorer?position=RB"
```

### Leaderboard

```http
GET /stats/leaderboard
```

Example:

```bash
curl \
  -H "X-RA-Key: $ROSTERAUDIT_API_KEY" \
  -H "User-Agent: MyFantasyApp/1.0" \
  "https://rosteraudit.com/wp-json/ra/v1/stats/leaderboard"
```

The project's live verification observed `401` without a key for both endpoints.

---

## 4.12 Projection rankings

```http
GET /projections/ppg-rankings
```

Example:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/projections/ppg-rankings"
```

Observed response shape:

```json
{
  "rankings": [
    {
      "rank": 1,
      "sleeper_id": "4984",
      "name": "Josh Allen",
      "position": "QB",
      "team": "BUF",
      "ppg": 22.5,
      "dynasty_val": 9110,
      "dynasty_rank": 4,
      "stats": [
        {
          "year": 2026,
          "games": 17,
          "pass_yd": 4150,
          "pass_td": 30
        }
      ]
    }
  ],
  "attribution": "Values by RosterAudit.com",
  "attribution_url": "https://rosteraudit.com"
}
```

`stats[].year` may describe **future projection seasons**, not historical seasons. Label them accordingly.

---

## 4.13 Projection comparison

Documented endpoint:

```http
GET /projections/compare?ids={sleeper_id_1},{sleeper_id_2}
```

Example from the developer docs:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/projections/compare?ids=9509,7564"
```

### Known issue

Live verification on 2026-08-17 found this endpoint returned:

```json
{
  "error": "Provide 2-4 player sleeper_ids separated by commas"
}
```

for the documented input itself.

Treat this endpoint as **currently unreliable/broken** until you verify it again.

---

## 4.14 Embeddable projection

Documented endpoint:

```http
GET /projections/embed/{sleeper_id}
```

Example:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/projections/embed/9509"
```

The original verification pass did not record a successful response shape. Treat the payload as unverified until inspected.

---

## 4.15 Roster-grade projections

Documented endpoint:

```http
GET /projections/roster-grades
```

Observed working request requirements were more specific:

```http
GET /projections/roster-grades?league_id={league_id}&user_id={user_id}
```

Example:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/projections/roster-grades?league_id=123456789012345678&user_id=987654321"
```

Observed errors:

Missing parameters:

```json
{
  "error": "league_id and user_id required"
}
```

League has not been synced:

```json
{
  "error": "League not synced"
}
```

### Important consequence

This endpoint is per manager, not a single whole-league request.

For a league-wide roster-grade table:

```text
1. GET Sleeper /league/{league_id}/users
2. collect each user_id
3. request RosterAudit roster-grades for each manager
4. combine results
```

Do not classify every HTTP 400 as the same error. Inspect the JSON `error` field.

---

## 4.16 Trade calculator

```http
POST /trade/calculate
```

Recommended production request with key:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-RA-Key: $ROSTERAUDIT_API_KEY" \
  -H "User-Agent: MyFantasyApp/1.0" \
  -d '{
    "side_a": [
      { "type": "player", "id": "7564" }
    ],
    "side_b": [
      { "type": "player", "id": "5849" },
      { "type": "pick", "season": 2026, "round": 1, "slot": "mid" }
    ],
    "settings": {
      "is_superflex": true
    }
  }' \
  "https://rosteraudit.com/wp-json/ra/v1/trade/calculate"
```

Documented response shape:

```json
{
  "side_a": {
    "total_value": 9200,
    "assets": []
  },
  "side_b": {
    "total_value": 7800,
    "assets": []
  },
  "differential": 1400,
  "verdict": "Side A wins",
  "cliff_warnings": []
}
```

Pick slots can be:

```text
early
mid
late
```

or a numeric slot such as:

```json
{
  "type": "pick",
  "season": 2026,
  "round": 1,
  "slot": 3
}
```

### Response-shape warning

The original project did not capture a successful keyed response containing real `assets[]` and `cliff_warnings[]` entries.

Do not invent their nested schema. Inspect a real response first.

---

## 4.17 League history

RosterAudit league-history endpoints use Sleeper IDs.

The league must have been synced with RosterAudit at least once.

### Managers

```http
GET /league-history/{league_id}/managers
```

### Manager career

```http
GET /league-history/{league_id}/manager/{user_id}
```

### Head-to-head rivalry

```http
GET /league-history/{league_id}/h2h/{user_id_1}/{user_id_2}
```

### League records

```http
GET /league-history/{league_id}/records
```

### Championships

```http
GET /league-history/{league_id}/championships
```

### Seasons

```http
GET /league-history/{league_id}/seasons
```

Examples:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/league-history/123456789012345678/managers"

curl "https://rosteraudit.com/wp-json/ra/v1/league-history/123456789012345678/manager/987654321"

curl "https://rosteraudit.com/wp-json/ra/v1/league-history/123456789012345678/h2h/987654321/123123123"
```

Observed unsynced/unknown-league requests return HTTP 400 rather than 404.

No API key is required for the league-history endpoints.

### Verified response shapes (2026-08-21)

Every numeric field in these responses arrives as a **string**, so coerce rather than assume.

**`/managers`** — `{ league_group_id, managers: [...] }`. Each manager carries `user_id`,
`display_name`, `avatar`, `seasons_played`, `total_games`, `total_wins`, `total_losses`,
`total_ties`, `win_pct`, `total_pf`, `avg_pf_per_season`, `championships`, `runner_ups`,
`last_places`, `playoff_appearances`, `total_playoff_wins`, `total_playoff_losses`,
`highest_week_score`, `lowest_week_score`.

**`/manager/{user_id}`** — `{ totals, seasons: [...] }`. **`totals` does not match the field names
in `/managers`**: it omits `user_id` (it is in the path), `total_ties` and `playoff_appearances`,
renames `seasons_played` to `seasons`, and renames `total_playoff_wins` / `total_playoff_losses`
to `playoff_wins` / `playoff_losses`. Reusing the `/managers` schema here fails to parse.

Each `seasons` row carries `season`, `sleeper_league_id`, `roster_id`, `wins`, `losses`, `ties`,
`points_for`, `points_against`, **`max_points_for`**, `final_standing`, `made_playoffs`,
`playoff_wins`, `playoff_losses`, `won_championship`, `runner_up`, `last_place`, `max_week_score`,
`min_week_score`.

`max_points_for` is the optimal-lineup total and is the only place any API exposes it, which makes
`points_for / max_points_for` (lineup efficiency) computable. It is `0` for a season that has not
been played yet, so guard against dividing by zero.

**`/h2h/{a}/{b}`** — `{ total_matchups, wins_1, wins_2, draws, total_pts_1, total_pts_2, matchups,
by_season, user_id_1, user_id_2, name_1, name_2 }`. Sides follow the order the ids were passed in.
Each `matchups` row has `season`, `week`, `is_playoff`, `round_label`, `score_1`, `score_2`, and
`winner` (a user id). A pairing that has never met returns an empty `matchups` array, not a 400.

**`/seasons`**, **`/championships`**, **`/records`** are keyed by `league_group_id` and cover the
whole league lineage, so they need only the current Sleeper league id.

---

## 4.18 RosterAudit response normalization

RosterAudit has significant type inconsistencies between endpoints.

Example from a live rankings response:

```json
{
  "age": "24.5",
  "tier": "1",
  "trend_7d": "0",
  "buy_low": "0",
  "val_sf_market": "10000",
  "value": 10000,
  "rank_overall": 1
}
```

The same object can mix:

- numeric strings
- real numbers
- string booleans such as `"0"` and `"1"`
- nullable values

Normalize at your API boundary.

Example with Zod:

```ts
import { z } from "zod";

const Numeric = z.union([z.number(), z.string()]).transform(Number);

const StringBoolean = z
  .union([z.boolean(), z.literal("0"), z.literal("1")])
  .transform((value) => value === true || value === "1");

const RankingPlayerSchema = z.object({
  sleeper_id: z.string(),
  name: z.string(),
  age: Numeric.nullable().optional(),
  value: Numeric,
  rank_overall: Numeric,
  buy_low: StringBoolean.optional(),
});
```

Do not assume a field's type is consistent merely because another endpoint uses the same field name.

---

## 4.19 Attribution

RosterAudit requires attribution when displaying its values.

Use the response when available:

```json
{
  "attribution": "Values by RosterAudit.com",
  "attribution_url": "https://rosteraudit.com"
}
```

Render a visible link such as:

```html
<a href="https://rosteraudit.com">Values by RosterAudit.com</a>
```

Because `/rankings/values` may not include attribution fields, keep a fallback:

```ts
const ROSTER_AUDIT_ATTRIBUTION = {
  text: "Values by RosterAudit.com",
  url: "https://rosteraudit.com",
};
```

RosterAudit states that API keys which consistently strip required attribution may be revoked.

---

# 5. Joining data across the APIs

## 5.1 Sleeper -> ESPN player identity

Best path:

```text
Sleeper player_id
  -> GET /players/nfl
  -> player.espn_id
  -> ESPN athlete endpoints
```

Example:

```text
Sleeper player_id: 4984
Sleeper full_name: Josh Allen
Sleeper espn_id:   3918298
```

Then:

```bash
curl "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/3918298/overview"
```

### Fallback identity matching

If `espn_id` is missing:

1. normalize player names
2. remove punctuation from initials
3. remove suffixes such as `Jr.`, `Sr.`, `II`, `III`
4. constrain by position
5. constrain by current team when possible

Do not perform name-only matching without additional constraints if you can avoid it.

---

## 5.2 Sleeper -> RosterAudit player identity

RosterAudit uses Sleeper IDs directly.

Example:

```text
Sleeper player_id = "9509"
RosterAudit sleeper_id = "9509"
```

So no player-ID translation is normally required:

```bash
curl "https://rosteraudit.com/wp-json/ra/v1/player-stats/9509"
```

---

## 5.3 Sleeper -> RosterAudit league identity

RosterAudit league-history and roster-grade endpoints use Sleeper league/user IDs.

Example:

```text
Sleeper league_id -> RosterAudit league_id
Sleeper user_id   -> RosterAudit user_id
```

That makes integrations such as roster grades straightforward:

```text
GET Sleeper league users
  -> user_id[]
  -> GET RosterAudit roster-grades?league_id=...&user_id=...
```

---

## 5.4 Team abbreviations

Sleeper and ESPN mostly agree, but at least one known difference is:

| Team | Sleeper | ESPN |
|---|---|---|
| Washington | `WAS` | `WSH` |

Old Sleeper data may also contain stale abbreviations such as `OAK`; normalize those to the current franchise when needed.

A simple mapping layer is safer than assuming all providers use identical abbreviations.

---

## 5.5 Week alignment

During the regular season:

```text
Sleeper state.week
Sleeper matchup week
Sleeper transaction round
ESPN scoreboard week.number
ESPN Fantasy scoringPeriodId
```

normally refer to the same NFL week number.

Preseason can differ because ESPN may account for the Hall of Fame game differently.

---

# 6. Caching and request strategy

## 6.1 Suggested cache TTLs

These are application recommendations rather than API guarantees.

| Data | Suggested TTL |
|---|---|
| Sleeper `/players/nfl` | 24 hours |
| Sleeper league settings/users/rosters | 15-60 minutes |
| Sleeper matchups on game day | 30-60 seconds |
| ESPN team list | 24 hours |
| ESPN season structure / bye weeks | 24 hours |
| ESPN schedules / standings | 10-60 minutes |
| ESPN projections | 10-60 minutes |
| ESPN live scoreboard | 30-60 seconds |
| ESPN completed box score/gamelog | Cache indefinitely after final |
| RosterAudit presets | ~24 hours |
| RosterAudit picks | ~24 hours |
| RosterAudit rankings / movers / values | ~1-6 hours |
| RosterAudit projections/stats | ~1-6 hours |
| RosterAudit league history / roster grades | ~15 minutes |
| RosterAudit trade result | Short cache for identical requests |

---

## 6.2 Prefer server-side API adapters

Even when an upstream API is public, routing requests through your own server gives you:

- consistent caching
- retry control
- schema validation
- rate-limit handling
- logging
- provider failover
- protection for RosterAudit API keys
- fewer browser CORS surprises

Example architecture:

```text
React UI
  -> /api/fantasy/player/4984
      -> Sleeper
      -> ESPN
      -> RosterAudit
  <- normalized application-owned JSON
```

Do not pass raw provider payloads straight through to components if the application depends on them long-term.

---

## 6.3 Example normalized player endpoint

A server route can combine all three providers:

```ts
type PlayerSummary = {
  sleeperId: string;
  espnId: string | null;
  name: string;
  position: string;
  team: string | null;
  injuryStatus: string | null;
  dynasty: {
    value: number | null;
    rank: number | null;
    trend7d: number | null;
  };
  nfl: {
    recentGames: unknown[];
    news: unknown[];
  };
};
```

Call sequence:

```text
1. Sleeper cached player map
2. RosterAudit player/rankings data by Sleeper ID
3. ESPN player overview/gamelog by Sleeper espn_id
4. normalize into PlayerSummary
```

---

## 6.4 Example game-day workflow

```text
1. GET Sleeper /state/nfl
2. GET Sleeper /league/{id}/matchups/{week}
3. GET ESPN CDN /scoreboard?xhr=1
4. match rostered players to NFL teams/games
5. GET ESPN /summary?event={id} only for games the user opens
6. optionally enrich players with RosterAudit dynasty trends
```

This avoids repeatedly downloading expensive payloads for games the user is not viewing.

---

## 6.5 Example waiver-wire workflow

```text
1. GET Sleeper trending/add
2. GET all league rosters
3. remove already-rostered players
4. enrich remaining player IDs from cached Sleeper player map
5. get recent stats/projections from Sleeper's undocumented stats API
6. get ESPN overview/news using espn_id
7. optionally attach RosterAudit dynasty value/trend
```

---

## 6.6 Error handling recommendations

Normalize provider errors into application-owned categories such as:

```text
RATE_LIMITED
UPSTREAM_UNAVAILABLE
NOT_FOUND
INVALID_REQUEST
AUTH_REQUIRED
LEAGUE_NOT_SYNCED
EMPTY_DATA
```

RosterAudit particularly requires parsing the response body, not only the HTTP status.

For example, both of these can be HTTP 400:

```json
{ "error": "league_id and user_id required" }
```

```json
{ "error": "League not synced" }
```

Those should produce different UI states.

---

# 7. Sources

## Sleeper

Official documentation:

- https://docs.sleeper.com/

## ESPN

ESPN does not publish an official public developer API for these endpoints. The primary references used here are community reverse-engineering resources:

- https://github.com/pseudo-r/Public-ESPN-API
- https://github.com/pseudo-r/Public-ESPN-API/blob/main/docs/sports/football.md
- https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b

The `pseudo-r/Public-ESPN-API` repository is substantially broader and more current than the older gist and should generally be treated as the more useful reference.

## RosterAudit

Official developer documentation:

- https://rosteraudit.com/developers/

The RosterAudit notes in this guide also incorporate live API observations recorded on **2026-08-17**. Where those observations conflict with the developer page, the conflict is explicitly labeled rather than hidden.

---

# Appendix A — Copy/paste endpoint sheet

## Sleeper

```text
GET https://api.sleeper.app/v1/state/nfl
GET https://api.sleeper.app/v1/user/{username_or_user_id}
GET https://api.sleeper.app/v1/user/{user_id}/leagues/nfl/{season}
GET https://api.sleeper.app/v1/league/{league_id}
GET https://api.sleeper.app/v1/league/{league_id}/users
GET https://api.sleeper.app/v1/league/{league_id}/rosters
GET https://api.sleeper.app/v1/league/{league_id}/matchups/{week}
GET https://api.sleeper.app/v1/league/{league_id}/transactions/{week}
GET https://api.sleeper.app/v1/league/{league_id}/traded_picks
GET https://api.sleeper.app/v1/league/{league_id}/winners_bracket
GET https://api.sleeper.app/v1/league/{league_id}/losers_bracket
GET https://api.sleeper.app/v1/league/{league_id}/drafts
GET https://api.sleeper.app/v1/draft/{draft_id}
GET https://api.sleeper.app/v1/draft/{draft_id}/picks
GET https://api.sleeper.app/v1/draft/{draft_id}/traded_picks
GET https://api.sleeper.app/v1/players/nfl
GET https://api.sleeper.app/v1/players/nfl?position=QB&active=true
GET https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=25
GET https://api.sleeper.app/v1/players/nfl/trending/drop?lookback_hours=24&limit=25
```

Undocumented:

```text
GET https://api.sleeper.com/stats/nfl/{season}/{week}?season_type=regular
GET https://api.sleeper.com/projections/nfl/{season}/{week}?season_type=regular
GET https://api.sleeper.com/stats/nfl/player/{player_id}?season_type=regular&season={season}
GET https://api.sleeper.com/projections/nfl/player/{player_id}?season_type=regular&season={season}
```

## ESPN

```text
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates={YEAR}&seasontype=2&week={WEEK}
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={EVENT_ID}
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{TEAM_ID}
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{TEAM_ID}/roster
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{TEAM_ID}/schedule?season={YEAR}
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{TEAM_ID}/depthcharts
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{TEAM_ID}/injuries
GET https://site.api.espn.com/apis/v2/sports/football/nfl/standings
GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50
GET https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{ATHLETE_ID}/overview
GET https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{ATHLETE_ID}/gamelog?season={YEAR}
GET https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{ATHLETE_ID}/stats
GET https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{ATHLETE_ID}/splits
GET https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{ATHLETE_ID}/news
GET https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/{YEAR}
GET https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/{YEAR}/types/2/weeks
GET https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/{EVENT_ID}/competitions/{EVENT_ID}/plays?limit=400
GET https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/{EVENT_ID}/competitions/{EVENT_ID}/probabilities?limit=300
GET https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/{EVENT_ID}/competitions/{EVENT_ID}/odds
GET https://cdn.espn.com/core/nfl/scoreboard?xhr=1
GET https://cdn.espn.com/core/nfl/game?xhr=1&gameId={EVENT_ID}
GET https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{YEAR}?view=proTeamSchedules_wl
```

## RosterAudit

```text
GET  https://rosteraudit.com/wp-json/ra/v1/presets
GET  https://rosteraudit.com/wp-json/ra/v1/players/search?q={QUERY}&limit=10
GET  https://rosteraudit.com/wp-json/ra/v1/players/{SLEEPER_ID}
GET  https://rosteraudit.com/wp-json/ra/v1/rankings?preset=sf-ppr&per_page=50
GET  https://rosteraudit.com/wp-json/ra/v1/rankings/values?format_key=sf_ppr
GET  https://rosteraudit.com/wp-json/ra/v1/picks
GET  https://rosteraudit.com/wp-json/ra/v1/movers?limit=10
GET  https://rosteraudit.com/wp-json/ra/v1/player-stats/{SLEEPER_ID}
GET  https://rosteraudit.com/wp-json/ra/v1/player-page/{SLEEPER_ID}                        [KEY]
GET  https://rosteraudit.com/wp-json/ra/v1/player-page/{SLEEPER_ID}/weekly/{YEAR}         [KEY observed]
GET  https://rosteraudit.com/wp-json/ra/v1/stats-explorer?position=RB                      [KEY]
GET  https://rosteraudit.com/wp-json/ra/v1/stats/leaderboard                               [KEY]
GET  https://rosteraudit.com/wp-json/ra/v1/projections/ppg-rankings
GET  https://rosteraudit.com/wp-json/ra/v1/projections/compare?ids={ID1},{ID2}              [BROKEN in 2026-08-17 test]
GET  https://rosteraudit.com/wp-json/ra/v1/projections/embed/{SLEEPER_ID}
GET  https://rosteraudit.com/wp-json/ra/v1/projections/roster-grades?league_id={LEAGUE_ID}&user_id={USER_ID}
POST https://rosteraudit.com/wp-json/ra/v1/trade/calculate                                 [KEY observed]
GET  https://rosteraudit.com/wp-json/ra/v1/league-history/{LEAGUE_ID}/managers
GET  https://rosteraudit.com/wp-json/ra/v1/league-history/{LEAGUE_ID}/manager/{USER_ID}
GET  https://rosteraudit.com/wp-json/ra/v1/league-history/{LEAGUE_ID}/h2h/{USER_ID_1}/{USER_ID_2}
GET  https://rosteraudit.com/wp-json/ra/v1/league-history/{LEAGUE_ID}/records
GET  https://rosteraudit.com/wp-json/ra/v1/league-history/{LEAGUE_ID}/championships
GET  https://rosteraudit.com/wp-json/ra/v1/league-history/{LEAGUE_ID}/seasons
```
