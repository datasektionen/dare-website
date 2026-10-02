import {
  ArrowCounterClockwiseIcon,
  ArrowSquareOutIcon,
  CheckIcon,
  CopyIcon,
  DownloadSimpleIcon,
  LinkIcon,
  LockSimpleIcon,
  QrCodeIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { QrCode, qrSvgFile } from "@/components/qr-code"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useNow } from "@/hooks/use-now"
import { activityQuery } from "@/lib/activity/queries"
import { setTicketLink } from "@/lib/ticket-release/functions"
import {
  ticketLinkAdminQuery,
  ticketReleaseQuery,
} from "@/lib/ticket-release/queries"
import { ticketUrlSchema } from "@/lib/ticket-release/schema"
import { formatRelative, formatShort, splitDuration } from "@/lib/time"

/** Within this long before the release, a missing link gets a warning. */
const SOON_MS = 24 * 36e5

/** Pasted without `https://`? Add it, if that makes a valid link. */
function withProtocol(value: string) {
  const v = value.trim()
  if (!v || /^[a-z][a-z\d+.-]*:/i.test(v)) return v
  const fixed = `https://${v}`
  return ticketUrlSchema.safeParse(fixed).success ? fixed : v
}

async function download(url: string) {
  const blob = new Blob([await qrSvgFile(url)], { type: "image/svg+xml" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = "dare27-biljett-qr.svg"
  a.click()
  URL.revokeObjectURL(a.href)
}

/**
 * The ticket sign-up link. It stays on the server until the release time,
 * then becomes the buy button on the landing page and the QR code on /qr.
 */
export function TicketLinkEditor() {
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(ticketLinkAdminQuery)
  const { data: release } = useSuspenseQuery(ticketReleaseQuery)
  const saved = data.url
  const [draft, setDraft] = useState(saved ?? "")
  const [touched, setTouched] = useState(false)
  const [confirm, setConfirm] = useState<"remove" | "replace" | null>(null)
  const now = useNow()

  const releaseAt = new Date(release.at).getTime()
  const released = now !== null && now >= releaseAt
  const soon = now !== null && !released && releaseAt - now < SOON_MS

  const trimmed = draft.trim()
  const parsed = ticketUrlSchema.safeParse(trimmed)
  const valid = parsed.success
  const error = trimmed && !valid ? parsed.error.issues[0]?.message : undefined
  const dirty = trimmed !== (saved ?? "")
  // What the preview shows: the draft if it's a link, else what's saved.
  const preview = valid ? parsed.data : saved

  const mutation = useMutation({
    mutationFn: (url: string | null) => setTicketLink({ data: { url } }),
    onSuccess: (res) => {
      queryClient.setQueryData(ticketLinkAdminQuery.queryKey, res)
      // The public link, and the change log.
      queryClient.invalidateQueries({ queryKey: ["ticket-release"] })
      queryClient.invalidateQueries({ queryKey: activityQuery.queryKey })
      setDraft(res.url ?? "")
      setTouched(false)
      toast.success(
        res.url ? "Biljettlänken är sparad" : "Länken är borttagen",
        {
          description: res.url
            ? released
              ? "Den syns redan för alla besökare."
              : "Den hålls hemlig tills biljetterna släpps."
            : undefined,
        }
      )
    },
    onError: (e) =>
      toast.error("Kunde inte spara", {
        description: e instanceof Error ? e.message : undefined,
      }),
  })

  function save() {
    if (!dirty || mutation.isPending) return
    if (!trimmed) return setConfirm("remove")
    if (!valid) return setTouched(true)
    // Swapping a link people may already be using deserves a second look.
    if (released && saved) return setConfirm("replace")
    mutation.mutate(parsed.data)
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Länken är kopierad")
    } catch {
      toast.error("Kunde inte kopiera")
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Biljettlänk</CardTitle>
            <CardDescription>
              Anmälningsformuläret. Blir köpknappen och QR-koden när biljetterna
              släpps.
            </CardDescription>
          </div>
          {now !== null && <Status saved={saved} released={released} />}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {released && !saved && (
          <Notice tone="danger">
            Biljetterna är släppta men ingen länk är satt. Besökarna ser
            ”Biljettlänken kommer alldeles strax” tills du sparar en.
          </Notice>
        )}
        {soon && !saved && (
          <Notice tone="warn">
            Släppet är om {formatLeft(releaseAt - (now ?? 0))} och ingen länk är
            satt än.
          </Notice>
        )}

        <div className="grid gap-6 md:grid-cols-[1fr_auto]">
          <form
            className="flex min-w-0 flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
          >
            <Field data-invalid={touched && !!error}>
              <FieldLabel htmlFor="ticket-url">Länk</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="ticket-url"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://forms.gle/…"
                  value={draft}
                  aria-invalid={touched && !!error}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    setDraft((d) => withProtocol(d))
                    setTouched(true)
                  }}
                  className="min-w-0 flex-1 font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Öppna länken i en ny flik"
                  title="Testa länken"
                  disabled={!valid}
                  nativeButton={false}
                  render={
                    <a
                      href={valid ? parsed.data : undefined}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <ArrowSquareOutIcon />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Kopiera länken"
                  title="Kopiera"
                  disabled={!valid}
                  onClick={() => valid && copy(parsed.data)}
                >
                  <CopyIcon />
                </Button>
              </div>
              {touched && error ? (
                <FieldError>{error}</FieldError>
              ) : (
                <FieldDescription>
                  Hålls hemlig på servern och skickas inte till någon besökare
                  förrän nedräkningen når noll.
                </FieldDescription>
              )}
            </Field>

            {dirty && (valid || !trimmed) && (
              <div className="border-l-2 border-primary bg-primary/5 px-3 py-2 text-xs">
                <p className="font-medium">Osparad ändring</p>
                <p className="break-all text-muted-foreground">
                  {trimmed ? parsed.data : "Länken tas bort"}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Där länken syns
              </span>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  nativeButton={false}
                  render={<Link to="/qr" target="_blank" />}
                >
                  <QrCodeIcon data-icon="inline-start" />
                  /qr, storbild
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  nativeButton={false}
                  render={<Link to="/" search={{ qr: "" }} target="_blank" />}
                >
                  <QrCodeIcon data-icon="inline-start" />
                  Startsidan med QR
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  nativeButton={false}
                  render={<Link to="/" target="_blank" />}
                >
                  <LinkIcon data-icon="inline-start" />
                  Startsidan
                </Button>
              </div>
            </div>
          </form>

          {/* QR preview, only ever shown here before the release. */}
          <div className="flex flex-col items-center gap-2 md:w-44">
            <span className="self-start text-xs font-medium text-muted-foreground md:self-center">
              QR-kod
            </span>
            {preview ? (
              <>
                <QrCode
                  value={preview}
                  title="QR-kod till biljettlänken"
                  className="aspect-square w-40 ring-1 ring-border md:w-full"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => download(preview)}
                >
                  <DownloadSimpleIcon data-icon="inline-start" />
                  Ladda ner (SVG)
                </Button>
              </>
            ) : (
              <div className="well flex aspect-square w-40 items-center justify-center p-4 text-center text-xs text-muted-foreground md:w-full">
                Ingen länk än
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {data.updatedAt ? (
            <>
              Senast ändrad av{" "}
              <span className="font-medium text-foreground">
                {data.updatedBy}
              </span>{" "}
              <time
                dateTime={data.updatedAt}
                title={formatShort(new Date(data.updatedAt))}
              >
                {now === null
                  ? formatShort(new Date(data.updatedAt))
                  : formatRelative(new Date(data.updatedAt), now)}
              </time>
            </>
          ) : (
            "Ingen länk har satts än."
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirm("remove")}
            disabled={!saved || mutation.isPending}
          >
            <TrashIcon data-icon="inline-start" />
            Ta bort
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(saved ?? "")
              setTouched(false)
            }}
            disabled={!dirty || mutation.isPending}
          >
            <ArrowCounterClockwiseIcon data-icon="inline-start" />
            Återställ
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={!dirty || (!!trimmed && !valid) || mutation.isPending}
          >
            <CheckIcon data-icon="inline-start" />
            {mutation.isPending ? "Sparar…" : "Spara"}
          </Button>
        </div>
      </CardFooter>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "remove" ? "Ta bort länken?" : "Byta länk nu?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "remove"
                ? released
                  ? "Biljetterna är redan släppta. Köpknappen och QR-koden försvinner direkt för alla besökare."
                  : "Ingen länk visas när biljetterna släpps, tills du sätter en ny."
                : "Biljetterna är redan släppta. Köpknappen och QR-koden byts direkt, och gamla QR-koder (t.ex. utskrivna) slutar leda rätt."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <Button
              variant={confirm === "remove" ? "destructive" : "default"}
              onClick={() => {
                mutation.mutate(
                  confirm === "remove" ? null : (parsed.data ?? null)
                )
                setConfirm(null)
              }}
            >
              {confirm === "remove" ? "Ta bort" : "Byt länk"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function Status({
  saved,
  released,
}: {
  saved: string | null
  released: boolean
}) {
  if (saved && released)
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <span className="size-1.5 rounded-full bg-current" />
        Publicerad
      </Badge>
    )
  if (saved)
    return (
      <Badge variant="secondary">
        <LockSimpleIcon data-icon="inline-start" />
        Hemlig till släppet
      </Badge>
    )
  if (released)
    return (
      <Badge variant="destructive">
        <WarningIcon data-icon="inline-start" />
        Saknas
      </Badge>
    )
  return <Badge variant="outline">Ingen länk</Badge>
}

function Notice({
  tone,
  children,
}: {
  tone: "warn" | "danger"
  children: React.ReactNode
}) {
  return (
    <p
      role={tone === "danger" ? "alert" : undefined}
      className={`flex items-start gap-2 border-l-2 px-3 py-2 text-xs ${
        tone === "danger"
          ? "border-destructive bg-destructive/10 text-destructive"
          : "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      }`}
    >
      <WarningIcon className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** "3 h 20 min", for the warning. */
function formatLeft(ms: number) {
  const d = splitDuration(ms)
  if (d.days) return `${d.days} d ${d.hours} h`
  if (d.hours) return `${d.hours} h ${d.minutes} min`
  return `${d.minutes} min`
}
