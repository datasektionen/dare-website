import { GearIcon, type Icon } from "@phosphor-icons/react"
import type { Feature } from "@/lib/settings/features.server"
import type { Piste } from "./piste-mark"

export type NavItem = {
  to:
    | "/dashboard"
    | "/dashboard/battle"
    | "/dashboard/biljettslapp"
    | "/dashboard/aktivitet"
    | "/dashboard/installningar"
  label: string
  /** Main pages are marked like pistes on a trail map. */
  piste?: Piste
  /** Utility pages use a plain icon instead. */
  icon?: Icon
  /** Only for dÅrestaben (admins). */
  admin?: boolean
  /** Only shown while this optional feature is switched on. */
  feature?: Feature
}

/** Always at the top. */
export const MAIN: NavItem[] = [
  { to: "/dashboard", label: "Översikt", piste: "green" },
  {
    to: "/dashboard/aktivitet",
    label: "Aktivitet",
    piste: "blue",
    admin: true,
  },
]

/** Switchable features, in the order they're used. */
export const FEATURES: NavItem[] = [
  {
    to: "/dashboard/biljettslapp",
    label: "Biljettsläpp",
    piste: "red",
    admin: true,
    feature: "ticketRelease",
  },
  {
    to: "/dashboard/battle",
    label: "Jäger vs Minttu",
    piste: "black",
    admin: true,
    feature: "battle",
  },
]

/** Pinned to the bottom, above the account menu. */
export const SECONDARY: NavItem[] = [
  {
    to: "/dashboard/installningar",
    label: "Inställningar",
    icon: GearIcon,
    admin: true,
  },
]
