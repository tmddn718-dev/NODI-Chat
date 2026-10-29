import { Check, History, Plus, Search, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { PersonSummary } from "../types";
import { NodiMark } from "./NodiMark";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

export function AttendeePicker({ language, onConfirm, onDirectInput, preselect }: {
  language: "ko" | "en";
  onConfirm: (attendees: string[]) => void;
  onDirectInput?: () => void;
  preselect?: { names: string[]; nonce: number };
}) {
  const ko = language === "ko";
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  // 채팅에 쓴 이름은 여기서 자동으로 체크돼요.
  useEffect(() => {
    if (preselect?.names.length) setSelected((current) => [...new Set([...current, ...preselect.names])]);
  }, [preselect?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      api.people(query)
        .then((result) => active && setPeople(result.people))
        .catch((reason) => active && setError(reason instanceof Error ? reason.message : "참석자를 불러오지 못했어요."))
        .finally(() => active && setLoading(false));
    }, query ? 220 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  const byName = (a: PersonSummary, b: PersonSummary) => a.name.localeCompare(b.name, "ko");
  const recent = useMemo(() => people.filter((person) => person.recent).sort(byName), [people]);
  const teams = useMemo(() => {
    const groups = new Map<string, PersonSummary[]>();
    for (const person of people) groups.set(person.team ?? (ko ? "기타" : "Other"), [...(groups.get(person.team ?? (ko ? "기타" : "Other")) ?? []), person]);
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "ko")).map(([team, members]) => [team, [...members].sort(byName)] as const);
  }, [people, ko]);
  const unlisted = selected.filter((name) => !emailPattern.test(name) && !people.some((person) => person.name === name));
  const exactEmail = people.some((person) => person.email.toLocaleLowerCase() === query.trim().toLocaleLowerCase());
  const externalEmail = emailPattern.test(query.trim()) && !exactEmail ? query.trim().toLocaleLowerCase() : "";

  function toggle(value: string) {
    setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function PersonRow({ person, compact = false, dual = false }: { person: PersonSummary; compact?: boolean; dual?: boolean }) {
    const added = selected.includes(person.name);
    return (
      <button className={`person-row ${compact ? "compact" : ""} ${added ? "selected" : ""}`} onClick={() => toggle(person.name)} aria-pressed={added}>
        <span className="person-avatar" aria-hidden="true">{initials(person.name)}</span>
        <span className="person-copy"><strong>{person.name}</strong><small>{person.title ? `${person.title}${person.team ? ` · ${person.team}` : ""}` : person.email}</small></span>
        {!compact && !dual && <span className={`calendar-dot ${person.calendarStatus}`}><i />{person.calendarStatus === "connected" ? (ko ? "캘린더 연결" : "Calendar connected") : (ko ? "직접 응답" : "Manual response")}</span>}
        <span className="person-add-icon" aria-hidden="true">{added ? <Check /> : <Plus />}</span>
      </button>
    );
  }

  return (
    <section className="attendee-picker" aria-labelledby="attendee-picker-title">
      <div className="guided-heading">
        <span className="heading-logo"><NodiMark /></span>
        <div><p>2 / 6{ko ? "단계 · 참석자와 우선순위" : " · Attendees"}</p><h2 id="attendee-picker-title">{ko ? "누구와 함께하나요?" : "Who should attend?"}</h2></div>
      </div>
      <progress className="guided-progress" max="6" value="2" aria-label={ko ? "6단계 중 2단계" : "Step 2 of 6"} />

      <div className="people-search">
        <Search aria-hidden="true" />
        <label className="sr-only" htmlFor="attendee-search">{ko ? "참석자 검색" : "Search attendees"}</label>
        <input id="attendee-search" value={query} onChange={(event) => { setQuery(event.target.value); setError(""); }} placeholder={ko ? "이름 또는 이메일로 검색" : "Search by name or email"} autoComplete="off" />
        {query && <button onClick={() => setQuery("")} aria-label={ko ? "검색어 지우기" : "Clear search"}><X /></button>}
      </div>

      {selected.length > 0 && <div className="selected-people" aria-label={ko ? "선택한 참석자" : "Selected attendees"}>{selected.map((name) => <button key={name} onClick={() => toggle(name)}>{name}<X aria-hidden="true" /></button>)}</div>}

      <div className="people-stack">
        <div className="people-section">
          <div className="people-section-title"><span><History /> {ko ? "최근 함께한 사람" : "Recent meeting partners"}</span><small>{loading ? (ko ? "검색 중" : "Searching") : `${recent.length}${ko ? "명" : ""}`}</small></div>
          {loading ? <div className="people-skeleton" role="status"><span /><span /><span /></div> : recent.length ? (
            <div className="recent-chips">{recent.map((person) => {
              const added = selected.includes(person.name);
              return (
                <button className={`pick-chip ${added ? "on" : ""}`} key={person.id} onClick={() => toggle(person.name)} aria-pressed={added} aria-label={`${person.name}${person.title ? ` ${person.title}` : ""}`}>
                  <span className="pick-chip-avatar" aria-hidden="true">{initials(person.name)}</span>
                  <span>{person.name}</span>
                  {added && <Check aria-hidden="true" />}
                </button>
              );
            })}</div>
          ) : <div className="people-empty"><span>{ko ? "최근 회의에 함께한 사람이 없어요." : "No recent meeting partners."}</span></div>}
        </div>
        <div className="people-section directory-section">
          <div className="people-section-title"><span><UserPlus /> {ko ? "팀원 · 직급" : "Team members"}</span><small>{loading ? (ko ? "검색 중" : "Searching") : `${people.length}${ko ? "명" : ""}`}</small></div>
          {loading ? <div className="people-skeleton" role="status"><span /><span /><span /></div> : people.length ? <div className="people-list">{teams.map(([team, members]) => <div className="team-group" key={team}><p className="team-name">{team} <span>{members.length}</span></p>{members.map((person) => <PersonRow person={person} dual key={person.id} />)}</div>)}</div> : !externalEmail && <div className="people-empty"><strong>{ko ? "일치하는 구성원이 없어요" : "No matching person"}</strong><span>{ko ? "이메일 주소를 입력하면 외부 참석자로 추가할 수 있어요." : "Enter an email to add an external attendee."}</span></div>}
        </div>
      </div>
      {externalEmail && <button className={`external-person ${selected.includes(externalEmail) ? "selected" : ""}`} onClick={() => toggle(externalEmail)}><span className="person-avatar">@</span><span className="person-copy"><strong>{externalEmail}</strong><small>{ko ? "외부 참석자로 초대" : "Invite as an external attendee"}</small></span><span className="person-add-icon">{selected.includes(externalEmail) ? <Check /> : <Plus />}</span></button>}

      {unlisted.length > 0 && <p className="rd-caption attendee-unlisted" role="note">{ko ? `${unlisted.join(", ")}은(는) 조직 구성원에서 찾을 수 없어요. 이메일 주소로 추가하면 응답 링크를 메일로 보낼 수 있고, 이름만 있으면 링크를 복사해서 직접 전달해야 해요.` : `${unlisted.join(", ")} not found in the directory. Add an email to send the link by mail, or copy the link and share it yourself.`}</p>}
      {error && <p className="dialog-error" role="alert">{error}</p>}
      <p className="attendee-request-note">{ko ? "선택이 끝나면 각자에게 응답 링크를 보낼 수 있어요." : "After confirming the meeting details, you can send each attendee a private response link."}</p>
      <button className="primary-button attendee-confirm" disabled={!selected.length} onClick={() => onConfirm(selected)}>{selected.length ? (ko ? "이 사람들과 계속" : `Add ${selected.length} attendee${selected.length > 1 ? "s" : ""}`) : (ko ? "함께할 사람을 선택해 주세요" : "Select attendees")}</button>
      <button className="direct-input-button" onClick={() => onDirectInput?.()}>{ko ? "직접 입력할게요" : "Enter names directly"}</button>
    </section>
  );
}
