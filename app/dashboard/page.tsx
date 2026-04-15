import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CreditsRow, CreditTransactionRow, VideoRow } from "@/lib/supabase/types";
import { Sidebar } from "./_components/Sidebar";
import { StatsBar } from "./_components/StatsBar";
import { GenerateForm } from "./_components/GenerateForm";
import { VideoList } from "./_components/VideoList";
import { ActivityFeed } from "./_components/ActivityFeed";
import { PaymentSuccessToast } from "./_components/PaymentSuccessToast";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Start of the current calendar month in UTC
  const now = new Date();
  const startOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();

  // All queries run concurrently
  const [
    creditsResult,
    videosResult,
    videosThisMonthResult,
    creditsUsedResult,
    activityResult,
  ] = await Promise.all([
    // Current balance
    supabase
      .from("credits")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),

    // Recent videos (for the video list)
    supabase
      .from("videos")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),

    // Videos generated this calendar month (count only)
    supabase
      .from("videos")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth),

    // Credits spent on video generation (fetch delta column only)
    supabase
      .from("credit_transactions")
      .select("delta")
      .eq("user_id", user.id)
      .eq("reason", "video_generation"),

    // Recent credit transactions for the activity feed
    supabase
      .from("credit_transactions")
      .select("id, delta, reason, created_at, video_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const credits = creditsResult.data as CreditsRow | null;
  const videos = (videosResult.data ?? []) as VideoRow[];
  const videoCount = videosResult.count ?? 0;
  const creditBalance = credits?.balance ?? 0;

  const videosThisMonth = videosThisMonthResult.count ?? 0;

  // Sum absolute value of all video_generation deductions
  const creditsUsed = ((creditsUsedResult.data ?? []) as { delta: number }[]).reduce(
    (sum, row) => sum + Math.abs(row.delta),
    0
  );

  type ActivityRow = Pick<
    CreditTransactionRow,
    "id" | "delta" | "reason" | "created_at" | "video_id"
  >;
  const activity = (activityResult.data ?? []) as ActivityRow[];

  const initials = (user.email ?? "?")[0].toUpperCase();

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar email={user.email ?? ""} initials={initials} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-6">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Dashboard</h1>
            <p className="text-xs text-gray-400">
              Welcome back, {user.email?.split("@")[0]}
            </p>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <PaymentSuccessToast />
            <StatsBar
              videoCount={videoCount}
              creditBalance={creditBalance}
              creditsUsed={creditsUsed}
              videosThisMonth={videosThisMonth}
            />

            <GenerateForm creditBalance={creditBalance} />

            {/* Two-column layout on large screens: video list + activity feed */}
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <VideoList videos={videos} totalCount={videoCount} />
              </div>
              <div className="lg:col-span-1">
                <ActivityFeed transactions={activity} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
