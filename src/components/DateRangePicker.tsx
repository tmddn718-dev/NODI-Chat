import { CalendarBlank, CaretLeft, CaretRight, CheckCircle, PencilSimple } from "@phosphor-icons/react";
import { useState } from "react";

const parseDate = (value: string) => new Date(`${value}T00:00:00Z`);
const formatIsoDate = (date: Date) => date.toISOString().slice(0, 10);

function addDays(value: string, amount: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatIsoDate(date);
}

function monthStart(value: string) {
  const date = parseDate(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function moveMonth(value: Date, amount: number) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + amount, 1));
}

function currentDateInSeoul() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function calendarDays(month: Date) {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const mondayOffset = (month.getUTCDay() + 6) % 7;

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, monthIndex, index - mondayOffset + 1));
    return {
      date: formatIsoDate(date),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === monthIndex,
    };
  });
}

function displayDate(value: string | undefined, language: "ko" | "en") {
  if (!value) return language === "ko" ? "날짜 선택" : "Select date";
  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(parseDate(value));
}

export function DateRangePicker({
  language,
  initialStart,
  onConfirm,
  onDirectInput,
  today = currentDateInSeoul(),
}: {
  language: "ko" | "en";
  initialStart?: string;
  onConfirm: (start: string, end: string) => void;
  onDirectInput: () => void;
  today?: string;
}) {
  const ko = language === "ko";
  const validInitialStart = initialStart && initialStart >= today ? initialStart : undefined;
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(validInitialStart ?? today));
  const [start, setStart] = useState<string | undefined>(validInitialStart);
  const [end, setEnd] = useState<string | undefined>();
  const days = calendarDays(visibleMonth);
  const currentMonth = today.slice(0, 7);
  const visibleMonthKey = formatIsoDate(visibleMonth).slice(0, 7);
  const latestEnd = start && !end ? addDays(start, 30) : undefined;
  const monthLabel = new Intl.DateTimeFormat(ko ? "ko-KR" : "en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
  }).format(visibleMonth);
  const weekdays = ko ? ["월", "화", "수", "목", "금", "토", "일"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function selectDate(date: string) {
    if (!start || end) {
      setStart(date);
      setEnd(undefined);
      return;
    }
    if (date < start) {
      setStart(date);
      setEnd(undefined);
      return;
    }
    setEnd(date);
  }

  return (
    <section className="date-range-picker" aria-labelledby="date-range-title">
      <div className="guided-heading">
        <span><CalendarBlank weight="duotone" /></span>
        <div>
          <p>7–8 / 8 · {ko ? "일정 범위" : "Date range"}</p>
          <h2 id="date-range-title">{ko ? "언제부터 언제까지 찾아볼까요?" : "What date range should NODI search?"}</h2>
        </div>
      </div>
      <progress className="guided-progress" max="8" value="7" aria-label={ko ? "8단계 중 일정 범위 선택" : "Select the date range in steps 7 and 8"} />

      <div className="calendar-shell">
        <div className="calendar-month-header">
          <button
            type="button"
            onClick={() => setVisibleMonth((month) => moveMonth(month, -1))}
            disabled={visibleMonthKey <= currentMonth}
            aria-label={ko ? "이전 달" : "Previous month"}
          >
            <CaretLeft weight="bold" />
          </button>
          <strong aria-live="polite">{monthLabel}</strong>
          <button type="button" onClick={() => setVisibleMonth((month) => moveMonth(month, 1))} aria-label={ko ? "다음 달" : "Next month"}>
            <CaretRight weight="bold" />
          </button>
        </div>

        <div className="calendar-weekdays" aria-hidden="true">
          {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>
        <div className="calendar-grid" role="grid" aria-label={monthLabel}>
          {days.map(({ date, day, inMonth }) => {
            if (!inMonth) return <span className="calendar-day-placeholder" key={date} aria-hidden="true" />;
            const isPast = date < today;
            const isBeyondRange = Boolean(latestEnd && date > latestEnd);
            const isDisabled = isPast || isBeyondRange;
            const isStart = date === start;
            const isEnd = date === end;
            const isInRange = Boolean(start && end && date > start && date < end);
            const fullDate = new Intl.DateTimeFormat(ko ? "ko-KR" : "en-US", {
              timeZone: "UTC",
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            }).format(parseDate(date));

            return (
              <button
                type="button"
                key={date}
                className={`calendar-day${date === today ? " today" : ""}${isInRange ? " in-range" : ""}${isStart ? " range-start" : ""}${isEnd ? " range-end" : ""}`}
                disabled={isDisabled}
                onClick={() => selectDate(date)}
                aria-label={`${date} ${fullDate}${date === today ? (ko ? ", 오늘" : ", today") : ""}`}
                aria-pressed={isStart || isEnd}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      <div className="range-selection-summary" aria-live="polite">
        <div><span>{ko ? "시작" : "Start"}</span><strong>{displayDate(start, language)}</strong></div>
        <i aria-hidden="true" />
        <div><span>{ko ? "종료" : "End"}</span><strong>{displayDate(end, language)}</strong></div>
      </div>
      <p className="range-help">
        <CheckCircle weight="fill" />
        {start && !end
          ? (ko ? "종료일을 선택해 주세요. 시작일과 같은 날도 선택할 수 있어요." : "Choose an end date. It can be the same as the start date.")
          : (ko ? "오늘부터 최대 31일까지 찾을 수 있어요." : "Choose a range of up to 31 days, starting today or later.")}
      </p>

      <button className="primary-button date-range-confirm" type="button" disabled={!start || !end} onClick={() => start && end && onConfirm(start, end)}>
        {ko ? "이 날짜로 찾기" : "Continue with this date range"}
      </button>
      <button className="direct-input-button" type="button" onClick={onDirectInput}><PencilSimple /> {ko ? "직접 입력할게요" : "Enter dates in a sentence"}</button>
    </section>
  );
}
