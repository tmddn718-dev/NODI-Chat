import { Check, ClockCounterClockwise, MagnifyingGlass, Plus, UserPlus, UsersThree, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { PersonSummary } from "../types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

export function AttendeePicker({ language, onConfirm, onDirectInput }: {
  language: "ko" | "en";
  onConfirm: (attendees: string[]) => void;
  onDirectInput: () => void;
}) {
  const ko = language === "ko";
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
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

  const recent = useMemo(() => people.filter((person) => person.recent).slice(0, 4), [people]);
  const exactEmail = people.some((person) => person.email.toLocaleLowerCase() === query.trim().toLocaleLowerCase());
  const externalEmail = emailPattern.test(query.trim()) && !exactEmail ? query.trim().toLocaleLowerCase() : "";

  function toggle(value: string) {
    setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function PersonRow({ person, compact = false }: { person: PersonSummary; compact?: boolean }) {
    const added = selected.includes(person.name);
    return (
      <button className={`person-row ${compact ? "compact" : ""} ${added ? "selected" : ""}`} onClick={() => toggle(person.name)} aria-pressed={added}>
        <span className="person-avatar" aria-hidden="true">{initials(person.name)}</span>
        <span className="person-copy"><strong>{person.name}</strong><small>{person.email}</small></span>
        {!compact && <span className={`calendar-dot ${person.calendarStatus}`}><i />{person.calendarStatus === "connected" ? (ko ? "캘린더 연결" : "Calendar connected") : (ko ? "직접 응답" : "Manual response")}</span>}
        <span className="person-add-icon" aria-hidden="true">{added ? <Check weight="bold" /> : <Plus weight="bold" />}</span>
      </button>
    );
  }

  return (
    <section className="attendee-picker" aria-labelledby="attendee-picker-title">
      <div className="guided-heading">
        <span><UsersThree weight="duotone" /></span>
        <div><p>4 / 8 · {ko ? "참석자" : "Attendees"}</p><h2 id="attendee-picker-title">{ko ? "누구와 함께하나요?" : "Who should attend?"}</h2></div>
      </div>
      <progress className="guided-progress" max="8" value="4" aria-label={ko ? "8단계 중 4단계" : "Step 4 of 8"} />

      <div className="people-search">
        <MagnifyingGlass aria-hidden="true" />
        <label className="sr-only" htmlFor="attendee-search">{ko ? "참석자 검색" : "Search attendees"}</label>
        <input id="attendee-search" value={query} onChange={(event) => { setQuery(event.target.value); setError(""); }} placeholder={ko ? "이름 또는 이메일로 검색" : "Search by name or email"} autoComplete="off" />
        {query && <button onClick={() => setQuery("")} aria-label={ko ? "검색어 지우기" : "Clear search"}><X /></button>}
      </div>

      {selected.length > 0 && <div className="selected-people" aria-label={ko ? "선택한 참석자" : "Selected attendees"}>{selected.map((name) => <button key={name} onClick={() => toggle(name)}>{name}<X aria-hidden="true" /></button>)}</div>}

      {!query && recent.length > 0 && <div className="people-section"><div className="people-section-title"><span><ClockCounterClockwise /> {ko ? "최근 함께한 사람" : "Recent meeting partners"}</span><small>{ko ? "최근 회의 기준" : "Demo activity"}</small></div><div className="recent-people">{recent.map((person) => <PersonRow person={person} compact key={person.id} />)}</div></div>}

      <div className="people-section directory-section">
        <div className="people-section-title"><span><UserPlus /> {query ? (ko ? "검색 결과" : "Search results") : (ko ? "조직 구성원" : "Workspace people")}</span><small>{loading ? (ko ? "검색 중" : "Searching") : `${people.length}${ko ? "명" : " people"}`}</small></div>
        {loading ? <div className="people-skeleton" role="status"><span /><span /><span /></div> : people.length ? <div className="people-list">{people.map((person) => <PersonRow person={person} key={person.id} />)}</div> : !externalEmail && <div className="people-empty"><strong>{ko ? "일치하는 구성원이 없어요" : "No matching person"}</strong><span>{ko ? "이메일 주소를 입력하면 외부 참석자로 추가할 수 있어요." : "Enter an email to add an external attendee."}</span></div>}
        {externalEmail && <button className={`external-person ${selected.includes(externalEmail) ? "selected" : ""}`} onClick={() => toggle(externalEmail)}><span className="person-avatar">@</span><span className="person-copy"><strong>{externalEmail}</strong><small>{ko ? "외부 참석자로 초대" : "Invite as an external attendee"}</small></span><span className="person-add-icon">{selected.includes(externalEmail) ? <Check /> : <Plus />}</span></button>}
      </div>

      {error && <p className="dialog-error" role="alert">{error}</p>}
      <p className="attendee-request-note">{ko ? "선택이 끝나면 각자에게 응답 링크를 보낼 수 있어요." : "After confirming the meeting details, you can send each attendee a private response link."}</p>
      <button className="primary-button attendee-confirm" disabled={!selected.length} onClick={() => onConfirm(selected)}><UserPlus /> {selected.length ? (ko ? "이 사람들과 계속" : `Add ${selected.length} attendee${selected.length > 1 ? "s" : ""}`) : (ko ? "함께할 사람을 선택해 주세요" : "Select attendees")}</button>
      <button className="direct-input-button" onClick={onDirectInput}>{ko ? "직접 입력할게요" : "Enter names directly"}</button>
    </section>
  );
}
