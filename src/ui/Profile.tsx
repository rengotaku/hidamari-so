import { JOBS, TRAITS, roomNo, type GameState, type Resident } from "@/sim";
import { statusText } from "./text";

export function Profile({
  state,
  resident,
}: {
  state: GameState;
  resident: Resident | null;
}) {
  if (!resident) {
    return <p className="hint">建物の中の住人を押すと、その人のことがわかる。</p>;
  }
  return (
    <section className="profile" aria-label="住人のプロフィール">
      <h2>
        {roomNo(resident.room)}号室 {resident.sei} {resident.mei}さん
        <small>{resident.age}歳</small>
      </h2>
      <p className="job">{JOBS[resident.job].label}</p>
      <p className="now">
        <b>いま</b> {statusText(state, resident)}
      </p>
      <h3>だめなところ</h3>
      <ul>
        {resident.traits.map((t) => (
          <li key={t}>
            <b>{TRAITS[t].label}</b> {TRAITS[t].desc}
          </li>
        ))}
      </ul>
    </section>
  );
}
