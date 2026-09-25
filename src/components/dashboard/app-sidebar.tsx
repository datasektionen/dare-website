import {
  CaretUpDownIcon,
  SignOutIcon,
  UserCircleIcon,
} from "@phosphor-icons/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, useMatchRoute } from "@tanstack/react-router"
import type { CSSProperties } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import type { User } from "@/lib/auth/types"
import { featuresQuery } from "@/lib/settings/queries"
import { FEATURES, MAIN, type NavItem, SECONDARY } from "./nav"
import { PisteMark } from "./piste-mark"
import { UserAvatar } from "./user-avatar"

/**
 * Menu items look like arrow-shaped trail signs nailed to the post. The
 * current page's sign is painted in its colour (`--sign`); hovering tints an
 * unpainted sign with it.
 */
const SIGN =
  "trail-sign relative ml-3 h-9 w-[calc(100%-1.25rem)] gap-2.5 bg-white pr-6 text-[17px] text-sidebar-foreground shadow-[0_1px_0_rgba(19,33,58,.12)] transition-[background-color,color] [clip-path:polygon(0_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,0_100%)] hover:bg-[color-mix(in_srgb,var(--sign)_10%,white)] hover:text-sidebar-foreground focus-visible:ring-inset active:bg-[color-mix(in_srgb,var(--sign)_16%,white)] active:text-sidebar-foreground data-active:bg-(--sign) data-active:font-extrabold data-active:text-white data-active:hover:bg-(--sign) data-active:hover:text-white data-active:active:bg-(--sign) data-active:active:text-white group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:[clip-path:none]"

/** One trail sign in the menu. */
function Sign({ item }: { item: NavItem }) {
  const matchRoute = useMatchRoute()
  const { setOpenMobile } = useSidebar()
  const active = !!matchRoute({ to: item.to })
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={item.label}
        className={SIGN}
        style={
          {
            "--sign": `var(--piste-${item.piste ?? "black"})`,
          } as CSSProperties
        }
        render={<Link to={item.to} onClick={() => setOpenMobile(false)} />}
      >
        <NavMark item={item} active={active} />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function NavGroup({
  label,
  items,
  className,
}: {
  label?: string
  items: NavItem[]
  className?: string
}) {
  if (!items.length) return null
  return (
    <SidebarGroup className={className}>
      {label && (
        <SidebarGroupLabel className="relative ml-6 font-medium text-sidebar-foreground/60">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="gap-1.5">
          {items.map((item) => (
            <Sign key={item.to} item={item} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function UserMenu({ user }: { user: User }) {
  const { isMobile } = useSidebar()

  async function logout() {
    await fetch("/auth/logout", { method: "POST" })
    window.location.assign("/")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="bg-white shadow-[0_1px_0_rgba(19,33,58,.12)] ring-1 ring-sidebar-border hover:bg-white hover:brightness-[.97] data-popup-open:bg-white"
              />
            }
          >
            <UserAvatar kthid={user.kthid} name={user.name} />
            <div className="grid flex-1 text-left leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-sidebar-foreground/60">
                {user.kthid}
              </span>
            </div>
            <CaretUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-foreground">{user.name}</span>
                  <span className="font-normal">{user.email}</span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link to="/dashboard/profil" />}>
              <UserCircleIcon />
              Profil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <SignOutIcon />
              Logga ut
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AppSidebar({ user }: { user: User }) {
  const { data: features } = useSuspenseQuery(featuresQuery)
  const { setOpenMobile } = useSidebar()
  // Admin-only pages for admins; switched-off features are hidden entirely.
  const visible = (items: NavItem[]) =>
    items.filter(
      (i) => (!i.admin || user.isAdmin) && (!i.feature || features[i.feature])
    )

  return (
    <Sidebar collapsible="icon">
      <Signpost />
      {/* The resort sign at the top of the post. */}
      <SidebarHeader className="relative px-3 pt-4 pb-3 group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:pt-3">
        <Link
          to="/dashboard"
          onClick={() => setOpenMobile(false)}
          aria-label="dÅre 27, till översikten"
          className="flex items-center justify-center bg-white px-4 py-3 shadow-[0_1px_0_rgba(19,33,58,.12),0_6px_16px_-10px_rgba(19,33,58,.4)] ring-1 ring-sidebar-border outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:p-1"
        >
          <img
            src="/dare27-logo-black.png"
            alt="dÅre 27"
            width={800}
            height={413}
            className="h-auto w-28 group-data-[collapsible=icon]:w-6"
          />
        </Link>
      </SidebarHeader>

      <SidebarContent className="relative">
        <NavGroup items={visible(MAIN)} />
        <NavGroup label="Funktioner" items={visible(FEATURES)} />

        <NavGroup className="mt-auto" items={visible(SECONDARY)} />
      </SidebarContent>

      <SidebarFooter className="relative">
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

/**
 * The wooden signpost the menu's signs hang on. Hidden when collapsed to
 * icons.
 */
function Signpost() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden group-data-[collapsible=icon]:hidden"
    >
      <div className="absolute top-24 bottom-20 left-[22px] w-2 bg-[linear-gradient(90deg,var(--wood-dark),var(--wood)_40%,var(--wood-dark))] shadow-[1px_0_0_rgba(0,0,0,.08)]" />
    </div>
  )
}

/** A page's piste marker, or its icon for utility pages. */
function NavMark({ item, active }: { item: NavItem; active?: boolean }) {
  if (item.piste)
    return (
      <span className="flex size-4 shrink-0 items-center justify-center">
        {/* On a painted (active) sign, the marker is white. */}
        <PisteMark piste={item.piste} inverted={active} />
      </span>
    )
  const Icon = item.icon
  return Icon ? <Icon /> : null
}
