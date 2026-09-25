import { ArrowSquareOutIcon } from "@phosphor-icons/react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { toast } from "sonner"
import { PageHeader } from "@/components/dashboard/page-header"
import { type Piste, PisteMark } from "@/components/dashboard/piste-mark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { activityQuery } from "@/lib/activity/queries"
import { type Feature, setFeature } from "@/lib/settings/functions"
import { FEATURE_NAMES } from "@/lib/settings/names"
import { featuresQuery } from "@/lib/settings/queries"

export const Route = createFileRoute("/_authed/dashboard/_admin/installningar")(
  {
    staticData: { title: "Inställningar" },
    head: () => ({ meta: [{ title: "Inställningar · Dashboard · dÅre 27" }] }),
    loader: ({ context }) => context.queryClient.ensureQueryData(featuresQuery),
    component: SettingsPage,
  }
)

const FEATURES: {
  feature: Feature
  /** Matches the feature's marker in the sidebar. */
  piste: Piste
  to: "/dashboard/battle" | "/dashboard/biljettslapp"
  description: string
  whenOff: string
}[] = [
  {
    feature: "ticketRelease",
    piste: "red",
    to: "/dashboard/biljettslapp",
    description:
      "Nedräkningen till biljettsläppet. Stäng av när biljetterna är släppta: startsidan visas som vanligt men utan siffrorna.",
    whenOff: "Siffrorna på startsidan är dolda.",
  },
  {
    feature: "battle",
    piste: "black",
    to: "/dashboard/battle",
    description:
      "Storbildsskärmen och poängräkningen för biljettsläppspuben. Slå på den inför puben och av efteråt. Poängen sparas, så nollställ på Jäger vs Minttu-sidan för en ny rond.",
    whenOff: "Poängen finns kvar tills nästa gång.",
  },
]

function FeatureRow({
  feature,
  piste,
  to,
  description,
  whenOff,
}: (typeof FEATURES)[number]) {
  const { data: features } = useSuspenseQuery(featuresQuery)
  const queryClient = useQueryClient()
  const router = useRouter()
  const name = FEATURE_NAMES[feature]

  const toggle = useMutation({
    mutationFn: (enabled: boolean) =>
      setFeature({ data: { feature, enabled } }),
    onSuccess: async (next) => {
      queryClient.setQueryData(featuresQuery.queryKey, next)
      queryClient.invalidateQueries({ queryKey: activityQuery.queryKey })
      // Re-run route guards and loaders (sidebar, overview, /battle, /).
      await router.invalidate()
      toast.success(next[feature] ? `${name} är på` : `${name} är avstängt`, {
        description: next[feature] ? "Syns nu i menyn och på sajten." : whenOff,
      })
    },
    onError: (error) =>
      toast.error("Kunde inte spara", {
        description: error instanceof Error ? error.message : undefined,
      }),
  })

  const on = toggle.isPending ? !!toggle.variables : features[feature]

  return (
    <div className="well flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="flex size-10 shrink-0 items-center justify-center bg-white ring-1 ring-border">
        <PisteMark piste={piste} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {name}
          {on ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              På
            </Badge>
          ) : (
            <Badge variant="secondary">Av</Badge>
          )}
        </span>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-3 sm:flex-col sm:items-end">
        <Switch
          aria-label={name}
          checked={on}
          disabled={toggle.isPending}
          onCheckedChange={(checked) => toggle.mutate(checked)}
        />
        {features[feature] && (
          <Button
            variant="ghost"
            size="xs"
            nativeButton={false}
            render={<Link to={to} />}
          >
            Öppna
            <ArrowSquareOutIcon data-icon="inline-end" />
          </Button>
        )}
      </div>
    </div>
  )
}

function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Inställningar"
        description="Slå på och av delar av sajten."
      />
      <Card>
        <CardHeader>
          <CardTitle>Funktioner</CardTitle>
          <CardDescription>
            Avstängda funktioner döljs i dashboarden och på sajten. Inget
            raderas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {FEATURES.map((f) => (
              <FeatureRow key={f.feature} {...f} />
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
