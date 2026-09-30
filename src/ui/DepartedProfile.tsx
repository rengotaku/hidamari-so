import { defaultContent } from "@/content";
import { JOBS, TRAITS, composeEntry, dayOf, roomNo, type Departed } from "@/sim";

/** 出ていった住人のプロフィールと、最後の出来事 */
export function DepartedProfile({ departed }: { departed: Departed }) {
  const last = departed.last ? composeEntry(defaultContent, departed.last) : null;
  return (
    <section className="profile" aria-label="出ていった住人のプロフィール">
      <h2>
        {roomNo(departed.room)}号室 {departed.sei} {departed.mei}さん
        <small>{departed.age}歳</small>
      </h2>
      <p className="job">{JOBS[departed.job].label}</p>
      <p className="now">
        <b>いま</b> {dayOf(departed.left)}日目に、ひだまり荘を出ていった
      </p>
      {last ? (
        <>
          <h3>最後の出来事</h3>
          <p className="last">{last}</p>
        </>
      ) : null}
      <h3>だめなところ</h3>
      <ul>
        {departed.traits.map((t) => (
          <li key={t}>
            <b>{TRAITS[t].label}</b> {TRAITS[t].desc}
          </li>
        ))}
      </ul>
    </section>
  );
}
