"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { User, GraduationCap, Briefcase, Users, Plus, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { addMentee, removeMentee } from "@/lib/server/actions"
import type { ProfileRow, MenteeRow } from "@/lib/types/supabase"

const TABS = [
  { id: "personal", label: "Personal", icon: User },
  { id: "academic", label: "Academic", icon: GraduationCap },
  { id: "program", label: "Program", icon: Briefcase },
  { id: "mentees", label: "Mentees", icon: Users },
] as const

type TabId = (typeof TABS)[number]["id"]

export type MenteeCandidate = {
  uid: string
  first_name: string | null
  last_name: string | null
}

function displayName(person: {
  first_name: string | null
  last_name: string | null
}): string {
  return [person.first_name, person.last_name].filter(Boolean).join(" ") || "—"
}

export default function SettingsClient({
  profile,
  mentees,
  candidates = [],
  canManageMentees = false,
  readOnlyReason = null,
}: {
  profile: ProfileRow
  mentees: MenteeRow[]
  candidates?: MenteeCandidate[]
  canManageMentees?: boolean
  readOnlyReason?: string | null
}) {
  const [activeTab, setActiveTab] = useState<TabId>("personal")

  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Profile"

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          {displayName} &middot; View your profile information
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
        <nav
          role="tablist"
          aria-label="Settings sections"
          className="flex sm:flex-col gap-1 sm:w-48 shrink-0"
        >
          {TABS.map((tab) => {
            const selected = activeTab === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="settings-panel"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer text-left ${
                  selected
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {tab.label}
              </button>
            )
          })}
        </nav>

        <div
          id="settings-panel"
          role="tabpanel"
          aria-label={TABS.find((t) => t.id === activeTab)?.label}
          className="flex-1 min-w-0"
        >
          {activeTab === "personal" && <PersonalTab profile={profile} />}
          {activeTab === "academic" && <AcademicTab profile={profile} />}
          {activeTab === "program" && <ProgramTab profile={profile} />}
          {activeTab === "mentees" && (
            <MenteesTab
              mentees={mentees}
              candidates={candidates}
              canManageMentees={canManageMentees}
              readOnlyReason={readOnlyReason}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ReadonlyField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input disabled value={value ?? "—"} />
    </div>
  )
}

function TagList({ label, items }: { label: string; items: string[] | null | undefined }) {
  const list = items?.filter(Boolean) ?? []
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {list.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {list.map((item) => (
            <Badge key={item} variant="secondary">
              {item}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">—</p>
      )}
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
      {children}
    </h2>
  )
}

function PersonalTab({ profile }: { profile: ProfileRow }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-6 space-y-6">
        <SectionHeading>Personal Info</SectionHeading>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadonlyField label="First name" value={profile.first_name} />
          <ReadonlyField label="Last name" value={profile.last_name} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadonlyField label="Phone number" value={profile.phone_number} />
          <ReadonlyField label="Student ID" value={profile.student_id} />
        </div>

        <TagList label="Email addresses" items={profile.emails} />
      </CardContent>
    </Card>
  )
}

function AcademicTab({ profile }: { profile: ProfileRow }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-6 space-y-6">
        <SectionHeading>Academic Info</SectionHeading>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadonlyField label="Cohort" value={profile.cohort} />
        </div>

        <TagList label="Majors" items={profile.majors} />
        <TagList label="Minors" items={profile.minors} />
      </CardContent>
    </Card>
  )
}

function ProgramTab({ profile }: { profile: ProfileRow }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-6 space-y-6">
        <SectionHeading>Program Info</SectionHeading>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadonlyField label="Status" value={profile.status} />
          <ReadonlyField label="App role" value={profile.app_role} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadonlyField label="Program role" value={profile.program_role} />
          <ReadonlyField label="Mentee count" value={profile.mentee_count} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadonlyField label="FD sessions required" value={profile.fd_required} />
          <ReadonlyField label="SS sessions required" value={profile.ss_required} />
        </div>

        <TagList label="Teams" items={profile.teams} />
      </CardContent>
    </Card>
  )
}

