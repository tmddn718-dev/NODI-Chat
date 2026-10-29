// 채팅에 쓴 말에서 사람 이름을 찾아 선택 카드에 자동으로 체크해요. AI 없이 목록(디렉터리·참석자) 안에서만 찾고, 목록에 없는 이름은 만들지 않아요.
export type Pool = Array<{ name: string; email?: string }>;

const squash = (value: string) => value.toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
const given = (name: string) => {
  const clean = squash(name);
  return /[가-힣]/.test(clean) ? (clean.length >= 3 ? clean.slice(1) : "") : squash(name.split(/\s+/)[0] ?? "");
};

export function matchNames(text: string, pool: Pool) {
  const typed = squash(text);
  const matched = new Set<string>();
  const ambiguous = new Set<string>();
  const byGiven = new Map<string, string[]>();
  for (const person of pool) {
    const key = given(person.name);
    if (key.length >= 2) byGiven.set(key, [...(byGiven.get(key) ?? []), person.name]);
  }
  for (const person of pool) {
    if (typed.includes(squash(person.name)) || (person.email && typed.includes(squash(person.email)))) matched.add(person.name);
  }
  for (const [key, names] of byGiven) {
    if (!typed.includes(key) || names.every((name) => matched.has(name))) continue;
    if (names.length === 1) matched.add(names[0]);
    else names.forEach((name) => !matched.has(name) && ambiguous.add(key));
  }
  const emails = (text.match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/g) ?? []).map((email) => email.toLowerCase()).filter((email) => !pool.some((person) => person.email?.toLowerCase() === email));
  return { matched: [...matched], ambiguous: [...ambiguous], emails };
}
