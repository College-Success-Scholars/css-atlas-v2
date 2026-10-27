/**
 * Generated Postgres types for public schema. Do not edit by hand.
 * Regen: npm run db:types --prefix backend
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3"
  }
  public: {
    Tables: {
      am_pm_form_logs: {
        Row: {
          created_at: string | null
          id: number
          leader_name: string | null
          shift: string | null
          task_completion: Json | null
          uid: string | null
        }
        Insert: {
          created_at?: string | null
          id?: never
          leader_name?: string | null
          shift?: string | null
          task_completion?: Json | null
          uid?: string | null
        }
        Update: {
          created_at?: string | null
          id?: never
          leader_name?: string | null
          shift?: string | null
          task_completion?: Json | null
          uid?: string | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          description: string | null
          end_time: string
          google_event_id: string
          id: string
          location: string | null
          recording_url: string | null
          start_time: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          end_time: string
          google_event_id: string
          id?: string
          location?: string | null
          recording_url?: string | null
          start_time: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          end_time?: string
          google_event_id?: string
          id?: string
          location?: string | null
          recording_url?: string | null
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_sync_state: {
        Row: {
          id: number
          last_synced_at: string | null
          sync_token: string | null
        }
        Insert: {
          id?: number
          last_synced_at?: string | null
          sync_token?: string | null
        }
        Update: {
          id?: number
          last_synced_at?: string | null
          sync_token?: string | null
        }
        Relationships: []
      }
      career_opportunities: {
        Row: {
          created_at: string
          id: number
          link: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          link?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          link?: string | null
        }
        Relationships: []
      }
      daily_scholar_activity: {
        Row: {
          activity_date: string
          duration_minutes: number | null
          log_source: string
          scholar_uid: string
          week_num: number | null
        }
        Insert: {
          activity_date: string
          duration_minutes?: number | null
          log_source: string
          scholar_uid: string
          week_num?: number | null
        }
        Update: {
          activity_date?: string
          duration_minutes?: number | null
          log_source?: string
          scholar_uid?: string
          week_num?: number | null
        }
        Relationships: []
      }
      dev_test_profiles: {
        Row: {
          app_role: string | null
          cohort: number | null
          created_at: string
          fd_required: number | null
          first_name: string | null
          id: string
          is_active: boolean
          label: string
          last_name: string | null
          mentee_count: number
          mentee_uids: string[]
          program_role: string | null
          roster_uid: string
          ss_required: number | null
          teams: string[]
        }
        Insert: {
          app_role?: string | null
          cohort?: number | null
          created_at?: string
          fd_required?: number | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          label: string
          last_name?: string | null
          mentee_count?: number
          mentee_uids?: string[]
          program_role?: string | null
          roster_uid: string
          ss_required?: number | null
          teams?: string[]
        }
        Update: {
          app_role?: string | null
          cohort?: number | null
          created_at?: string
          fd_required?: number | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          label?: string
          last_name?: string | null
          mentee_count?: number
          mentee_uids?: string[]
          program_role?: string | null
          roster_uid?: string
          ss_required?: number | null
          teams?: string[]
        }
        Relationships: []
      }
      front_desk_logs: {
        Row: {
          action_type: string | null
          created_at: string | null
          id: string
          rep_name: string | null
          scholar_name: string | null
          scholar_uid: string | null
          submitted_by_email: string | null
        }
        Insert: {
          action_type?: string | null
          created_at?: string | null
          id?: string
          rep_name?: string | null
          scholar_name?: string | null
          scholar_uid?: string | null
          submitted_by_email?: string | null
        }
        Update: {
          action_type?: string | null
          created_at?: string | null
          id?: string
          rep_name?: string | null
          scholar_name?: string | null
          scholar_uid?: string | null
          submitted_by_email?: string | null
        }
        Relationships: []
      }
      front_desk_records_legacy: {
        Row: {
          excuse: string | null
          excuse_min: number | null
          fri_min: number | null
          id: number
          mon_min: number | null
          thurs_min: number | null
          tues_min: number | null
          uid: number | null
          wed_min: number | null
          week_num: number | null
        }
        Insert: {
          excuse?: string | null
          excuse_min?: number | null
          fri_min?: number | null
          id?: number
          mon_min?: number | null
          thurs_min?: number | null
          tues_min?: number | null
          uid?: number | null
          wed_min?: number | null
          week_num?: number | null
        }
        Update: {
          excuse?: string | null
          excuse_min?: number | null
          fri_min?: number | null
          id?: number
          mon_min?: number | null
          thurs_min?: number | null
          tues_min?: number | null
          uid?: number | null
          wed_min?: number | null
          week_num?: number | null
        }
        Relationships: []
      }
      mcf_form_logs: {
        Row: {
          created_at: string
          id: string
          meeting_date: string | null
          meeting_notes: string | null
          meeting_time: string | null
          mentee_name: string | null
          mentee_uid: string | null
          mentor_name: string | null
          mentor_uid: string | null
          met_in_person: string | null
          needs_tutor: string | null
          reason_no_meeting: string | null
          submitted_by_email: string | null
          support_rank: string | null
          tasks_completed: string | null
          tutoring_status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_date?: string | null
          meeting_notes?: string | null
          meeting_time?: string | null
          mentee_name?: string | null
          mentee_uid?: string | null
          mentor_name?: string | null
          mentor_uid?: string | null
          met_in_person?: string | null
          needs_tutor?: string | null
          reason_no_meeting?: string | null
          submitted_by_email?: string | null
          support_rank?: string | null
          tasks_completed?: string | null
          tutoring_status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          meeting_date?: string | null
          meeting_notes?: string | null
          meeting_time?: string | null
          mentee_name?: string | null
          mentee_uid?: string | null
          mentor_name?: string | null
          mentor_uid?: string | null
          met_in_person?: string | null
          needs_tutor?: string | null
          reason_no_meeting?: string | null
          submitted_by_email?: string | null
          support_rank?: string | null
          tasks_completed?: string | null
          tutoring_status?: string | null
        }
        Relationships: []
      }
      mentee_meeting_preferences: {
        Row: {
          created_at: string
          meeting_time: string
          mentee_uid: string
          mentor_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          meeting_time: string
          mentee_uid: string
          mentor_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          meeting_time?: string
          mentee_uid?: string
          mentor_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "mentee_meeting_preferences_mentee_uid_fkey"
            columns: ["mentee_uid"]
            isOneToOne: false
            referencedRelation: "user_roster"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "mentee_meeting_preferences_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_mentee: {
        Row: {
          created_at: string
          id: number
          mentee_uid: string
          mentor_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          mentee_uid: string
          mentor_id: string
        }
        Update: {
          created_at?: string
          id?: never
          mentee_uid?: string
          mentor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_mentee_mentee_uid_fkey"
            columns: ["mentee_uid"]
            isOneToOne: false
            referencedRelation: "user_roster"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "mentor_mentee_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          attempt_count: number
          channel: string
          channel_target: string
          created_at: string
          error: string | null
          event_ref_id: string | null
          event_type: string
          id: string
          idempotency_key: string
          payload: Json
          recipient_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          attempt_count?: number
          channel: string
          channel_target: string
          created_at?: string
          error?: string | null
          event_ref_id?: string | null
          event_type: string
          id?: string
          idempotency_key: string
          payload: Json
          recipient_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempt_count?: number
          channel?: string
          channel_target?: string
          created_at?: string
          error?: string | null
          event_ref_id?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string
          payload?: Json
          recipient_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          app_role: string | null
          cohort: number | null
          created_at: string
          emails: string[] | null
          fd_required: number | null
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          majors: string[] | null
          mentee_count: number | null
          minors: string[] | null
          phone_number: string | null
          program_role: string | null
          slack_user_id: string | null
          ss_required: number | null
          status: string | null
          student_id: string | null
          teams: string[] | null
        }
        Insert: {
          app_role?: string | null
          cohort?: number | null
          created_at?: string
          emails?: string[] | null
          fd_required?: number | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          majors?: string[] | null
          mentee_count?: number | null
          minors?: string[] | null
          phone_number?: string | null
          program_role?: string | null
          slack_user_id?: string | null
          ss_required?: number | null
          status?: string | null
          student_id?: string | null
          teams?: string[] | null
        }
        Update: {
          app_role?: string | null
          cohort?: number | null
          created_at?: string
          emails?: string[] | null
          fd_required?: number | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          majors?: string[] | null
          mentee_count?: number | null
          minors?: string[] | null
          phone_number?: string | null
          program_role?: string | null
          slack_user_id?: string | null
          ss_required?: number | null
          status?: string | null
          student_id?: string | null
          teams?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_roster"
            referencedColumns: ["uid"]
          },
        ]
      }
      scholar_shift_assignments: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          scholar_id: string
          semester_id: number
          session_kind: Database["public"]["Enums"]["session_kind"]
          start_time: string
          week_minute_range: unknown
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          scholar_id: string
          semester_id: number
          session_kind: Database["public"]["Enums"]["session_kind"]
          start_time: string
          week_minute_range?: unknown
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          scholar_id?: string
          semester_id?: number
          session_kind?: Database["public"]["Enums"]["session_kind"]
          start_time?: string
          week_minute_range?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "scholar_shift_assignments_scholar_id_fkey"
            columns: ["scholar_id"]
            isOneToOne: false
            referencedRelation: "user_roster"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "scholar_shift_assignments_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      scholar_week_excuses: {
        Row: {
          description: string | null
          excuse_min: number | null
          kind: string
          scholar_uid: string
          updated_at: string
          updated_by: string | null
          week_num: number
          week_start: string
        }
        Insert: {
          description?: string | null
          excuse_min?: number | null
          kind: string
          scholar_uid: string
          updated_at?: string
          updated_by?: string | null
          week_num: number
          week_start: string
        }
        Update: {
          description?: string | null
          excuse_min?: number | null
          kind?: string
          scholar_uid?: string
          updated_at?: string
          updated_by?: string | null
          week_num?: number
          week_start?: string
        }
        Relationships: []
      }
      scholar_weekly_stats: {
        Row: {
          fd_completion: number
          fd_minutes: number
          grade_trend: string | null
          is_flagged: boolean
          mcf_submitted: boolean
          missed_tutoring: boolean
          scholar_uid: string
          semester_id: number
          ss_completion: number
          ss_minutes: number
          updated_at: string
          wahf_submitted: boolean
          week_num: number
          weeks_flagged: number
          wpl_submitted: boolean
        }
        Insert: {
          fd_completion?: number
          fd_minutes?: number
          grade_trend?: string | null
          is_flagged?: boolean
          mcf_submitted?: boolean
          missed_tutoring?: boolean
          scholar_uid: string
          semester_id: number
          ss_completion?: number
          ss_minutes?: number
          updated_at?: string
          wahf_submitted?: boolean
          week_num: number
          weeks_flagged?: number
          wpl_submitted?: boolean
        }
        Update: {
          fd_completion?: number
          fd_minutes?: number
          grade_trend?: string | null
          is_flagged?: boolean
          mcf_submitted?: boolean
          missed_tutoring?: boolean
          scholar_uid?: string
          semester_id?: number
          ss_completion?: number
          ss_minutes?: number
          updated_at?: string
          wahf_submitted?: boolean
          week_num?: number
          weeks_flagged?: number
          wpl_submitted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "scholar_weekly_stats_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      semester_breaks: {
        Row: {
          created_at: string
          end_date: string
          id: number
          name: string
          semester_id: number
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: number
          name: string
          semester_id: number
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: number
          name?: string
          semester_id?: number
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "semester_breaks_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      semesters: {
        Row: {
          created_at: string
          end_date: string
          id: number
          is_active: boolean
          iso_week_offset: number
          name: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: number
          is_active?: boolean
          iso_week_offset?: number
          name: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: number
          is_active?: boolean
          iso_week_offset?: number
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      study_session_logs: {
        Row: {
          action_type: string | null
          created_at: string | null
          id: string
          rep_name: string | null
          scholar_name: string | null
          scholar_uid: string | null
          session_type: string | null
          submitted_by_email: string | null
        }
        Insert: {
          action_type?: string | null
          created_at?: string | null
          id?: string
          rep_name?: string | null
          scholar_name?: string | null
          scholar_uid?: string | null
          session_type?: string | null
          submitted_by_email?: string | null
        }
        Update: {
          action_type?: string | null
          created_at?: string | null
          id?: string
          rep_name?: string | null
          scholar_name?: string | null
          scholar_uid?: string | null
          session_type?: string | null
          submitted_by_email?: string | null
        }
        Relationships: []
      }
      study_session_records_legacy: {
        Row: {
          excuse: string | null
          excuse_min: number | null
          fri_min: number | null
          id: number
          mon_min: number | null
          thurs_min: number | null
          tues_min: number | null
          uid: number | null
          wed_min: number | null
          week_num: number | null
        }
        Insert: {
          excuse?: string | null
          excuse_min?: number | null
          fri_min?: number | null
          id?: number
          mon_min?: number | null
          thurs_min?: number | null
          tues_min?: number | null
          uid?: number | null
          wed_min?: number | null
          week_num?: number | null
        }
        Update: {
          excuse?: string | null
          excuse_min?: number | null
          fri_min?: number | null
          id?: number
          mon_min?: number | null
          thurs_min?: number | null
          tues_min?: number | null
          uid?: number | null
          wed_min?: number | null
          week_num?: number | null
        }
        Relationships: []
      }
      traffic: {
        Row: {
          created_at: string
          duration_min: string | null
          id: number
          traffic_type: string | null
          uid: string | null
        }
        Insert: {
          created_at?: string
          duration_min?: string | null
          id?: number
          traffic_type?: string | null
          uid?: string | null
        }
        Update: {
          created_at?: string
          duration_min?: string | null
          id?: number
          traffic_type?: string | null
          uid?: string | null
        }
        Relationships: []
      }
      traffic_weekly_summary: {
        Row: {
          semester_id: number
          total_entries: number
          tutoring_sessions: number
          week_num: number
        }
        Insert: {
          semester_id: number
          total_entries?: number
          tutoring_sessions?: number
          week_num: number
        }
        Update: {
          semester_id?: number
          total_entries?: number
          tutoring_sessions?: number
          week_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "traffic_weekly_summary_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_report_logs: {
        Row: {
          courses: string[]
          created_at: string | null
          date: string | null
          end_time: string
          id: number
          scholar_uid: string | null
          start_time: string
          tutor_name: string
        }
        Insert: {
          courses: string[]
          created_at?: string | null
          date?: string | null
          end_time: string
          id?: never
          scholar_uid?: string | null
          start_time: string
          tutor_name: string
        }
        Update: {
          courses?: string[]
          created_at?: string | null
          date?: string | null
          end_time?: string
          id?: never
          scholar_uid?: string | null
          start_time?: string
          tutor_name?: string
        }
        Relationships: []
      }
      user_roster: {
        Row: {
          app_role: string | null
          cohort: number | null
          created_at: string
          email: string | null
          fd_required: number | null
          first_name: string | null
          id: number
          invite_accepted_at: string | null
          invite_sent_at: string | null
          last_name: string | null
          majors: string[] | null
          mentee_count: number | null
          mentee_uids: string[] | null
          minors: string[] | null
          phone_number: string | null
          program_role: string | null
          ss_required: number | null
          status: string | null
          teams: string[] | null
          uid: string | null
        }
        Insert: {
          app_role?: string | null
          cohort?: number | null
          created_at?: string
          email?: string | null
          fd_required?: number | null
          first_name?: string | null
          id?: number
          invite_accepted_at?: string | null
          invite_sent_at?: string | null
          last_name?: string | null
          majors?: string[] | null
          mentee_count?: number | null
          mentee_uids?: string[] | null
          minors?: string[] | null
          phone_number?: string | null
          program_role?: string | null
          ss_required?: number | null
          status?: string | null
          teams?: string[] | null
          uid?: string | null
        }
        Update: {
          app_role?: string | null
          cohort?: number | null
          created_at?: string
          email?: string | null
          fd_required?: number | null
          first_name?: string | null
          id?: number
          invite_accepted_at?: string | null
          invite_sent_at?: string | null
          last_name?: string | null
          majors?: string[] | null
          mentee_count?: number | null
          mentee_uids?: string[] | null
          minors?: string[] | null
          phone_number?: string | null
          program_role?: string | null
          ss_required?: number | null
          status?: string | null
          teams?: string[] | null
          uid?: string | null
        }
        Relationships: []
      }
      whaf_form_logs: {
        Row: {
          assignment_grades: Json | null
          course_change_details: string | null
          course_changes: string | null
          created_at: string
          id: string
          missed_assignments: string | null
          missed_classes: string | null
          scholar_name: string | null
          scholar_uid: string | null
          submitted_by_email: string | null
          team_leader_contact: string | null
          tl_meeting_in_person: string | null
        }
        Insert: {
          assignment_grades?: Json | null
          course_change_details?: string | null
          course_changes?: string | null
          created_at?: string
          id?: string
          missed_assignments?: string | null
          missed_classes?: string | null
          scholar_name?: string | null
          scholar_uid?: string | null
          submitted_by_email?: string | null
          team_leader_contact?: string | null
          tl_meeting_in_person?: string | null
        }
        Update: {
          assignment_grades?: Json | null
          course_change_details?: string | null
          course_changes?: string | null
          created_at?: string
          id?: string
          missed_assignments?: string | null
          missed_classes?: string | null
          scholar_name?: string | null
          scholar_uid?: string | null
          submitted_by_email?: string | null
          team_leader_contact?: string | null
          tl_meeting_in_person?: string | null
        }
        Relationships: []
      }
      wpl_form_logs: {
        Row: {
          created_at: string | null
          explanation: string | null
          full_name: string | null
          hours_worked: number | null
          id: number
          met_with_all: string | null
          projects: Json | null
          scholar_uid: string | null
          submitted_by_email: string | null
        }
        Insert: {
          created_at?: string | null
          explanation?: string | null
          full_name?: string | null
          hours_worked?: number | null
          id?: never
          met_with_all?: string | null
          projects?: Json | null
          scholar_uid?: string | null
          submitted_by_email?: string | null
        }
        Update: {
          created_at?: string | null
          explanation?: string | null
          full_name?: string | null
          hours_worked?: number | null
          id?: never
          met_with_all?: string | null
          projects?: Json | null
          scholar_uid?: string | null
          submitted_by_email?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_grade_trend: { Args: { scores: number[] }; Returns: string }
      count_break_days: {
        Args: { p_end: string; p_semester_id: number; p_start: string }
        Returns: number
      }
      extract_avg_grade_pct: { Args: { grades: Json }; Returns: number }
      full_resync_daily_scholar_activity: { Args: never; Returns: undefined }
      get_effective_requirement: {
        Args: {
          p_base_required: number
          p_semester_id: number
          p_week_start: string
        }
        Returns: number
      }
      get_mentee_activity: {
        Args: { p_semester_id: number; p_week_num: number }
        Returns: {
          activity_date: string
          duration_minutes: number
          log_source: string
          scholar_uid: string
        }[]
      }
      get_my_mentees: {
        Args: never
        Returns: {
          fd_required: number
          first_name: string
          last_name: string
          scholar_uid: string
          ss_required: number
        }[]
      }
      get_week_breaks: {
        Args: { p_semester_id: number; p_week_num: number }
        Returns: {
          break_days: number
          breaks: Json
          is_break_week: boolean
        }[]
      }
      get_weekly_memo: {
        Args: { p_semester_id: number; p_week_num: number }
        Returns: Json
      }
      is_break_day: {
        Args: { p_date: string; p_semester_id: number }
        Returns: boolean
      }
      is_developer: { Args: never; Returns: boolean }
      is_team_leader_or_above: { Args: never; Returns: boolean }
      replace_mentor_mentee_assignments: {
        Args: { p_mentee_uids: string[]; p_mentor_id: string }
        Returns: undefined
      }
      safe_text_array: { Args: { val: Json }; Returns: string[] }
      sync_mentee_denormalization: {
        Args: { p_mentor_id: string }
        Returns: undefined
      }
    }
    Enums: {
      session_kind: "front_desk" | "study_session"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      session_kind: ["front_desk", "study_session"],
    },
  },
} as const
