// lib/date-separator-utils.ts

export function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const messageDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  if (messageDay.getTime() === today.getTime()) return "Hari ini";
  if (messageDay.getTime() === yesterday.getTime()) return "Kemarin";

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function shouldShowDateSeparator(
  currentMsg: { createdAt: string },
  previousMsg: { createdAt: string } | null
): boolean {
  if (!previousMsg) return true; // First message always gets separator

  const current = new Date(currentMsg.createdAt);
  const previous = new Date(previousMsg.createdAt);

  return (
    current.getFullYear() !== previous.getFullYear() ||
    current.getMonth() !== previous.getMonth() ||
    current.getDate() !== previous.getDate()
  );
}
