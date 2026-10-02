import { describe, expect, it } from "vitest"
import { parseKthIds } from "./judges"

describe("KTH ids for judges", () => {
  it("takes several at once, however they're separated", () => {
    expect(parseKthIds("kalle, Nollan\nture;  sara ").ids).toEqual([
      "kalle",
      "nollan",
      "ture",
      "sara",
    ])
  })

  it("cuts KTH email addresses down to the id, without duplicates", () => {
    expect(parseKthIds("kalle@kth.se kalle KALLE@ug.kth.se").ids).toEqual([
      "kalle",
    ])
  })

  it("sets aside what isn't an id", () => {
    expect(parseKthIds("kalle x kalle@gmail.com ok-not")).toEqual({
      ids: ["kalle"],
      invalid: ["x", "kalle@gmail.com", "ok-not"],
    })
  })
})
