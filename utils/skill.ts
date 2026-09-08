// utils/skills.ts
export const parseSkills = (sk: string | null): string[] =>
  sk
    ? sk
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];