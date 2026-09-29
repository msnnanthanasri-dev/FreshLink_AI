import { useQuery, useMutation } from "convex/react";
import { Link, useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { AppLayout, PageLoading } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Settings as SettingsIcon, Save, HelpCircle, Flag, ShieldCheck, RotateCcw, BadgeCheck, Clock, FileCheck2, FileUp, Eye, AlertTriangle, XCircle, Loader2, Landmark } from "lucide-react";
import { useState } from "react";
import { fmtQty, maskFssai, FssaiStatusPill, FssaiBadge } from "@/components/shared";

/* ---------------- SETTINGS ---------------- */

export function Settings() {
  const profile = useQuery(api.users.myProfile);
  const updateOrg = useMutation(api.accounts.updateMyOrganization);
  const updateFssai = useMutation(api.accounts.updateFssai);
  const [saving, setSaving] = useState(false);
  const [fssaiSaving, setFssaiSaving] = useState(false);
  const [fssaiEdit, setFssaiEdit] = useState(false);
  const [fssaiNumber, setFssaiNumber] = useState("");
  const [fssaiCert, setFssaiCert] = useState<{ url: string; name: string } | null>(null);
  const [certUploading, setCertUploading] = useState(false);

  if (profile === undefined) {
    return (
      <AppLayout title="Settings">
        <PageLoading />
      </AppLayout>
    );
  }

  const org = profile?.org;
  const user = profile?.user;
  const isPlatformAdmin = user?.role === "admin";
  const fssaiStatus = org?.fssaiVerificationStatus;

  const uploadCertificate = async (file: File) => {
    setCertUploading(true);
    try {
      const convexUrl = (import.meta as any).env?.VITE_CONVEX_URL ?? "";
      const site = convexUrl.replace(".cloud", ".site");
      const fd = new FormData();
      fd.append("photo", file);
      fd.append("kind", "certificate");
      const res = await fetch(`${site}/api/upload`, { method: "POST", body: fd, credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Upload failed");
      setFssaiCert({ url: data.url, name: file.name });
      toast.success("Certificate uploaded", { description: file.name });
    } catch (e: any) {
      toast.error(e?.message ?? "Certificate upload failed");
    } finally {
      setCertUploading(false);
    }
  };

  const saveFssai = async () => {
    setFssaiSaving(true);
    try {
      await updateFssai({
        fssaiNumber: fssaiNumber,
        fssaiCertificateUrl: fssaiCert?.url,
        fssaiCertificateName: fssaiCert?.name,
      });
      toast.success("FSSAI details submitted", {
        description: "FreshLink verification is pending — the compliance team will review your information.",
      });
      setFssaiEdit(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save FSSAI details");
    } finally {
      setFssaiSaving(false);
    }
  };

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
          {/* ---- Compliance & Trust ---- */}
          {!isPlatformAdmin && (
            <Card className="border-forest/25">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <ShieldCheck className="size-4.5 text-forest" /> Compliance &amp; Trust
                </CardTitle>
                <CardDescription>
                  FSSAI information is reviewed by the FreshLink compliance team — format check, certificate and admin review.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <FssaiStatusPill status={fssaiStatus} />
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Demo data</span>
                </div>

                {fssaiStatus === "REJECTED" && org?.fssaiVerificationReason && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    <p className="font-semibold text-destructive">Rejection reason</p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">{org.fssaiVerificationReason}</p>
                  </div>
                )}

                <div className="grid gap-2.5 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Number</p>
                    <p className="mt-0.5 font-mono text-[15px] font-semibold tracking-wider">{maskFssai(org?.fssaiNumber)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Type</p>
                    <p className="mt-0.5 font-medium">FSSAI {org?.fssaiType === "REGISTRATION" ? "Registration" : org?.fssaiType === "LICENSE" ? "License" : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Certificate</p>
                    <p className="mt-0.5 flex items-center gap-1.5 font-medium">
                      {org?.fssaiCertificateUrl ? (
                        <>
                          <FileCheck2 className="size-4 text-forest" /> ✓ Uploaded
                        </>
                      ) : (
                        <span className="text-muted-foreground">Not uploaded</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Verified</p>
                    <p className="mt-0.5 font-medium">
                      {org?.fssaiVerifiedAt
                        ? new Date(org.fssaiVerifiedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {org?.fssaiCertificateUrl && (
                    <a href={org.fssaiCertificateUrl} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">
                        <Eye className="mr-1.5 size-3.5" /> View Certificate
                      </Button>
                    </a>
                  )}
                  <Button
                    size="sm"
                    className="bg-forest hover:bg-forest/90"
                    onClick={() => {
                      setFssaiNumber(org?.fssaiNumber ?? "");
                      setFssaiCert(null);
                      setFssaiEdit(true);
                    }}
                  >
                    <ShieldCheck className="mr-1.5 size-3.5" /> Update FSSAI Details
                  </Button>
                </div>
                {fssaiStatus === "VERIFIED" && (
                  <p className="text-[11px] text-muted-foreground">
                    Changing the FSSAI number or certificate resets verification to PENDING for re-review.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

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

      {/* ---- Update FSSAI dialog ---- */}
      <Dialog open={fssaiEdit} onOpenChange={setFssaiEdit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <ShieldCheck className="size-5 text-forest" /> Update FSSAI Details
            </DialogTitle>
            <DialogDescription>
              Changing the number or certificate resets verification to PENDING for FreshLink re-review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="fssai-num">FSSAI License / Registration Number</Label>
              <Input
                id="fssai-num"
                inputMode="numeric"
                maxLength={14}
                placeholder="14-digit number"
                value={fssaiNumber}
                onChange={(e) => setFssaiNumber(e.target.value.replace(/[^\d]/g, "").slice(0, 14))}
                className="font-mono tracking-widest"
              />
              {fssaiNumber.length > 0 && (
                <p className="text-xs">
                  {fssaiNumber.length === 14 && (fssaiNumber[0] === "1" || fssaiNumber[0] === "2") ? (
                    <span className="font-medium text-forest">
                      Detected type: FSSAI {fssaiNumber[0] === "1" ? "License" : "Registration"}
                    </span>
                  ) : (
                    <span className="text-coral">Enter a valid 14-digit FSSAI License / Registration Number.</span>
                  )}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Certificate / document</Label>
              {fssaiCert ? (
                <div className="flex items-center gap-2 rounded-lg border bg-card p-2.5 text-sm">
                  <FileCheck2 className="size-4 text-forest" />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{fssaiCert.name}</span>
                  <button type="button" className="text-xs font-semibold text-leaf hover:underline" onClick={() => setFssaiCert(null)}>
                    Replace
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-leaf/40 bg-card px-3 py-3 text-sm font-medium text-leaf hover:bg-leaf/5">
                  {certUploading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                  {certUploading ? "Uploading…" : org?.fssaiCertificateUrl ? "Replace certificate" : "Upload certificate"}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,image/*"
                    disabled={certUploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadCertificate(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              {org?.fssaiCertificateName && !fssaiCert && (
                <p className="text-[11px] text-muted-foreground">Current: {org.fssaiCertificateName}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setFssaiEdit(false)}>Cancel</Button>
              <Button
                className="bg-forest hover:bg-forest/90"
                disabled={fssaiSaving || fssaiNumber.length !== 14 || !(fssaiNumber[0] === "1" || fssaiNumber[0] === "2")}
                onClick={saveFssai}
              >
                {fssaiSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                Save details
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
  const orgs = useQuery(api.users.listOrganizations, {});
  const verifyFssai = useMutation(api.accounts.verifyFssai);
  const requestReviewFssai = useMutation(api.accounts.requestReviewFssai);
  const rejectFssai = useMutation(api.accounts.rejectFssai);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

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
  const fssaiOrgs = (orgs ?? [])
    .filter((o: any) => o.category !== "Platform Admin" && o.fssaiNumber)
    .sort((a: any, b: any) => {
      const rank: Record<string, number> = { PENDING: 0, REQUIRES_REVIEW: 1, REJECTED: 2, VERIFIED: 3 };
      return (rank[a.fssaiVerificationStatus ?? "PENDING"] ?? 4) - (rank[b.fssaiVerificationStatus ?? "PENDING"] ?? 4);
    });

  const act = async (orgId: any, action: "verify" | "review" | "reject", reason?: string) => {
    setBusy(orgId + action);
    try {
      if (action === "verify") {
        await verifyFssai({ orgId });
        toast.success("FSSAI compliance verified");
      } else if (action === "review") {
        await requestReviewFssai({ orgId });
        toast.success("Review requested", { description: "The organization has been notified." });
      } else if (action === "reject") {
        if (!reason || !reason.trim()) {
          toast.error("A rejection reason is required.");
          setBusy(null);
          return;
        }
        await rejectFssai({ orgId, reason });
        toast.success("FSSAI verification rejected");
      }
      setRejecting(null);
      setRejectReason("");
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppLayout title="Administration" subtitle="Manage listings, food-safety verification and platform moderation.">
      <div className="space-y-6">
        {/* ---- FSSAI Compliance Review ---- */}
        <section>
          <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
            <Landmark className="size-4.5 text-forest" /> FSSAI Compliance Review
          </h2>
          <p className="mb-3 text-[13px] text-muted-foreground">
            Review submitted numbers, type and certificates. Verification reflects a FreshLink compliance review — not a government database check.
          </p>
          {orgs === undefined ? null : fssaiOrgs.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">No FSSAI submissions yet.</CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {fssaiOrgs.map((o: any) => (
                <Card key={o._id}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          {o.name}
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{o.type}</span>
                          <span className="text-[12px] font-medium text-muted-foreground">{o.category}</span>
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                          <span>
                            <span className="text-muted-foreground">Number:</span>{" "}
                            <span className="font-mono font-semibold">{maskFssai(o.fssaiNumber)}</span>
                            <button
                              className="ml-1.5 align-middle text-[11px] font-semibold text-leaf hover:underline"
                              title="Show full number"
                              onClick={() => toast.info(`FSSAI ${o.fssaiType === "REGISTRATION" ? "Registration" : "License"}: ${o.fssaiNumber}`)}
                            >
                              reveal
                            </button>
                          </span>
                          <span>
                            <span className="text-muted-foreground">Type:</span>{" "}
                            <span className="font-medium">FSSAI {o.fssaiType === "REGISTRATION" ? "Registration" : "License"}</span>
                          </span>
                          <span>
                            <span className="text-muted-foreground">Submitted:</span>{" "}
                            <span className="font-medium">
                              {o.fssaiSubmittedAt ? new Date(o.fssaiSubmittedAt).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : "—"}
                            </span>
                          </span>
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Demo data</span>
                        </div>
                        {o.fssaiVerificationStatus === "REJECTED" && o.fssaiVerificationReason && (
                          <p className="mt-1.5 text-xs text-destructive">Reason: {o.fssaiVerificationReason}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <FssaiStatusPill status={o.fssaiVerificationStatus} />
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {o.fssaiCertificateUrl && (
                            <a href={o.fssaiCertificateUrl} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="outline">
                                <Eye className="mr-1 size-3.5" /> Certificate
                              </Button>
                            </a>
                          )}
                          <Button
                            size="sm"
                            className="bg-forest hover:bg-forest/90"
                            disabled={busy === o._id + "verify" || o.fssaiVerificationStatus === "VERIFIED"}
                            onClick={() => act(o._id, "verify")}
                          >
                            <BadgeCheck className="mr-1 size-3.5" /> Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === o._id + "review" || o.fssaiVerificationStatus === "REQUIRES_REVIEW"}
                            onClick={() => act(o._id, "review")}
                          >
                            <AlertTriangle className="mr-1 size-3.5" /> Request Review
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/40 text-destructive hover:bg-destructive/10"
                            disabled={busy === o._id + "reject" || o.fssaiVerificationStatus === "REJECTED"}
                            onClick={() => {
                              setRejecting(rejecting === o._id ? null : o._id);
                              setRejectReason("");
                            }}
                          >
                            <XCircle className="mr-1 size-3.5" /> Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                    {rejecting === o._id && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                        <Input
                          placeholder="Reason for rejection (required)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="min-w-60 flex-1"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={!rejectReason.trim() || busy === o._id + "reject"}
                          onClick={() => act(o._id, "reject", rejectReason)}
                        >
                          Confirm rejection
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRejecting(null)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

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
