/** Positions that get their own "room" on the overview; anything else is folded into `other`.
 *  Their own module because both the value layer and the pure redraft-projection math need
 *  them, and the value layer reaches the network. */
export const ROOM_POSITIONS = ["QB", "RB", "WR", "TE"] as const;
export type RoomPosition = (typeof ROOM_POSITIONS)[number];
