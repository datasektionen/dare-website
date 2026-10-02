import { queryOptions } from "@tanstack/react-query"
import {
  getTicketLink,
  getTicketLinkAdmin,
  getTicketRelease,
  getTicketReleaseHistory,
} from "./functions"

/**
 * How often public pages re-check the release time and an open link, so an
 * admin's "Släpp nu" or a new link reaches open screens without a reload.
 */
export const LIVE_MS = 15_000

export const ticketReleaseQuery = queryOptions({
  queryKey: ["ticket-release"],
  queryFn: () => getTicketRelease(),
})

export const ticketReleaseHistoryQuery = queryOptions({
  queryKey: ["ticket-release", "history"],
  queryFn: () => getTicketReleaseHistory(),
})

/**
 * The public ticket link. Polls fast until it's open (the server may still
 * say "upcoming" for a moment at zero, or no link is set yet), then every
 * `LIVE_MS` in case an admin changes or removes it.
 */
export const ticketLinkQuery = queryOptions({
  queryKey: ["ticket-release", "link"],
  queryFn: () => getTicketLink(),
  refetchInterval: (query) =>
    query.state.data?.state === "open" ? LIVE_MS : 4_000,
})

export const ticketLinkAdminQuery = queryOptions({
  queryKey: ["ticket-release", "link", "admin"],
  queryFn: () => getTicketLinkAdmin(),
})
