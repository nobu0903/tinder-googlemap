import { supabaseAdmin } from "@/lib/supabase/server";
import { addDateDays, tokyoDateKey } from "@/lib/admin/growth";
import { isGuestId } from "@/lib/swipe/guest-id";

export class GuestSwipeStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuestSwipeStoreError";
  }
}

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (error.message ?? "").includes("guest_swipe_days")
  );
}

/**
 * Remember that this browser swiped on today's Tokyo date.
 * A signed-in user attaches every mark for that browser to the account.
 */
export async function noteGuestSwipe(
  guestId: string,
  userId: string | null,
  now = new Date(),
): Promise<void> {
  if (!isGuestId(guestId)) {
    throw new GuestSwipeStoreError("Invalid guest id");
  }

  const today = tokyoDateKey(now);
  const oldest = addDateDays(today, -29);

  const inserted = await supabaseAdmin.from("guest_swipe_days").insert({
    guest_id: guestId,
    swipe_date: today,
  });
  if (inserted.error && inserted.error.code !== "23505") {
    if (isMissingTable(inserted.error)) {
      throw new GuestSwipeStoreError("Guest swipe storage is not ready");
    }
    throw new GuestSwipeStoreError("Could not save the guest swipe mark");
  }

  if (userId) {
    const attached = await supabaseAdmin
      .from("guest_swipe_days")
      .update({ user_id: userId })
      .eq("guest_id", guestId);
    if (attached.error) {
      if (isMissingTable(attached.error)) {
        throw new GuestSwipeStoreError("Guest swipe storage is not ready");
      }
      throw new GuestSwipeStoreError("Could not attach the guest swipe mark");
    }
  }

  await supabaseAdmin.from("guest_swipe_days").delete().lt("swipe_date", oldest);
}
