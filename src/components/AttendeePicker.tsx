import { Check, History, Plus, Search, UserPlus, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { MAX_ATTENDEES, type OrgTree, type PersonSummary } from "../types";
import { NodiMark } from "./NodiMark";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const PAGE = 30;
const CHIPS_SHOWN = 8;

// 구성원이 수백 명이어도 쓸 수 있게: 검색 중심, 부서·팀 필터, 일부만 불러오고 더 보기, 팀 전체 추가, 선택 요약.
export function AttendeePicker({ language, onConfirm, onDirectInput, preselect, draft, onDraft }: {
  language: "ko" | "en";
  onConfirm: (attendees: string[]) => void;
  onDirectInput?: () => void;
  preselect?: { names: string[]; nonce: number };
  // 질문에 답만 받고 카드가 다시 그려져도 고른 사람이 사라지지 않게 부모가 선택을 보관해요.
  draft?: string[];
  onDraft?: (names: string[]) => void;
}) {
  const ko = language === "ko";
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [team, setTeam] = useState("");
  const [tree, setTree] = useState<OrgTree | null>(null);
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<string[]>(draft ?? []);
  useEffect(() => { onDraft?.(selected); }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // 채팅에 쓴 이름은 여기서 자동으로 체크돼요.
  useEffect(() => {
    if (preselect?.names.length) setSelected((current) => [...new Set([...current, ...preselect.names])].slice(0, MAX_ATTENDEES));
  }, [preselect?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { api.directory().then(setTree).catch(() => setTree(null)); }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      api.people({ query, department, team, limit: PAGE })
        .then((result) => { if (!active) return; setPeople(result.people); setTotal(result.total ?? result.people.length); setHasMore(Boolean(result.hasMore)); })
        .catch((reason) => active && setError(reason instanceof Error ? reason.message : "참석자를 불러오지 못했어요."))
        .finally(() => active && setLoading(false));
    }, query ? 220 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, department, team]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const result = await api.people({ query, department, team, limit: PAGE, offset: people.length });
      setPeople((current) => [...current, ...result.people.filter((person) => !current.some((other) => other.id === person.id))]);
      setHasMore(Boolean(result.hasMore));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "참석자를 불러오지 못했어요.");
    } finally {
      setLoadingMore(false);
    }
  }

  const filtering = Boolean(query || department || team);
  const recent = useMemo(() => (filtering ? [] : people.filter((person) => person.recent)), [people, filtering]);
  const teamsOfDepartment = tree?.departments.find((item) => item.name === department)?.teams ?? [];
  const teamCount = teamsOfDepartment.find((item) => item.name === team)?.count;
  const exactEmail = people.some((person) => person.email.toLocaleLowerCase() === query.trim().toLocaleLowerCase());
  const externalEmail = emailPattern.test(query.trim()) && !exactEmail ? query.trim().toLocaleLowerCase() : "";
  const unlisted = selected.filter((name) => !emailPattern.test(name) && !people.some((person) => person.name === name) && !filtering);
  const full = selected.length >= MAX_ATTENDEES;

  function toggle(value: string) {
    setUndo(null);
    if (!selected.includes(value) && full) { setNotice(ko ? `한 회의에는 최대 ${MAX_ATTENDEES}명까지 넣을 수 있어요.` : `A meeting can have up to ${MAX_ATTENDEES} attendees.`); return; }
    setNotice("");
    setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function addTeam() {
    try {
      const result = await api.people({ department, team, limit: 500 });
      const before = selected;
      const merged = [...new Set([...selected, ...result.people.map((person) => person.name)])];
      const next = merged.slice(0, MAX_ATTENDEES);
      setSelected(next);
      setUndo(before);
      const added = next.length - before.length;
      setNotice(merged.length > MAX_ATTENDEES
        ? (ko ? `최대 ${MAX_ATTENDEES}명까지만 넣을 수 있어서 ${team} ${added}명만 추가했어요.` : `Added ${added} from ${team} (limit ${MAX_ATTENDEES}).`)
        : (ko ? `${team} ${added}명을 추가했어요.` : `Added ${added} from ${team}.`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "팀원을 불러오지 못했어요.");
    }
  }

  function PersonRow({ person }: { person: PersonSummary }) {
    const added = selected.includes(person.name);
    const place = [person.department, person.team].filter(Boolean).join(" · ");
    return (
      <button className={`person-row ${added ? "selected" : ""}`} onClick={() => toggle(person.name)} aria-pressed={added}>
        <span className="person-avatar" aria-hidden="true">{initials(person.name)}</span>
        <span className="person-copy"><strong>{person.name}</strong><small>{[person.title, place].filter(Boolean).join(" · ") || person.email}</small></span>
        <span className="person-add-icon" aria-hidden="true">{added ? <Check /> : <Plus />}</span>
      </button>
    );
  }

  const shownChips = expanded ? selected : selected.slice(0, CHIPS_SHOWN);

  return (
    <section className="attendee-picker" aria-labelledby="attendee-picker-title">
      <div className="guided-heading">
        <span className="heading-logo"><NodiMark /></span>
        <div><p>{ko ? "회의 조건 정하기" : "Meeting details"}</p><h2 id="attendee-picker-title">{ko ? "누구와 함께하나요?" : "Who should attend?"}</h2></div>
      </div>

      <div className="people-search">
        <Search aria-hidden="true" />
        <label className="sr-only" htmlFor="attendee-search">{ko ? "참석자 검색" : "Search attendees"}</label>
        <input id="attendee-search" value={query} onChange={(event) => { setQuery(event.target.value); setError(""); }} placeholder={ko ? "이름, 팀, 직무 또는 이메일로 검색" : "Search by name, team, role or email"} autoComplete="off" />
        {query && <button onClick={() => setQuery("")} aria-label={ko ? "검색어 지우기" : "Clear search"}><X /></button>}
      </div>

      {tree && (
        <div className="people-filters">
          <label><span className="sr-only">{ko ? "부서" : "Department"}</span>
            <select value={department} onChange={(event) => { setDepartment(event.target.value); setTeam(""); }}>
              <option value="">{ko ? `전체 부서 (${tree.total}명)` : `All departments (${tree.total})`}</option>
              {tree.departments.map((item) => <option key={item.name} value={item.name}>{`${item.name} (${item.count}명)`}</option>)}
            </select>
          </label>
          <label><span className="sr-only">{ko ? "팀" : "Team"}</span>
            <select value={team} onChange={(event) => setTeam(event.target.value)} disabled={!department}>
              <option value="">{department ? (ko ? "전체 팀" : "All teams") : (ko ? "부서를 먼저 고르세요" : "Pick a department")}</option>
              {teamsOfDepartment.map((item) => <option key={item.name} value={item.name}>{`${item.name} (${item.count}명)`}</option>)}
            </select>
          </label>
        </div>
      )}

      {team && !query && (
        <button className="team-add" onClick={() => void addTeam()}><Users aria-hidden="true" />{ko ? `${team} ${teamCount ?? total}명 모두 추가` : `Add all of ${team}`}</button>
      )}

      {selected.length > 0 && (
        <div className="selected-summary">
          <div className="selected-head">
            <strong>{ko ? `선택한 참석자 ${selected.length}/${MAX_ATTENDEES}명` : `${selected.length}/${MAX_ATTENDEES} selected`}</strong>
            <button onClick={() => { setUndo(selected); setSelected([]); setNotice(""); }}>{ko ? "모두 지우기" : "Clear all"}</button>
          </div>
          <div className="selected-people" aria-label={ko ? "선택한 참석자" : "Selected attendees"}>
            {shownChips.map((name) => <button key={name} onClick={() => toggle(name)}>{name}<X aria-hidden="true" /></button>)}
            {selected.length > CHIPS_SHOWN && <button className="selected-more" onClick={() => setExpanded((value) => !value)}>{expanded ? (ko ? "접기" : "Show less") : (ko ? `외 ${selected.length - CHIPS_SHOWN}명 보기` : `+${selected.length - CHIPS_SHOWN} more`)}</button>}
          </div>
        </div>
      )}
      {(notice || undo) && (
        <p className="people-notice" role="status">{notice}{undo && <button onClick={() => { setSelected(undo); setUndo(null); setNotice(""); }}>{ko ? "되돌리기" : "Undo"}</button>}</p>
      )}

      <div className="people-stack">
        {recent.length > 0 && (
          <div className="people-section">
            <div className="people-section-title"><span><History /> {ko ? "최근 함께한 사람" : "Recent meeting partners"}</span><small>{recent.length}{ko ? "명" : ""}</small></div>
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
          </div>
        )}
        <div className="people-section directory-section">
          <div className="people-section-title"><span><UserPlus /> {filtering ? (ko ? "검색 결과" : "Results") : (ko ? "구성원" : "Directory")}</span><small>{loading ? (ko ? "검색 중" : "Searching") : ko ? `전체 ${total}명 중 ${people.length}명 표시` : `${people.length} of ${total}`}</small></div>
          {loading ? <div className="people-skeleton" role="status"><span /><span /><span /></div> : people.length ? (
            <div className="people-list">
              {people.map((person) => <PersonRow person={person} key={person.id} />)}
              {hasMore && <button className="people-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? (ko ? "불러오는 중..." : "Loading...") : ko ? `더 보기 (${total - people.length}명 남음)` : `Show more (${total - people.length} left)`}</button>}
            </div>
          ) : !externalEmail && <div className="people-empty"><strong>{ko ? "일치하는 구성원이 없어요" : "No matching person"}</strong><span>{ko ? "검색어를 줄이거나 부서·팀 필터를 바꿔 보세요. 이메일 주소를 입력하면 외부 참석자로 추가할 수 있어요." : "Try a shorter search or another filter. Enter an email to add an external attendee."}</span></div>}
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
