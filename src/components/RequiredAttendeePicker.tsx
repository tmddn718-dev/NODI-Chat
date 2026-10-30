import { Check, CircleUser, Search, ShieldCheck } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { NodiMark } from "./NodiMark";

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
      <div className="guided-heading">
        <span className="heading-logo"><NodiMark /></span>
        <div><p>{ko ? "회의 조건 정하기" : "Meeting details"}</p><h2 id="required-picker-title">{ko ? "이 회의를 진행하려면 반드시 참석해야 하는 사람은 누구인가요?" : "Whose availability is required?"}</h2></div>
      </div>

      <div className="required-toolbar">
        <p>{ko ? "반드시 참석해야 하는 사람을 선택해 주세요. 선택하지 않은 사람은 참석 가능한 경우 함께하는 선택 참석자로 설정돼요. 필수 참석자가 모두 가능해야 확정할 수 있어요." : "Pick the people who must attend. Everyone else joins when they can. Only slots that work for all required attendees can be confirmed."}</p>
        <div className="required-counts" aria-live="polite"><strong>{ko ? `필수 ${selected.length}명` : `${selected.length} required`}</strong><span>/</span><strong>{ko ? `선택 ${attendees.length - selected.length}명` : `${attendees.length - selected.length} optional`}</strong></div>
        <div><button onClick={() => setSelected(attendees)}>{ko ? "모두 필수로" : "All required"}</button><button onClick={() => setSelected([])}>{ko ? "모두 선택으로" : "All optional"}</button></div>
      </div>

      {many && (
        <div className="people-search">
          <Search aria-hidden="true" />
          <label className="sr-only" htmlFor="required-filter">{ko ? "참석자 중에서 찾기" : "Find among attendees"}</label>
          <input id="required-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={ko ? "참석자 중에서 이름·팀으로 찾기" : "Find by name or team"} autoComplete="off" />
        </div>
      )}
      <div className={`required-people ${many ? "required-many" : ""}`} role="group" aria-label={ko ? "꼭 참석할 사람" : "Required attendees"}>
        {groups.map(([team, names]) => (
          <Fragment key={team || "all"}>
            {many && <div className="required-group-head"><span>{team} <small>{names.length}{ko ? "명" : ""}</small></span><button onClick={() => teamAll(names)}>{names.every((name) => selected.includes(name)) ? (ko ? "팀 선택 해제" : "Clear team") : (ko ? "팀 전체 꼭 참석" : "Require team")}</button></div>}
            {names.map((attendee) => {
              const checked = selected.includes(attendee);
              return (
                <button key={attendee} className={checked ? "selected" : ""} onClick={() => toggle(attendee)} aria-pressed={checked}>
                  <span className="person-avatar" aria-hidden="true">{attendee.includes("@") ? "@" : initials(attendee)}</span>
                  <span><span className="req-name"><strong>{attendee}</strong><em className={`req-tag ${checked ? "on" : ""}`}>{checked ? (ko ? "필수" : "Required") : (ko ? "선택" : "Optional")}</em></span><small>{checked ? (ko ? "이 사람이 가능한 시간만 추천해요" : "Availability required") : (ko ? "가능한 경우 함께해요 · 눌러서 필수로 바꿔요" : "Select to make required")}</small></span>
                  <i aria-hidden="true">{checked ? <Check /> : <CircleUser />}</i>
                </button>
              );
            })}
          </Fragment>
        ))}
        {many && !groups.length && <p className="rd-caption">{ko ? "일치하는 참석자가 없어요." : "No matching attendee."}</p>}
      </div>

      <div className="required-selection-summary" aria-live="polite">
        <span>{selected.length ? <ShieldCheck /> : <CircleUser />}</span>
        <p><strong>{selected.length ? (ko ? `필수 참석자 ${selected.length}명` : `${selected.length} required`) : (ko ? "필수 참석자 없음" : "No required attendees")}</strong><small>{selected.length ? short(selected) : (ko ? "모든 참석자를 선택 참석자로 보고, 가능한 사람이 가장 많은 시간을 찾아요." : "Everyone is optional; we look for the time most people can attend.")}</small></p>
      </div>

      <button className="primary-button required-confirm" onClick={() => onConfirm(selected)}>{ko ? "이 조건으로 계속하기" : "Continue with this rule"}</button>
      <button className="direct-input-button" onClick={() => onDirectInput?.()}>{ko ? "직접 알려주기" : "Describe the rule instead"}</button>
    </section>
  );
}
