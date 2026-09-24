import { Link, useRouteContext } from "@tanstack/react-router"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"

export function SiteHeader() {
  const { user } = useRouteContext({ from: "__root__" })

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link to="/" className="font-heading text-sm font-semibold">
          dåre
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link to="/dashboard" />}
              >
                {user.kthid}
              </Button>
              {/* A plain form POST so the cookie is cleared server-side. */}
              <form method="post" action="/auth/logout">
                <Button type="submit" variant="outline" size="sm">
                  Logga ut
                </Button>
              </form>
            </>
          ) : (
            <Button
              size="sm"
              nativeButton={false}
              render={<a href="/auth/login" />}
            >
              Logga in
            </Button>
          )}
          <ModeToggle />
        </nav>
      </div>
    </header>
  )
}
