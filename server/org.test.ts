import { describe, expect, it } from "vitest";
import { applyInterpretation, MAX_ATTENDEES } from "./dialogue.ts";
import { generateOrg, orgPeople } from "./org-data.ts";
import { orgTree, searchDirectory } from "./people.ts";
import { recommendSlots } from "./recommendation.ts";

describe("organization directory", () => {
  it("is a company of a few hundred people with unique names, ids and emails, deterministic per date", () => {
    expect(orgPeople.length).toBeGreaterThanOrEqual(100);
    expect(orgPeople.length).toBeLessThanOrEqual(500);
    for (const key of ["name", "id", "email"] as const) expect(new Set(orgPeople.map((person) => person[key])).size).toBe(orgPeople.length);
    expect(generateOrg("2026-11-02")).toEqual(generateOrg("2026-11-02"));
    expect(orgPeople.slice(0, 5).map((person) => person.name)).toEqual(["김민지", "박준호", "이소라", "Alex Morgan", "최유진"]);
  });

  it("pages and filters results and never exposes calendar blocks", () => {
    const first = searchDirectory(orgPeople, [], { limit: 30 });
    expect(first.people).toHaveLength(30);
    expect(first.total).toBe(orgPeople.length);
    expect(first.hasMore).toBe(true);
    const rest = searchDirectory(orgPeople, [], { limit: 30, offset: 30 });
    expect(rest.people.some((person) => first.people.some((other) => other.id === person.id))).toBe(false);
    const backend = searchDirectory(orgPeople, [], { team: "백엔드팀", limit: 500 });
    expect(backend.total).toBe(16);
    expect(backend.people.every((person) => person.team === "백엔드팀" && person.department === "개발본부")).toBe(true);
    expect(searchDirectory(orgPeople, [], { query: "개발본부", limit: 500 }).total).toBeGreaterThan(40);
    expect(JSON.stringify(first.people)).not.toContain("blocks");
    expect(JSON.stringify(first.people)).not.toContain("스탠드업");
  });

  it("summarizes departments and teams", () => {
    const tree = orgTree(orgPeople);
    expect(tree.total).toBe(orgPeople.length);
    expect(tree.departments.reduce((sum, department) => sum + department.count, 0)).toBe(orgPeople.length);
    expect(tree.departments.find((department) => department.name === "개발본부")?.teams.some((team) => team.name === "백엔드팀")).toBe(true);
  });
});

describe("recommendation at company scale", () => {
  const start = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const members = orgPeople.slice(5, 55).map((person) => person.name);

  it("handles a 50-person meeting quickly and keeps the required-first rule", () => {
    const t0 = performance.now();
    const slots = recommendSlots({ title: "전사 회의", purpose: "공유", durationMinutes: 60, attendees: members, requiredAttendees: members.slice(0, 5), preferredTime: "any", dateStart: start, dateEnd: end }, orgPeople);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(slots).toHaveLength(3);
    expect(slots[0].total).toBe(50);
    expect(slots[0].evidence).toHaveLength(50);
  });

  it("treats leave and time outside working hours as unavailable, not as a calendar conflict", () => {
    const person = { ...orgPeople[10], blocks: [], leave: [start], workHours: { start: 10, end: 17 } };
    const slots = recommendSlots({ title: "t", purpose: "p", durationMinutes: 30, attendees: [person.name], requiredAttendees: [person.name], preferredTime: "any", dateStart: start, dateEnd: start }, [person]);
    expect(slots.every((slot) => !slot.requiredAvailable && slot.evidence?.[0].evidence === "out_of_office")).toBe(true);
  });
});

describe("attendee cap", () => {
  it("tells the user when a team proposal is cut at the limit", () => {
    const names = orgPeople.slice(0, 60).map((person) => person.name);
    const result = applyInterpretation({}, { intent: "update_condition", assistantMessage: "x", meetingPatch: { attendees: names }, removeFields: [], proposedFields: {}, ambiguities: [] }, orgPeople, new Date());
    expect(result.meeting.attendees).toHaveLength(MAX_ATTENDEES);
    expect(result.issues.join(" ")).toContain("최대 50명");
  });
});
