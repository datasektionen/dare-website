import { TanStackDevtools } from "@tanstack/react-devtools"
import type { QueryClient } from "@tanstack/react-query"
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools"
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { lazy, Suspense } from "react"
import { ThemeProvider, themeScript } from "@/components/theme-provider"
import { getUser } from "@/lib/auth/functions"

import appCss from "../styles.css?url"

// Not used on the landing page, so kept out of the initial bundle.
const SiteHeader = lazy(() =>
  import("@/components/site-header").then((m) => ({ default: m.SiteHeader }))
)
const Toaster = lazy(() =>
  import("@/components/ui/sonner").then((m) => ({ default: m.Toaster }))
)

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    const user = await getUser()
    return { user }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Dåre" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1 className="font-heading text-lg">404</h1>
      <p className="text-muted-foreground">
        The requested page could not be found.
      </p>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  // The landing page brings its own full-screen nav.
  const isLanding = useRouterState({
    select: (s) => s.location.pathname === "/",
  })

  return (
    <html lang="sv" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static theme bootstrap script */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body className="min-h-svh bg-background text-foreground antialiased">
        <ThemeProvider>
          {!isLanding && (
            <Suspense>
              <SiteHeader />
            </Suspense>
          )}
          {children}
          {!isLanding && (
            <Suspense>
              <Toaster />
            </Suspense>
          )}
        </ThemeProvider>
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            {
              name: "TanStack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            { name: "TanStack Query", render: <ReactQueryDevtoolsPanel /> },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