function MenteesTab({
  mentees,
  candidates,
  canManageMentees,
  readOnlyReason,
}: {
  mentees: MenteeRow[]
  candidates: MenteeCandidate[]
  canManageMentees: boolean
  readOnlyReason: string | null
}) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedUid, setSelectedUid] = useState("")
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<MenteeRow | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const available = useMemo(() => {
    const assigned = new Set(
      mentees.flatMap((mentee) => (mentee.scholar_uid ? [mentee.scholar_uid] : [])),
    )
    return candidates.filter((candidate) => !assigned.has(candidate.uid))
  }, [candidates, mentees])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return available
    return available.filter((candidate) =>
      [candidate.first_name, candidate.last_name, candidate.uid]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    )
  }, [available, query])

  function handleAddOpenChange(open: boolean) {
    setAddOpen(open)
    if (!open) {
      setQuery("")
      setSelectedUid("")
      setAddError(null)
    }
  }

  function handleRemoveOpenChange(open: boolean) {
    if (!open) {
      setRemoveTarget(null)
      setRemoveError(null)
    }
  }

  async function handleAdd() {
    if (!selectedUid) return
    setAdding(true)
    setAddError(null)
    const result = await addMentee(selectedUid)
    setAdding(false)
    if ("error" in result) {
      setAddError(result.error)
      return
    }
    handleAddOpenChange(false)
    router.refresh()
  }

  async function handleRemove() {
    const uid = removeTarget?.scholar_uid
    if (!uid) return
    setRemoving(true)
    setRemoveError(null)
    const result = await removeMentee(uid)
    setRemoving(false)
    if ("error" in result) {
      setRemoveError(result.error)
      return
    }
    handleRemoveOpenChange(false)
    router.refresh()
  }

  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <SectionHeading>Assigned Mentees</SectionHeading>
            <p className="text-sm text-muted-foreground">
              {mentees.length} {mentees.length === 1 ? "mentee" : "mentees"}
            </p>
          </div>
          {canManageMentees && (
            <Button size="sm" onClick={() => handleAddOpenChange(true)}>
              <Plus className="size-4" />
              Add mentee
            </Button>
          )}
        </div>

        {readOnlyReason && (
          <p className="text-sm text-muted-foreground">{readOnlyReason}</p>
        )}

        {mentees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No mentees assigned.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">FD Required</TableHead>
                  <TableHead className="text-right">SS Required</TableHead>
                  {canManageMentees && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {mentees.map((mentee) => (
                  <TableRow key={mentee.scholar_uid}>
                    <TableCell className="font-medium">
                      {displayName(mentee)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {mentee.fd_required ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {mentee.ss_required ?? "—"}
                    </TableCell>
                    {canManageMentees && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={!mentee.scholar_uid}
                          aria-label={`Remove ${displayName(mentee)}`}
                          onClick={() => {
                            setRemoveError(null)
                            setRemoveTarget(mentee)
                          }}
                        >
                          <Trash2 className="size-4" />
                          Remove
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={handleAddOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add mentee</DialogTitle>
            <DialogDescription>
              Choose an enrolled scholar to add to your mentee list.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder="Search by name or UID"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setSelectedUid("")
              }}
            />
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {available.length === 0
                  ? "Every enrolled scholar is already assigned to you."
                  : "No matching scholars."}
              </p>
            ) : (
              <Select value={selectedUid} onValueChange={setSelectedUid}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a scholar" />
                </SelectTrigger>
                <SelectContent>
                  {filtered.map((candidate) => (
                    <SelectItem key={candidate.uid} value={candidate.uid}>
                      {displayName(candidate)} · {candidate.uid}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {addError && <p className="text-sm text-destructive">{addError}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleAddOpenChange(false)}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!selectedUid || adding}>
              {adding ? "Adding…" : "Add mentee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removeTarget !== null} onOpenChange={handleRemoveOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove mentee?</DialogTitle>
            <DialogDescription>
              {removeTarget
                ? `${displayName(removeTarget)} will no longer appear in your mentee list or weekly memo. Their logs and history are unchanged.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {removeError && (
            <p className="text-sm text-destructive">{removeError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleRemoveOpenChange(false)}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
