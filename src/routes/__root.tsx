import { TanStackDevtools } from "@tanstack/react-devtools"
import type { QueryClient } from "@tanstack/react-query"
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools"
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useMatches,
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
  // Full-screen pages (landing, /battle) and the dashboard bring their own
  // chrome.
  const { siteHeader, toasts, piste } = useMatches({
    select: (matches) => ({
      siteHeader: !matches.some((m) => m.staticData.siteHeader === false),
      toasts: !matches.some((m) => m.staticData.toasts === false),
      piste: matches.some((m) => m.staticData.piste),
    }),
    structuralSharing: true,
  })

  return (
    <html
      lang="sv"
      data-piste={piste ? "" : undefined}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static theme bootstrap script */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body className="min-h-svh bg-background text-foreground antialiased">
        <ThemeProvider>
          {siteHeader && (
            <Suspense>
              <SiteHeader />
            </Suspense>
          )}
          {children}
          {toasts && (
            <Suspense>
              <Toaster {...(piste ? { theme: "light" as const } : {})} />
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
