import {
  EnvelopeSimpleIcon,
  IdentificationBadgeIcon,
  KeyIcon,
  ShieldCheckIcon,
  SignOutIcon,
} from "@phosphor-icons/react"
import { createFileRoute } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { PageHeader } from "@/components/dashboard/page-header"
import { UserAvatar } from "@/components/dashboard/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const Route = createFileRoute("/_authed/dashboard/profil")({
  staticData: { title: "Profil" },
  head: () => ({ meta: [{ title: "Profil · Dashboard · dÅre 27" }] }),
  component: ProfilePage,
})

function Row({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-3 text-sm first:pt-0 last:pb-0 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
      {icon}
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate">{children}</span>
    </div>
  )
}

function ProfilePage() {
  const { user } = Route.useRouteContext()

  return (
    <>
      <PageHeader
        title="Profil"
        description="Ditt konto kommer från Datasektionens inloggning."
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <UserAvatar
                kthid={user.kthid}
                name={user.name}
                size="lg"
                className="size-14 text-lg"
              />
              <div className="flex min-w-0 flex-col gap-1.5">
                <CardTitle className="truncate text-base">
                  {user.name}
                </CardTitle>
                {user.isAdmin ? (
                  <Badge>
                    <ShieldCheckIcon />
                    Admin · dÅrestaben
                  </Badge>
                ) : (
                  <Badge variant="secondary">Medlem</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="divide-y">
            <Row icon={<IdentificationBadgeIcon />} label="KTH-id">
              {user.kthid}
            </Row>
            <Row icon={<EnvelopeSimpleIcon />} label="E-post">
              {user.email}
            </Row>
            <Row icon={<KeyIcon />} label="Behörighet">
              {user.isAdmin ? "dare:admin" : "Ingen"}
            </Row>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Behörigheter kommer från Datasektionens inloggning när du loggar in.
            Logga ut och in igen om något har ändrats.
          </CardFooter>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Session</CardTitle>
              <CardDescription>
                Du är inloggad via SSO i upp till 7 dagar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form method="post" action="/auth/logout">
                <Button type="submit" variant="outline">
                  <SignOutIcon data-icon="inline-start" />
                  Logga ut
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
