import { describe, expect, it } from "vitest";
import { demoPeople } from "./demo-data.ts";
import { searchPeople } from "./people.ts";

describe("searchPeople", () => {
  it("shows recent meeting participants first", () => {
    const people = searchPeople(demoPeople, []);
    expect(people.slice(0, 3).map((person) => person.name)).toEqual(["김민지", "박준호", "이소라"]);
    expect(people[0].recent).toBe(true);
  });

  it("searches by Korean name or email without adding duplicates", () => {
    expect(searchPeople(demoPeople, [], " 민지 ").map((person) => person.email)).toEqual(["minji@nodi.demo"]);
    expect(searchPeople(demoPeople, [], "alex@").map((person) => person.name)).toEqual(["Alex Morgan"]);
  });
});
