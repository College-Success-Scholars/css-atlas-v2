# Ubiquitous Language

## Program mission and scope

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Program** | A University of Maryland support program for Latino, Black, and first-generation undergraduates focused on academic, professional, and personal development. | Initiative |
| **Weekly operational signals** | Weekly data points used to detect risk early and guide interventions, including WAHF, WPL, MCF, attendance, tutoring, and traffic. | Metrics, telemetry |
| **Intervention** | A documented support action taken in response to scholar risk signals. | Outreach, check-in action |
| **Resource support** | Program-provided help that enables scholar success in a university environment. | Services, aid |

## Roles and identities

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Scholar** | Any undergraduate program member, regardless of academic year, tracked for weekly outcomes and support needs. | Student |
| **Team Leader** | A paid program employee role, held by a scholar, responsible for mentee support and weekly leadership compliance duties. | TL |
| **Developer** | A specialized Team Leader role responsible for building and maintaining CSS Atlas. | Engineer-only role |
| **Program Admin** | A program operator who manages team leaders and runs meetings, without weekly scholar form obligations. | Admin lead |
| **Primary Team Leader** | The single accountable Team Leader assigned to a scholar for a given campus week. | Co-owner |
| **Mentee** | A scholar in the context of being supported by a Team Leader through mentorship and MCF reporting. | Student (generic) |

## Weekly memo reporting

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Weekly Memo** | The weekly dashboard view summarizing scholar outcomes, team-leader form compliance, and attendance completion for a selected campus week. | Weekly report, snapshot |
| **Campus Week** | The canonical numbered week used to select and compare weekly operational data. | Sprint week, report period |
| **KPI card** | A metric tile showing a weekly performance indicator and optional trend/substats. | Stat box, widget |
| **Scholar follow-up** | A prioritized scholar action-list row with **What's missing** (short labels: Front desk, Study session, WAHF, assignment title) and **How it's missing** (hours/grade meters, WAHF submitted-at or no-submission time). Healthy hours are omitted. | Student risk list, action list |
| **Scholar WAHF** | On the weekly memo **PDF only**: snapshot on-time/late/missing counts and the Needs Attention list of missing or late scholar WAHF. The dashboard memo keeps those people on **Scholar follow-up**. Team leader WAHF is a separate PDF snapshot tile; missing or late TL WAHF names appear on **Team Leader Submissions** with WPL and MCF. | WHAF list, scholar form submissions |
| **Recognition board** | The weekly **WAHF** assignment-grade census: every parsed grade in high (90–100%), mid (70–89%), and low (below 70%) bands. | Shout-outs, highlights |
| **Attendance detail** | Tabular minutes-based completion details by scholar for front desk and study session requirements, plus overall WAHF on-time / late / missing counts for that roster. | Attendance table, minutes log |
| **Team leader performance** | Weekly WPL, MCF, and WAHF compliance for Team Leaders. | TL form table |
| **Scholar follow-up risk** | The finalized weekly decision that a scholar requires active support follow-up. | Risk list |

## Compliance and data terms

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Program member** | A scholar identity enrolled in the program and subject to required weekly policies. | Participant |
| **Front desk completion** | The percentage of required front desk minutes completed by a scholar in the selected week. | FD percent, desk attendance |
| **Study session completion** | The percentage of required study session minutes completed by a scholar in the selected week. | SS percent, study attendance |
| **Form status** | The normalized state of a required form submission: on-time, late, or missing. | Submission state, compliance status |
| **WAHF** | Weekly Academic Honors Form required from all program members that records scholar grade performance. | WHAF, honors form |
| **WPL** | Weekly Project List documenting team-leader hours worked and the work completed during the week. | Project log, work log |
| **MCF** | Mentee Check-in Form submitted by a Team Leader to document a mentee's academic, professional, and personal status and perceived support need. | Check-in note, mentee report |
| **MCF support rating** | A Team Leader's 1-5 rating indicating perceived support need for a mentee, where 3 or higher requires active follow-up. | Risk score |
| **Flag** | A concise risk category on a scholar follow-up row (low completion, low grade, missing/late WAHF). **What's missing** is the short label; **How it's missing** is the meter or time indicator — not healthy completion meters. | Warning, note |
| **Low-grade alert** | A scholar risk signal indicating academic performance in the low-grade band for the week. | Grade warning, poor grade |
| **Scholar ID** | The canonical scholar identity key (University ID) used across systems, sometimes represented as `uid`. | Name-only identity |

