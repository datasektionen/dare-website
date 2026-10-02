/** Someone who may score the battle without being an admin. */
export type Judge = {
  kthid: string
  /** Null until SSO or their first login has told us. */
  name: string | null
  addedByName: string
  addedAt: string
}

export type AddedJudges = {
  added: Judge[]
  /** Already judges. */
  already: string[]
  /** Not KTH ids SSO knows. */
  unknown: string[]
  /** Not even shaped like a KTH id. */
  invalid: string[]
}

const KTH_ID = /^[a-z0-9]{2,16}$/

/**
 * KTH ids from whatever was typed or pasted: separated by spaces, commas or
 * new lines, with KTH email addresses cut down to the id. Lower case, no
 * duplicates. Anything that isn't shaped like an id goes in `invalid`.
 */
export function parseKthIds(text: string) {
  const ids = new Set<string>()
  const invalid: string[] = []
  for (const part of text.split(/[\s,;]+/)) {
    const id = part
      .trim()
      .toLowerCase()
      .replace(/@(ug\.)?kth\.se$/, "")
    if (!id) continue
    if (KTH_ID.test(id)) ids.add(id)
    else invalid.push(part.trim())
  }
  return { ids: [...ids], invalid }
}

/** Where judges go to log in and score (`src/routes/domare.tsx`). */
export const JUDGE_PATH = "/domare"
