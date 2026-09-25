import { ArrowSquareOutIcon } from "@phosphor-icons/react"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { TicketReleaseEditor } from "@/components/admin/ticket-release-editor"
import { TicketReleaseHistory } from "@/components/admin/ticket-release-history"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { featuresQuery } from "@/lib/settings/queries"
import {
  ticketReleaseHistoryQuery,
  ticketReleaseQuery,
} from "@/lib/ticket-release/queries"

export const Route = createFileRoute("/_authed/dashboard/_admin/biljettslapp")({
  staticData: { title: "Biljettsläpp" },
  head: () => ({ meta: [{ title: "Biljettsläpp · Dashboard · dÅre 27" }] }),
  beforeLoad: async ({ context }) => {
    const features = await context.queryClient.ensureQueryData(featuresQuery)
    if (!features.ticketRelease)
      throw redirect({ to: "/dashboard/installningar" })
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(ticketReleaseQuery),
      context.queryClient.ensureQueryData(ticketReleaseHistoryQuery),
    ]),
  component: TicketReleasePage,
})

function TicketReleasePage() {
  return (
    <>
      <PageHeader
        title="Biljettsläpp"
        description="När biljetterna släpps. Startsidan räknar ner hit."
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to="/" target="_blank" />}
          >
            Visa startsidan
            <ArrowSquareOutIcon data-icon="inline-end" />
          </Button>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <TicketReleaseEditor />
        <TicketReleaseHistory />
      </div>
    </>
  )
}
