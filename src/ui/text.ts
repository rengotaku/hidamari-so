import { ACTS, type GameState, type Resident } from "@/sim";

/** いま何をしているかを言葉で */
export function statusText(s: GameState, r: Resident): string {
  if (r.at === "out") {
    if (r.outPurpose === "work" && r.shift) return `外出中（${r.shift.label}）`;
    if (r.outPurpose === "konbini") return "外出中（コンビニ）";
    if (r.outPurpose === "sento") return "外出中（銭湯）";
    return "外出中";
  }
  if (r.at === "walking") return r.walkMode === "leave" ? "出かけるところ" : "帰り道";
  if (r.visiting) {
    const hostId = s.rooms[r.at];
    const host = s.res.find((x) => x.id === hostId);
    return `${host ? host.sei : "隣"}さんの部屋にいる`;
  }
  return r.act in ACTS ? ACTS[r.act as keyof typeof ACTS].label : "ぼんやり";
}
