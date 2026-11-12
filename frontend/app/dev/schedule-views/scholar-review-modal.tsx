"use client";

import { useEffect, useState } from "react";
import { MenteeMonitoringClient } from "@/components/mentee-monitoring/mentee-monitoring-client";
import { MenteeDetailsSkeleton } from "@/components/mentee-monitoring/mentee-details-skeleton";
import styles from "@/components/mentee-monitoring/mentee-review.module.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { backendGet } from "@/lib/client/api-client";
import type { MenteeReview } from "@/lib/types/mentee-review";

type ScholarReviewModalProps = {
  uid: string | null;
  name: string | null;
  weekNum: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Directory-style mentee review in a dialog — same payload as
 * `/dashboard/directory/[uid]` (`GET …/directory-review`).
 */
export function ScholarReviewModal({
  uid,
  name,
  weekNum,
  open,
  onOpenChange,
}: ScholarReviewModalProps) {
  const [week, setWeek] = useState<number | null>(weekNum);
  const [review, setReview] = useState<MenteeReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !uid) return;
    setWeek(weekNum);
  }, [open, uid, weekNum]);

  useEffect(() => {
    if (!open || !uid) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (week != null && week > 0) params.set("week", String(week));
    const query = params.toString();
    const path = `/api/auth/mentees/${encodeURIComponent(uid)}/directory-review${
      query ? `?${query}` : ""
    }`;

    void backendGet<MenteeReview>(path).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setReview(result.data);
        setError(null);
      } else {
        setReview(null);
        setError(result.error || "Failed to load scholar review");
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, uid, week]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-[1160px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1160px]">
        <DialogHeader className="sr-only">
          <DialogTitle>{name ?? "Scholar review"}</DialogTitle>
          <DialogDescription>
            Directory mentee review for the selected scholar.
          </DialogDescription>
        </DialogHeader>
        <div className={`${styles.surface} min-h-0 flex-1 overflow-y-auto px-4 pt-7 pb-16 sm:px-6`}>
          {loading ? <MenteeDetailsSkeleton /> : null}
          {!loading && error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {!loading && review && uid ? (
            <MenteeMonitoringClient
              mentees={[review.mentee]}
              review={review}
              selectedWeek={week}
              detailPath={`/dashboard/directory/${encodeURIComponent(uid)}`}
              onNavigateWeek={(nextWeek) => setWeek(nextWeek)}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
