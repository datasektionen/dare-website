import { CopyIcon, PlusIcon, QrCodeIcon, XIcon } from "@phosphor-icons/react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { UserAvatar } from "@/components/dashboard/user-avatar"
import { QrCode } from "@/components/qr-code"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { activityQuery } from "@/lib/activity/queries"
import { addJudges, removeJudge } from "@/lib/battle/judge-functions"
import { JUDGE_PATH, type Judge } from "@/lib/battle/judges"
import { judgesQuery } from "@/lib/battle/queries"

const list = (ids: string[]) => ids.join(", ")

/**
 * Who besides dÅrestaben may give points: add KTH ids (several at once),
 * remove them, and hand out the link they log in with.
 */
export function BattleJudges() {
  const { data: judges } = useSuspenseQuery(judgesQuery)
  const queryClient = useQueryClient()
  const [text, setText] = useState("")
  const [showQr, setShowQr] = useState(false)
  // Only known in the browser.
  const [link, setLink] = useState(JUDGE_PATH)
  useEffect(() => setLink(`${location.origin}${JUDGE_PATH}`), [])

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: judgesQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: activityQuery.queryKey }),
    ])

  const add = useMutation({
    mutationFn: (text: string) => addJudges({ data: { text } }),
    onSuccess: (r) => {
      const problems = [
        r.unknown.length && `Finns inte i SSO: ${list(r.unknown)}`,
        r.invalid.length && `Inte KTH-id: ${list(r.invalid)}`,
        r.already.length && `Redan domare: ${list(r.already)}`,
      ].filter(Boolean)
      if (r.added.length)
        toast.success(
          r.added.length === 1
            ? `${r.added[0].name ?? r.added[0].kthid} är domare`
            : `${r.added.length} nya domare`,
          { description: problems.join(". ") || undefined }
        )
      else toast.error("Ingen lades till", { description: problems.join(". ") })
      // Keep what didn't work, to fix and try again.
      setText([...r.unknown, ...r.invalid].join(" "))
    },
    onError: (error) =>
      toast.error("Kunde inte lägga till", {
        description: error instanceof Error ? error.message : undefined,
      }),
    onSettled: refresh,
  })

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      toast.success("Länken är kopierad")
    } catch {
      toast.error("Kunde inte kopiera")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Domare</CardTitle>
        <CardDescription>Kan ge poäng, men inget annat.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim() && !add.isPending) add.mutate(text)
          }}
        >
          {/* 16px on phones, so iOS doesn't zoom in when it's focused. */}
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="KTH-id, flera går bra"
            aria-label="KTH-id"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="h-9 text-base md:text-xs"
          />
          <Button type="submit" disabled={!text.trim() || add.isPending}>
            <PlusIcon data-icon="inline-start" />
            Lägg till
          </Button>
        </form>

        {judges.length ? (
          <ul className="flex flex-col divide-y">
            {judges.map((j) => (
              <JudgeRow key={j.kthid} judge={j} onRemoved={refresh} />
            ))}
          </ul>
        ) : (
          <p className="well px-3 py-6 text-center text-xs text-muted-foreground">
            Inga domare än.
          </p>
        )}

        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Domare loggar in här och hamnar direkt på poängen:
          </p>
          <div className="flex items-center gap-1">
            <code className="min-w-0 flex-1 truncate bg-muted px-2 py-1.5 text-xs">
              {link}
            </code>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Kopiera länken"
              title="Kopiera"
              onClick={copy}
            >
              <CopyIcon />
            </Button>
            <Button
              variant={showQr ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label={showQr ? "Dölj QR-koden" : "Visa QR-kod"}
              title="QR-kod"
              onClick={() => setShowQr((v) => !v)}
            >
              <QrCodeIcon />
            </Button>
          </div>
          {showQr && (
            <QrCode
              value={link}
              title="QR-kod till domarsidan"
              className="mx-auto aspect-square w-48 ring-1 ring-border"
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function JudgeRow({
  judge,
  onRemoved,
}: {
  judge: Judge
  onRemoved: () => void
}) {
  const remove = useMutation({
    mutationFn: () => removeJudge({ data: { kthid: judge.kthid } }),
    onSuccess: () =>
      toast.success(`${judge.name ?? judge.kthid} är inte domare längre`),
    onError: (error) =>
      toast.error("Kunde inte ta bort", {
        description: error instanceof Error ? error.message : undefined,
      }),
    onSettled: onRemoved,
  })
  return (
    <li className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
      <UserAvatar
        kthid={judge.kthid}
        name={judge.name ?? judge.kthid}
        size="sm"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">
          {judge.name ?? judge.kthid}
        </span>
        {judge.name && (
          <span className="truncate text-[11px] text-muted-foreground">
            {judge.kthid}
          </span>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Ta bort ${judge.name ?? judge.kthid} som domare`}
        title="Ta bort"
        disabled={remove.isPending}
        onClick={() => remove.mutate()}
      >
        <XIcon />
      </Button>
    </li>
  )
}
