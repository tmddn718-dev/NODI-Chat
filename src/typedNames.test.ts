import { describe, expect, it } from "vitest";
import { matchNames } from "./typedNames";

const pool = [{ name: "김민지" }, { name: "박준호" }, { name: "이민지" }, { name: "Alex Morgan" }];

describe("matchNames", () => {
  it("finds full names, given names and latin first names, in any sentence", () => {
    expect(matchNames("김민지가 꼭 참석", pool).matched).toEqual(["김민지"]);
    expect(matchNames("준호랑 알렉스 모건", pool).matched).toEqual(["박준호"]);
    expect(matchNames("alex 도 추가", pool).matched).toEqual(["Alex Morgan"]);
  });
  it("flags a given name shared by several people instead of guessing", () => {
    const r = matchNames("민지랑 준호", pool);
    expect(r.matched).toEqual(["박준호"]);
    expect(r.ambiguous).toEqual(["민지"]);
  });
  it("collects external emails not in the directory", () => {
    expect(matchNames("partner@Example.com 도 초대", pool).emails).toEqual(["partner@example.com"]);
  });
  it("never invents someone who is not in the list", () => {
    expect(matchNames("홍길동", pool).matched).toEqual([]);
  });
});
