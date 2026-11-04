import { Check, Search, Users } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { SEARCH_INPUT, isComposingEnter } from "../inputProps";

const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

export function RequiredAttendeePicker({ attendees, language, onConfirm, onDirectInput, preselect, draft, onDraft }: {
  attendees: string[];
  language: "ko" | "en";
  onConfirm: (requiredAttendees: string[]) => void;
  onDirectInput?: () => void;
  preselect?: { names: string[]; nonce: number };
  draft?: string[];
  onDraft?: (names: string[]) => void;
}) {
  const ko = language === "ko";
  const [selected, setSelected] = useState<string[]>(draft ?? []);
  useEffect(() => { onDraft?.(selected); }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps
  // 참석자가 많으면(9명 이상) 찾아보기·팀별 묶음·팀 전체 선택을 보여줘요.
  const many = attendees.length > 8;
  const [filter, setFilter] = useState("");
  const [teamOf, setTeamOf] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!many) return;
    api.people({ limit: 500 }).then((result) => setTeamOf(Object.fromEntries(result.people.filter((person) => person.team).map((person) => [person.name, person.team!])))).catch(() => undefined);
  }, [many]);
  const groups = useMemo(() => {
    const target = filter.trim().toLocaleLowerCase("ko-KR");
    const map = new Map<string, string[]>();
    for (const name of attendees) {
      if (target && !name.toLocaleLowerCase("ko-KR").includes(target) && !(teamOf[name] ?? "").includes(target)) continue;
      const team = many ? (teamOf[name] ?? (ko ? "기타" : "Other")) : "";
      map.set(team, [...(map.get(team) ?? []), name]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "ko"));
  }, [attendees, filter, teamOf, many, ko]);
  const teamAll = (names: string[]) => setSelected((current) => names.every((name) => current.includes(name)) ? current.filter((name) => !names.includes(name)) : [...new Set([...current, ...names])]);
  const short = (names: string[]) => names.length > 6 ? `${names.slice(0, 6).join(", ")} 외 ${names.length - 6}명` : names.join(", ");
  // 채팅에 쓴 이름은 여기서 자동으로 체크돼요.
  useEffect(() => {
    if (preselect?.names.length) setSelected((current) => [...new Set([...current, ...preselect.names])]);
  }, [preselect?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  function toggle(attendee: string) {
    setSelected((current) => current.includes(attendee) ? current.filter((item) => item !== attendee) : [...current, attendee]);
  }

  return (
    <section className="required-picker" aria-labelledby="required-picker-title">
      <div className="required-head">
        <p className="required-step">{ko ? "회의 조건 입력 · 질문 5/8" : "Meeting details · Question 5/8"}<span>{ko ? "참석 조건" : "Attendance"}</span></p>
        <h2 id="required-picker-title">{ko ? "누가 꼭 참석해야 하나요?" : "Who must attend?"}</h2>
        <p className="required-desc">{ko ? "필수 참석자 모두 가능한 시간을 우선 추천합니다. 나머지는 선택 참석자로 유지돼요." : "We prioritize times that work for every required attendee. Everyone else stays optional."}</p>
      </div>

      <div className="required-summary-bar" aria-live="polite">
        <Users aria-hidden="true" />
        <p>{ko ? <><strong>필수 참석 {selected.length}명</strong> · 선택 참석 {attendees.length - selected.length}명</> : <><strong>{selected.length} required</strong> · {attendees.length - selected.length} optional</>}</p>
      </div>
      <div className="required-bulk">
        <button type="button" onClick={() => setSelected(attendees)}>{ko ? "모두 필수로 지정" : "Make all required"}</button>
        <button type="button" onClick={() => setSelected([])}>{ko ? "모두 선택으로 변경" : "Make all optional"}</button>
      </div>

      {many && (
        <div className="people-search">
          <Search aria-hidden="true" />
          <label className="sr-only" htmlFor="required-filter">{ko ? "참석자 중에서 찾기" : "Find among attendees"}</label>
          <input id="required-filter" {...SEARCH_INPUT} value={filter} onChange={(event) => setFilter(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !isComposingEnter(event)) event.currentTarget.blur(); }} placeholder={ko ? "참석자 중에서 이름·팀으로 찾기" : "Find by name or team"} />
        </div>
      )}
      <div className={`required-people ${many ? "required-many" : ""}`} role="group" aria-label={ko ? "꼭 참석할 사람" : "Required attendees"}>
        {groups.map(([team, names]) => (
          <Fragment key={team || "all"}>
            {many && <div className="required-group-head"><span>{team} <small>{names.length}{ko ? "명" : ""}</small></span><button onClick={() => teamAll(names)}>{names.every((name) => selected.includes(name)) ? (ko ? "팀 선택 해제" : "Clear team") : (ko ? "팀 전체 꼭 참석" : "Require team")}</button></div>}
            {names.map((attendee) => {
              const checked = selected.includes(attendee);
              return (
                <button key={attendee} type="button" role="checkbox" aria-checked={checked} className={checked ? "selected" : ""} onClick={() => toggle(attendee)}>
                  <span className="person-avatar" aria-hidden="true">{attendee.includes("@") ? "@" : initials(attendee)}</span>
                  <span><strong>{attendee}</strong><small>{checked ? (ko ? "이 사람의 가능한 시간을 기준으로 추천해요." : "Recommendations follow this person's availability.") : (ko ? "참석 가능하면 함께해요" : "Joins if available")}</small></span>
                  <span className="req-toggle"><i aria-hidden="true">{checked && <Check />}</i><b>{ko ? "필수" : "Required"}</b></span>
                </button>
              );
            })}
          </Fragment>
        ))}
        {many && !groups.length && <p className="rd-caption">{ko ? "일치하는 참석자가 없어요." : "No matching attendee."}</p>}
      </div>

      <p className="required-note">{selected.length ? (ko ? `필수 참석자: ${short(selected)}` : `Required: ${short(selected)}`) : (ko ? "필수 참석자를 지정하지 않으면 참석 가능한 사람이 가장 많은 시간을 추천합니다." : "With no required attendee, we recommend the time most people can attend.")}</p>

      <button className="primary-button required-confirm" onClick={() => onConfirm(selected)}>{ko ? "이 조건으로 계속하기" : "Continue with this rule"}</button>
      <button className="direct-input-button" onClick={() => onDirectInput?.()}>{ko ? "직접 알려주기" : "Describe the rule instead"}</button>
    </section>
  );
}
