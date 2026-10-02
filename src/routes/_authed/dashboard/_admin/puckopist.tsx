import { ArrowSquareOutIcon } from "@phosphor-icons/react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { GameScores } from "@/components/admin/game-scores"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { PAGE_SIZE } from "@/lib/game/admin"
import { scoresQuery } from "@/lib/game/queries"

export const Route = createFileRoute("/_authed/dashboard/_admin/puckopist")({
  staticData: { title: "Puckopist" },
  head: () => ({ meta: [{ title: "Puckopist · Dashboard · dÅre 27" }] }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(scoresQuery("", PAGE_SIZE)),
  component: GamePage,
})

function GamePage() {
  return (
    <>
      <PageHeader
        title="Puckopist"
        description="Alla åk som sparats på topplistan i spelet. Ta bort de med namn som inte är okej."
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to="/game" target="_blank" />}
          >
            Öppna spelet
            <ArrowSquareOutIcon data-icon="inline-end" />
          </Button>
        }
      />
      <GameScores />
    </>
  )
}