## Time and compliance windows

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Campus Week** | Monday 12:00 AM through Sunday 11:59:59 PM in America/New_York. | Reporting period |
| **WAHF deadline** | Thursday at 11:59 PM America/New_York each campus week. | End-of-week form deadline |
| **WPL deadline** | Friday at 5:00 PM America/New_York each campus week. | Team leader form deadline |
| **MCF deadline** | Friday at 5:00 PM America/New_York each campus week. | Check-in deadline |
| **On-time** | A valid submission received by the form's weekly deadline. For **MCF**, every assigned mentee has a check-in by Friday 5:00 PM ET. | Complete |
| **Late** | A valid submission received after deadline but before the next campus week begins. For **MCF**, every assigned mentee has a check-in, and at least one arrived after Friday 5:00 PM ET. | Delayed |
| **Incomplete** | **MCF** only: at least one mentee check-in is in, but not every assigned mentee. Used instead of late/missing while mentees remain. | Partial, in progress |
| **Missing** | No valid submission received by the campus-week rollover or report cutoff. For **MCF**, no mentee check-ins at all. | Not submitted |

## Relationships

- A **Weekly Memo** is scoped to exactly one **Campus Week**.
- A **Weekly Memo** contains multiple **KPI cards**, one **Recognition board** (**WAHF** grade census), one **Attendance detail** section (hours census + overall **WAHF** counts), and one **Team leader performance** section. Missing or late **WAHF** also appears as an **Issue** on **Scholar follow-up**. The export PDF additionally has **Scholar WAHF** and **TL WAHF** snapshot tiles; Needs Attention lists scholar WAHF names separately and folds TL WAHF into Team Leader Submissions with WPL and MCF.
- A **Scholar** has exactly one **Primary Team Leader** per **Campus Week**, except Team Leaders do not have mentors.
- A **Team Leader** is also a **Scholar** identity but is exempt from required front desk and study-session hours while active in the Team Leader role.
- Every **Program member** must submit **WAHF** each **Campus Week**.
- Every **Team Leader** must submit one weekly **WPL** and one **MCF** per assigned mentee each **Campus Week**.
- **Front desk completion** and **Study session completion** apply to non-Team-Leader freshmen and sophomores.
- **WAHF** form-log status uses timezone-aware ET deadlines; **WPL** and **MCF** status is shown on **Team leader performance**, not as scholar requirements. **MCF** with some-but-not-all mentee check-ins is **incomplete**, not late.
- If multiple MCFs exist for one scholar in one week, the latest submitted MCF is canonical for current status.
- Missing **MCF** is always a Team Leader compliance issue and is not by itself automatic **Scholar follow-up risk**.
- Missing or late **WAHF** is a scholar **Issue** on **Scholar follow-up** (**What's missing** is WAHF; **How it's missing** is submitted-at from the form log, or no-submission time). The export PDF still lists those names under **Scholar WAHF**.
- **Scholar follow-up risk** uses a hybrid model: system-derived baseline plus Team Leader judgment.
- **MCF support rating** of 3, 4, or 5 requires active follow-up for that week.
- Source conflicts resolve by precedence: latest valid record, then approved admin correction, then source-of-record, with full audit history retained.
- A **Low-grade alert** is represented as an **Issue** on **Scholar follow-up** (assignment title in **What's missing**, percent meter in **How it's missing**). The full **WAHF** grade census lives on **Recognition board**.

## Example dialogue

> **Dev:** "A scholar submitted **WAHF** Thursday at 11:58 PM ET, and their Team Leader submitted **MCF** Friday at 7:10 PM ET with support rating 4. How should this week classify?"
>
> **Domain expert:** "**WAHF** is on-time, **MCF** is late, and the latest MCF support rating triggers **Scholar follow-up risk** because it's 3 or higher."
>
> **Dev:** "If MCF were missing entirely, would that always flag the scholar?"
>
> **Domain expert:** "No. Missing MCF is always a Team Leader compliance issue, but scholar risk still follows the hybrid model."
>
> **Dev:** "And if two MCFs exist this week?"
>
> **Domain expert:** "Use the latest valid submission as canonical and keep history for audit."
>
> **Dev:** "A team leader submitted **MCF** for one of three mentees before Friday 5:00 PM ET. Late?"
>
> **Domain expert:** "**Incomplete.** Late is only when every assigned mentee has a check-in and at least one arrived after the deadline."

## Flagged ambiguities

- "student" and "scholar" are often used interchangeably; use **Scholar** as the canonical term.
- "attendance" is overloaded; specify **Front desk completion** or **Study session completion** explicitly and only when requirement applies.
- "forms" is too broad; name **WAHF**, **WPL**, and/or **MCF** when discussing compliance.
- "WHAF" appears as a variant spelling in code; use **WAHF** as the canonical domain term.
- "scholar_id", "uid", and "University ID" are the same identity concept; standardize on **Scholar ID** in domain language.
