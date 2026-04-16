import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Post } from "@shared/schema";

type ScheduleCalendarProps = {
  posts: Post[];
};

export default function ScheduleCalendar({ posts }: ScheduleCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Filter posts that are scheduled and have a valid scheduledTime
  const scheduledPosts = posts.filter(
    (post) => post.status === "scheduled" && post.scheduledTime !== null
  );

  // Convert scheduledTimes to local dates
  const scheduledDates = useMemo(() => {
    return scheduledPosts.map((post) => {
      // Parse the scheduledTime as a Date object (already in UTC)
      const utcDate = new Date(post.scheduledTime!);

      // Convert UTC to local time
      const localDate = new Date(utcDate.toLocaleString("en-US", { timeZone: "UTC" }));

      console.log("Retrieved scheduledTime (UTC):", utcDate.toISOString()); // Log the UTC time
      console.log("Converted scheduledTime (local):", localDate.toLocaleString()); // Log the local time

      return localDate;
    });
  }, [scheduledPosts]);

  // If no scheduled posts, display a message
  if (scheduledPosts.length === 0) {
    return (
      <div className="text-center text-muted-foreground">
        No scheduled posts found.
      </div>
    );
  }

  return (
    <Calendar
      mode="single"
      selected={selectedDate}
      onSelect={setSelectedDate} // Optional: Allow user to select a date
      modifiers={{
        scheduled: scheduledDates,
      }}
      modifiersStyles={{
        scheduled: {
          backgroundColor: "hsl(var(--primary) / 0.1)",
          borderRadius: "100%",
        },
      }}
      className="rounded-md border"
    />
  );
}