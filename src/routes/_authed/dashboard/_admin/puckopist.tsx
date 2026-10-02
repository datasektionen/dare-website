import { ArrowSquareOutIcon } from "@phosphor-icons/react"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { z } from "zod"
import {
  GameBans,
  GameSettingsCard,
  GameStats,
} from "@/components/admin/game-overview"
import { GameScores } from "@/components/admin/game-scores"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { PAGE_SIZE, SCORE_VIEWS } from "@/lib/game/admin"
import { gameOverviewQuery, scoresQuery } from "@/lib/game/queries"
import { featuresQuery } from "@/lib/settings/queries"

export const Route = createFileRoute("/_authed/dashboard/_admin/puckopist")({
  staticData: { title: "Puckopist" },
  head: () => ({ meta: [{ title: "Puckopist · Dashboard · dÅre 27" }] }),
  // The view and device filter live in the URL, so they survive reloads.
  validateSearch: z.object({
    visa: z.enum(SCORE_VIEWS).optional().catch(undefined),
    enhet: z.string().max(100).optional().catch(undefined),
  }),
  beforeLoad: async ({ context }) => {
    const features = await context.queryClient.ensureQueryData(featuresQuery)
    if (!features.puckopist) throw redirect({ to: "/dashboard/installningar" })
  },
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(gameOverviewQuery),
      context.queryClient.ensureQueryData(
        scoresQuery({
          q: "",
          view: deps.visa ?? "alla",
          device: deps.enhet ?? null,
          limit: PAGE_SIZE,
        })
      ),
    ]),
  component: GamePage,
})

function GamePage() {
  const { visa = "alla", enhet = null } = Route.useSearch()
  const navigate = Route.useNavigate()
  const go = (next: { visa?: typeof visa; enhet?: string | null }) =>
    navigate({
      search: (s) => {
        const v = next.visa ?? s.visa ?? "alla"
        const e = next.enhet === undefined ? s.enhet : next.enhet
        return {
          visa: v === "alla" ? undefined : v,
          enhet: e ?? undefined,
        }
      },
      replace: true,
    })

  return (
    <>
      <PageHeader
        title="Puckopist"
        description="Skidspelet på /game."
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
      <GameStats onReview={() => go({ visa: "granska", enhet: null })} />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
        <GameScores
          view={visa}
          device={enhet}
          onView={(v) => go({ visa: v })}
          onDevice={(d) => go({ enhet: d, visa: d ? "alla" : undefined })}
        />
        <div className="flex flex-col gap-6">
          <GameSettingsCard />
          <GameBans />
        </div>
      </div>
    </>
  )
}
