import { useQuery, useMutation } from "convex/react";
import { Link, useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { AppLayout, PageLoading } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Settings as SettingsIcon, Save, HelpCircle, Flag, ShieldCheck, RotateCcw } from "lucide-react";
import { useState } from "react";
import { fmtQty } from "@/components/shared";

/* ---------------- SETTINGS ---------------- */

export function Settings() {
  const profile = useQuery(api.users.myProfile);
  const updateOrg = useMutation(api.accounts.updateMyOrganization);
  const [saving, setSaving] = useState(false);

  if (profile === undefined) {
    return (
      <AppLayout title="Settings">
        <PageLoading />
      </AppLayout>
    );
  }

  const org = profile?.org;
  const user = profile?.user;

  return (
    <AppLayout title="Settings" subtitle="Your profile and organization capabilities used by AI matching.">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <SettingsIcon className="size-4.5 text-leaf" /> Organization
            </CardTitle>
            <CardDescription>Visible to other organizations on the network.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="oname">Organization name</Label>
              <Input id="oname" defaultValue={org?.name ?? ""} key={`n-${org?._id}`} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oaddr">Address</Label>
              <Input id="oaddr" defaultValue={org?.address ?? ""} key={`a-${org?._id}`} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ophone">Contact phone</Label>
              <Input id="ophone" defaultValue={org?.contactPhone ?? ""} key={`p-${org?._id}`} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opickup">Pickup capability note</Label>
              <Input id="opickup" defaultValue={org?.pickupCapability ?? ""} key={`pc-${org?._id}`} />
            </div>
            <Button
              className="bg-forest hover:bg-forest/90"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await updateOrg({
                    name: (document.getElementById("oname") as HTMLInputElement).value,
                    address: (document.getElementById("oaddr") as HTMLInputElement).value,
                    contactPhone: (document.getElementById("ophone") as HTMLInputElement).value,
                    pickupCapability: (document.getElementById("opickup") as HTMLInputElement).value,
                  });
                  toast.success("Organization updated");
                } catch (e: any) {
                  toast.error(e?.message ?? "Could not save");
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Save className="mr-2 size-4" /> Save changes
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Capabilities (AI matching inputs)</CardTitle>
              <CardDescription>These directly affect your compatibility scores.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium">
                Dry / ambient storage
                <Switch
                  defaultChecked={org?.storageCapability ?? false}
                  onCheckedChange={async (v) => {
                    await updateOrg({ storageCapability: v });
                    toast.success(v ? "Storage capability confirmed" : "Storage capability removed");
                  }}
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium">
                Cold chain capability
                <Switch
                  defaultChecked={org?.coldChainCapability ?? false}
                  onCheckedChange={async (v) => {
                    await updateOrg({ coldChainCapability: v });
                    toast.success(v ? "Cold-chain capability confirmed" : "Cold-chain capability removed");
                  }}
                />
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p><span className="text-muted-foreground">Name:</span> <span className="font-medium">{user?.name}</span></p>
              <p><span className="text-muted-foreground">Email:</span> <span className="font-medium">{user?.email}</span></p>
              <p>
                <span className="text-muted-foreground">Role:</span>{" "}
                <span className="font-medium capitalize">{user?.role}</span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

/* ---------------- HELP ---------------- */

export function Help() {
  const navigate = useNavigate();
  const role = "member";
  return (
    <AppLayout title="Help" subtitle="How the FreshLink network works, end to end.">
      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            title: "For suppliers",
            steps: [
              "List surplus with a real photo (camera or upload).",
              "Receive applications with AI compatibility analysis.",
              "Generate an AI allocation proposal — split one listing across recipients.",
              "Approve, modify or reject each proposed allocation.",
              "Mark pickups ready and confirm handover.",
            ],
          },
          {
            title: "For recipients",
            steps: [
              "Browse live surplus filtered by category, urgency and distance.",
              "Apply with quantity, intended use and pickup window.",
              "AI evaluates compatibility — you see the score and reasons.",
              "Approved applications automatically become scheduled pickups.",
              "Confirm pickup received to complete the redistribution.",
            ],
          },
          {
            title: "How AI matching works",
            steps: [
              "Rule-based, explainable scoring — no black box.",
              "Factors: food compatibility, quantity fit, pickup window, distance, storage/cold-chain capability, readiness.",
              "Every application gets a score, reasons and warnings.",
              "The AI only proposes — suppliers always make the final decision.",
            ],
          },
          {
            title: "Food safety",
            steps: [
              "Photos are supporting information only — never proof of safety.",
              "Listings carry preparation time, storage, temperature and deadline info.",
              "Incomplete safety info is flagged to recipients.",
              "Verify actual condition on collection.",
            ],
          },
        ].map((s) => (
          <Card key={s.title}>
            <CardHeader>
              <CardTitle className="font-display text-lg">{s.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-1.5 pl-4 text-sm text-charcoal/80">
                {s.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-muted-foreground">Need to start the end-to-end demo?</p>
          <div className="flex gap-2">
            <Button size="sm" className="bg-forest" onClick={() => navigate("/surplus")}>Surplus marketplace</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/pickups")}>Pickup &amp; Delivery</Button>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}

/* ---------------- ADMIN ---------------- */

export function Admin() {
  const listings = useQuery(api.listings.list, {});
  const unflag = useMutation(api.listings.unflag);
  const flag = useMutation(api.listings.flag);
  const profile = useQuery(api.users.myProfile);

  if (profile === undefined || listings === undefined) {
    return (
      <AppLayout title="Administration">
        <PageLoading />
      </AppLayout>
    );
  }
  if (profile?.user?.role !== "admin") {
    return (
      <AppLayout title="Administration">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium">Admin access required</p>
            <p className="mt-1 text-sm text-muted-foreground">This area is restricted to platform administrators.</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const flagged = listings.filter((l) => l.flagged);
  const active = listings.filter((l) => ["available", "partially_allocated"].includes(l.status));

  return (
    <AppLayout title="Administration" subtitle="Manage listings, food-safety verification and platform moderation.">
      <div className="space-y-6">
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <Flag className="size-4.5 text-coral" /> Flagged listings
          </h2>
          {flagged.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">No flagged listings.</CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {flagged.map((l) => (
                <Card key={l._id}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{l.title}</p>
                      <p className="text-xs text-destructive">{l.flagReason}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => unflag({ id: l._id }).then(() => toast.success("Listing restored"))}>
                      <RotateCcw className="mr-1.5 size-3.5" /> Restore
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <ShieldCheck className="size-4.5 text-leaf" /> Active listings
          </h2>
          <div className="space-y-2">
            {active.map((l) => (
              <Card key={l._id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {l.title} · {fmtQty(l.quantityAvailable, l.unit)}
                    </p>
                    <p className="text-xs text-muted-foreground">{l.category} · safety: {l.safetyStatus}</p>
                  </div>
                  <Link to={`/surplus/${l._id}`}>
                    <Button size="sm" variant="outline">View</Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={async () => {
                      const reason = window.prompt("Reason for flagging this listing?");
                      if (reason) {
                        await flag({ id: l._id, reason });
                        toast.success("Listing flagged");
                      }
                    }}
                  >
                    <Flag className="size-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
