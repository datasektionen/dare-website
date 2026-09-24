import { queryOptions } from "@tanstack/react-query"
import { getTicketRelease, getTicketReleaseHistory } from "./functions"

export const ticketReleaseQuery = queryOptions({
  queryKey: ["ticket-release"],
  queryFn: () => getTicketRelease(),
})

export const ticketReleaseHistoryQuery = queryOptions({
  queryKey: ["ticket-release", "history"],
  queryFn: () => getTicketReleaseHistory(),
})
