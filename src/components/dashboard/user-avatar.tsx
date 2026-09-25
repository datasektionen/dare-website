import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export function initials(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  )
}

/**
 * A person's Datasektionen profile picture, falling back to their initials
 * while it loads or if they don't have one.
 */
export function UserAvatar({
  kthid,
  name,
  size = "default",
  className,
}: {
  kthid: string
  name: string
  size?: "sm" | "default" | "lg"
  className?: string
}) {
  return (
    <Avatar size={size} className={className}>
      <AvatarImage src={`/api/avatar/${kthid}`} alt="" />
      <AvatarFallback
        className={cn("bg-primary/15 font-semibold text-primary")}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
