// Who is looking at the directory. Drives both which row shape the API
// returns and which table component renders it. "developer" gets the same
// elevated view as "team_leader".

export type RosterScholarRow = { 
    scholarName: string
    email: string | null
    programRole: string
    teams: string[]
}

export type RosterTLRow = {
    uid: string
    scholarName: string
    cohort: number | null
    email: string | null
    phone: string | null 
    programRole: string
    teams: string[]
    appRole: string | null
}