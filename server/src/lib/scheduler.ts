import { prisma } from "./prisma.js";
import { sendPushToUser, pushEnabled } from "./push.js";
import { logger } from "./logger.js";

/** Rappels de calendrier : pousse une notification ~30 min avant les événements. */
export function startReminderScheduler(): void {
  if (!pushEnabled) return;
  const TICK = 60_000; // 1 min

  const tick = async () => {
    try {
      const now = new Date();
      const soon = new Date(now.getTime() + 30 * 60_000);
      const events = await prisma.event.findMany({
        where: { reminderSentAt: null, allDay: false, startAt: { gte: now, lte: soon } },
        include: { user: true },
      });
      for (const ev of events) {
        const prefs = (ev.user.preferences as { notifications?: { calendarReminders?: boolean } } | null) ?? {};
        const wants = prefs.notifications?.calendarReminders !== false; // activé par défaut
        if (wants) {
          const when = ev.startAt.toLocaleString("fr-CH", { hour: "2-digit", minute: "2-digit" });
          await sendPushToUser(ev.userId, {
            title: `Rappel : ${ev.title}`,
            body: ev.location ? `${when} · ${ev.location}` : `À ${when}`,
            url: "/app/planning",
            tag: `event-${ev.id}`,
          });
        }
        await prisma.event.update({ where: { id: ev.id }, data: { reminderSentAt: now } });
      }
    } catch (e) {
      logger.warn({ err: (e as Error).message }, "reminder scheduler tick failed");
    }
  };

  setInterval(tick, TICK);
  logger.info("Reminder scheduler started");
}
