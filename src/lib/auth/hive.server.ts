import { env } from "@/env"

/**
 * Whether `kthid` is a (direct or indirect) member of a Hive group, given as
 * `id@domain`. The group must be tagged with a tag belonging to this system,
 * and the API token needs `$hive:api-list-tagged`.
 */
export async function isGroupMember(kthid: string, groupKey: string) {
  const [id, domain] = groupKey.split("@")
  const res = await fetch(
    `${env.HIVE_URL}/group/${encodeURIComponent(domain)}/${encodeURIComponent(id)}/members`,
    {
      headers: { Authorization: `Bearer ${env.HIVE_API_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    }
  )
  if (!res.ok) {
    throw new Error(`Hive responded ${res.status} for group ${groupKey}`)
  }
  const members: string[] = await res.json()
  return members.includes(kthid)
}
