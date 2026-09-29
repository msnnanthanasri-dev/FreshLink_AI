import { useQuery, useMutation } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { AppLayout, PageLoading } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, BellOff, CheckCheck, ArrowRight, Apple, Truck, Network, Sprout, Settings } from "lucide-react";
import { fmtDateTime } from "@/components/shared";
import { cn } from "@/lib/utils";

const ICONS: Record<string, any> = {
  application: Apple,
  allocation: Network,
  pickup: Truck,
  impact: Sprout,
  system: Settings,
  listing: Apple,
};

export default function Notifications() {
  const data = useQuery(api.insights.listNotifications, {});
  const markRead = useMutation(api.insights.markNotificationRead);
  const markAll = useMutation(api.insights.markAllNotificationsRead);
  const navigate = useNavigate();

  return (
    <AppLayout title="Notifications" subtitle="Approvals, pickups, allocation updates and completed redistributions.">
      {!data ? (
        <PageLoading />
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {data.unread > 0 ? `${data.unread} unread notification${data.unread === 1 ? "" : "s"}` : "You're all caught up."}
            </p>
            {data.unread > 0 && (
              <Button size="sm" variant="outline" onClick={() => markAll({})}>
                <CheckCheck className="mr-1.5 size-3.5" /> Mark all read
              </Button>
            )}
          </div>

          {data.notifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <BellOff className="size-8 text-leaf/50" />
                <p className="font-medium">No notifications yet</p>
                <p className="text-sm text-muted-foreground">Activity across the network will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {data.notifications.map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                return (
                  <button
                    key={n._id}
                    onClick={() => {
                      if (!n.read) markRead({ id: n._id }).catch(() => {});
                      if (n.link?.startsWith("/")) navigate(n.link);
                    }}
                    className={cn(
                      "card-hover flex w-full items-start gap-3.5 rounded-xl border bg-card p-4 text-left",
                      !n.read && "border-leaf/50 bg-leaf/5",
                    )}
                  >
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", !n.read ? "bg-forest text-lime" : "bg-secondary text-leaf")}>
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{n.title}</span>
                        {!n.read && <span className="size-2 shrink-0 rounded-full bg-coral" aria-label="Unread" />}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span>
                      <span className="mt-1 block text-[11px] text-muted-foreground/70">{fmtDateTime(n.createdAt)}</span>
                    </span>
                    {n.link?.startsWith("/") && <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
