import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import logo from "@/assets/logo.svg";
import {
  Store,
  HeartHandshake,
  ArrowRight,
  ArrowLeft,
  Loader2,
  KeyRound,
  Sprout,
  MailCheck,
  ShieldCheck,
  FileUp,
  BadgeCheck,
  Clock,
  FileCheck2,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { FssaiStatusPill } from "@/components/shared";

type Mode = "signIn" | "register" | "forgot";

const DEMO_PASSWORD = "freshlink123";

const DEMO_ACCOUNTS = [
  { role: "Supplier", org: "Grand Palace Hotel", email: "hotel@freshlink.app" },
  { role: "Supplier", org: "GreenLeaf Supermarket", email: "supplier@freshlink.app" },
  { role: "Recipient", org: "Community Kitchen", email: "recipient@freshlink.app" },
  { role: "Recipient", org: "Helping Hands NGO", email: "ngo@freshlink.app" },
  { role: "Admin", org: "Platform Administration", email: "admin@freshlink.app" },
];

/** Organization type options per role (drives FSSAI-applicability messaging). */
const SUPPLIER_TYPES = [
  "Supermarket",
  "Hotel",
  "Restaurant",
  "Bakery",
  "Food Distributor",
  "Food Business",
  "Catering Business",
  "Farm/Food Supplier",
];
const RECIPIENT_TYPES = [
  "NGO / Community Food Organization",
  "Community Kitchen",
  "Juice Shop",
  "Food Processor",
  "Restaurant",
  "Charity / Shelter",
  "Other Community Organization",
];
/** Recipient types conducting applicable food-business activities → FSSAI shown prominently. */
const FSSAI_APPLICABLE_RECIPIENTS = [
  "NGO / Community Food Organization",
  "Community Kitchen",
  "Juice Shop",
  "Food Processor",
  "Restaurant",
];

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/dashboard") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) return returnTo;
  return fallback;
}

/** Client-side FSSAI validation — mirrors the server rules exactly. */
function validateFssaiClient(raw: string): { ok: true; type: "LICENSE" | "REGISTRATION" } | { ok: false; error: string | null } {
  const v = raw.replace(/[\s-]/g, "");
  if (!v) return { ok: false, error: null };
  if (!/^\d+$/.test(v) || v.length !== 14) return { ok: false, error: "Enter a valid 14-digit FSSAI License / Registration Number." };
  if (v[0] === "1") return { ok: true, type: "LICENSE" };
  if (v[0] === "2") return { ok: true, type: "REGISTRATION" };
  return { ok: false, error: "Enter a valid 14-digit FSSAI License / Registration Number." };
}

function AuthInner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { signIn } = useAuthActions();
  const registerProfile = useMutation(api.accounts.registerProfile);

  const redirect = resolveRedirectAfterAuth(searchParams.get("returnTo"), "/dashboard");
  const initialMode = (searchParams.get("mode") as Mode) || "signIn";
  const [mode, setMode] = useState<Mode>(initialMode === "register" ? "register" : initialMode === "forgot" ? "forgot" : "signIn");
  const [role, setRole] = useState<"supplier" | "recipient">(
    searchParams.get("role") === "recipient" ? "recipient" : "supplier",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FSSAI registration state
  const [fssaiNumber, setFssaiNumber] = useState("");
  const [fssaiCert, setFssaiCert] = useState<{ url: string; name: string } | null>(null);
  const [certUploading, setCertUploading] = useState(false);
  const [orgCategory, setOrgCategory] = useState<string>("");

  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate(redirect);
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const typeOptions = role === "supplier" ? SUPPLIER_TYPES : RECIPIENT_TYPES;
  const fssaiCheck = validateFssaiClient(fssaiNumber);
  // FSSAI section is always shown for suppliers (required); for recipients it is
  // shown prominently for food-handling org types, and available to others too.
  const fssaiApplicable =
    role === "supplier" || FSSAI_APPLICABLE_RECIPIENTS.includes(orgCategory) || orgCategory === "";

  /** The auth token needs a beat to attach to the Convex client; retry until it lands. */
  const ensureProfile = async (args: {
    name: string;
    organizationName: string;
    role: "supplier" | "recipient";
    phone: string;
    location: string;
    category?: string;
    storageCapability?: boolean;
    coldChainCapability?: boolean;
    fssaiNumber?: string;
    fssaiCertificateUrl?: string;
    fssaiCertificateName?: string;
  }) => {
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        await registerProfile(args);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 350));
      }
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await signIn("password", {
        flow: "signIn",
        email: String(fd.get("email")),
        password: String(fd.get("password")),
      });
      await ensureProfile({ name: "", organizationName: "", role: "recipient", phone: "", location: "" });
      navigate(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message.replace("Invalid credentials", "Incorrect email or password") : "Sign in failed. Please try again.");
      setIsLoading(false);
    }
  };

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

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const orgName = String(fd.get("orgName") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");
    const phone = String(fd.get("phone") || "").trim();
    const location = String(fd.get("location") || "").trim();
    const storage = fd.get("storage") === "on";
    const cold = fd.get("cold") === "on";

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setIsLoading(false);
      return;
    }

    // FSSAI validation: required for suppliers, validated whenever entered
    if (role === "supplier" && !fssaiNumber.trim()) {
      setError("FSSAI License / Registration Number is required for suppliers.");
      setIsLoading(false);
      return;
    }
    if (fssaiNumber.trim()) {
      const v = validateFssaiClient(fssaiNumber);
      if (!v.ok && v.error) {
        setError(v.error);
        setIsLoading(false);
        return;
      }
    }

    try {
      await signIn("password", { flow: "signUp", email, password });
      await ensureProfile({
        name: name || email.split("@")[0],
        organizationName: orgName || `${name || email.split("@")[0]}'s organization`,
        role,
        phone,
        location,
        category: orgCategory || undefined,
        storageCapability: storage,
        coldChainCapability: cold,
        fssaiNumber: fssaiNumber.trim() || undefined,
        fssaiCertificateUrl: fssaiCert?.url,
        fssaiCertificateName: fssaiCert?.name,
      });
      toast.success("Welcome to FreshLink AI", {
        description: fssaiNumber.trim()
          ? "Your organization is ready. FSSAI verification is pending admin review."
          : "Your organization is ready.",
      });
      navigate(redirect);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed.";
      setError(
        msg.includes("already exists") && msg.includes("FSSAI")
          ? "An organization with this FSSAI License / Registration Number already exists. Please verify the information or contact support."
          : msg.includes("already exists")
            ? "An account with this email already exists. Try signing in."
            : msg,
      );
      setIsLoading(false);
    }
  };

  const handleDemo = async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("password", { flow: "signIn", email, password: DEMO_PASSWORD });
      await ensureProfile({ name: "", organizationName: "", role: "recipient", phone: "", location: "" });
      navigate(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo sign-in failed.");
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      {/* Left brand panel */}
      <div className="topo-texture relative hidden flex-col justify-between bg-forest-deep p-10 text-white lg:flex">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <Sprout className="size-5 text-lime" />
          </span>
          <span>
            <span className="block font-display text-lg font-semibold leading-tight">FreshLink AI</span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.24em] text-white/50">Surplus Redistribution</span>
          </span>
        </Link>
        <div>
          <h2 className="font-display text-4xl font-semibold leading-tight">
            Turn surplus<br />into <span className="text-lime">impact</span>.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
            Join a network where surplus food finds the organizations that can use it — matched by quantity,
            time, distance and capability.
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon: Store, text: "Suppliers list surplus with real photos" },
              { icon: HeartHandshake, text: "Recipients apply for what they can use" },
              { icon: ArrowRight, text: "AI proposes the split — you approve it" },
              { icon: ShieldCheck, text: "FSSAI compliance reviewed by the FreshLink team" },
            ].map((r) => (
              <p key={r.text} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/10">
                  <r.icon className="size-4 text-lime" />
                </span>
                {r.text}
              </p>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/40">Photos support listings — they never replace food-safety judgement.</p>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center bg-background px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <img src={logo} alt="FreshLink AI" className="size-9 rounded-lg" />
            <span className="font-display text-lg font-semibold">FreshLink AI</span>
          </div>

          {mode === "signIn" && (
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Welcome back</CardTitle>
                <CardDescription>Sign in to your food network.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="you@organization.org" required autoComplete="email" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <button type="button" onClick={() => setMode("forgot")} className="text-xs font-medium text-leaf hover:underline">
                        Forgot password?
                      </button>
                    </div>
                    <Input id="password" name="password" type="password" required autoComplete="current-password" />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full bg-forest hover:bg-forest/90" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <KeyRound className="mr-2 size-4" />}
                    Sign in
                  </Button>
                </form>

                <div className="rounded-lg border bg-secondary/60 p-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Demo accounts · password freshlink123</p>
                  <div className="grid gap-1.5">
                    {DEMO_ACCOUNTS.map((d) => (
                      <button
                        key={d.email}
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleDemo(d.email)}
                        className="flex items-center justify-between rounded-md bg-card px-3 py-2 text-left text-xs hover:border-leaf/40"
                      >
                        <span>
                          <span className="font-semibold">{d.org}</span>
                          <span className="ml-2 rounded-full bg-leaf/10 px-1.5 py-0.5 text-[10px] font-semibold text-leaf">{d.role}</span>
                        </span>
                        <span className="text-muted-foreground">{d.email}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-center text-sm text-muted-foreground">
                  New to FreshLink?{" "}
                  <button onClick={() => setMode("register")} className="font-semibold text-forest hover:underline">
                    Create an organization
                  </button>
                </p>
              </CardContent>
            </Card>
          )}

          {mode === "register" && (
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Register your organization</CardTitle>
                <CardDescription>Choose your role and join the network.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Role">
                  {[
                    { key: "supplier" as const, icon: Store, label: "Supplier", sub: "I have surplus food" },
                    { key: "recipient" as const, icon: HeartHandshake, label: "Recipient", sub: "I need food" },
                  ].map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setRole(r.key)}
                      aria-pressed={role === r.key}
                      className={`rounded-xl border p-3.5 text-left transition-colors ${
                        role === r.key ? "border-forest bg-leaf/10 ring-1 ring-forest/30" : "bg-card hover:border-leaf/40"
                      }`}
                    >
                      <r.icon className={`size-5 ${role === r.key ? "text-forest" : "text-muted-foreground"}`} />
                      <p className="mt-1.5 text-sm font-semibold">{r.label}</p>
                      <p className="text-[11.5px] text-muted-foreground">{r.sub}</p>
                    </button>
                  ))}
                </div>

                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Your name</Label>
                      <Input id="name" name="name" placeholder="Sofia Marchetti" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="orgName">Organization</Label>
                      <Input id="orgName" name="orgName" placeholder="Community Kitchen" required />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Organization type</Label>
                    <Select value={orgCategory} onValueChange={setOrgCategory}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={role === "supplier" ? "Supermarket" : "NGO / Community Food Organization"} />
                      </SelectTrigger>
                      <SelectContent>
                        {typeOptions.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input id="reg-email" name="email" type="email" placeholder="you@organization.org" required autoComplete="email" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" name="phone" type="tel" placeholder="+44 121 555 0000" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="location">Location</Label>
                      <Input id="location" name="location" placeholder="Birmingham, UK" required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input id="reg-password" name="password" type="password" placeholder="At least 8 characters" required minLength={8} autoComplete="new-password" />
                  </div>

                  <div className="space-y-2 rounded-lg border bg-secondary/50 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Capabilities (used by AI matching)</p>
                    <label className="flex items-center justify-between text-sm">
                      Dry / ambient storage
                      <Switch name="storage" defaultChecked />
                    </label>
                    <label className="flex items-center justify-between text-sm">
                      Cold chain (refrigerated transport)
                      <Switch name="cold" />
                    </label>
                  </div>

                  {/* ---- FSSAI compliance section ---- */}
                  {fssaiApplicable && (
                    <div className={`space-y-3 rounded-xl border p-4 ${role === "supplier" ? "border-forest/30 bg-leaf/5" : "border-border bg-secondary/50"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="size-4.5 text-forest" />
                          <p className="text-sm font-bold">FSSAI License / Registration</p>
                        </div>
                        {role === "supplier" ? (
                          <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-bold text-forest">REQUIRED</span>
                        ) : (
                          <span className="rounded-full bg-harvest/15 px-2 py-0.5 text-[10px] font-bold text-[#8a6414]">IF APPLICABLE</span>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {role === "supplier"
                          ? "Your FSSAI License / Registration Number is required to list surplus food. It is reviewed by the FreshLink compliance team before your organization earns a verified badge."
                          : "If your organization handles, prepares, stores or distributes food as an applicable food business, provide your FSSAI License / Registration Number for FreshLink compliance review."}
                      </p>

                      <div className="space-y-1.5">
                        <Label htmlFor="fssai-number">FSSAI License / Registration Number</Label>
                        <Input
                          id="fssai-number"
                          inputMode="numeric"
                          placeholder="14-digit number"
                          maxLength={14}
                          value={fssaiNumber}
                          onChange={(e) => setFssaiNumber(e.target.value.replace(/[^\d]/g, "").slice(0, 14))}
                          className="font-mono tracking-widest"
                          autoComplete="off"
                        />
                        {fssaiNumber.length > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            {fssaiCheck.ok ? (
                              <>
                                <BadgeCheck className="size-3.5 text-forest" />
                                <span className="font-medium text-forest">
                                  Detected type: FSSAI {fssaiCheck.type === "LICENSE" ? "License" : "Registration"}
                                </span>
                              </>
                            ) : fssaiCheck.error ? (
                              <>
                                <Clock className="size-3.5 text-coral" />
                                <span className="text-coral">{fssaiCheck.error}</span>
                              </>
                            ) : null}
                            <span className="ml-auto text-[10.5px] text-muted-foreground">{fssaiNumber.length}/14 digits</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label>FSSAI certificate / document</Label>
                        {fssaiCert ? (
                          <div className="flex items-center gap-2 rounded-lg border bg-card p-2.5 text-sm">
                            <FileCheck2 className="size-4 shrink-0 text-forest" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium">✓ Certificate Uploaded</p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {fssaiCert.name} · uploaded {new Date().toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="text-xs font-semibold text-leaf hover:underline"
                              onClick={() => setFssaiCert(null)}
                            >
                              Replace
                            </button>
                          </div>
                        ) : (
                          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-leaf/40 bg-card px-3 py-3 text-sm font-medium text-leaf transition-colors hover:bg-leaf/5">
                            {certUploading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                            {certUploading ? "Uploading…" : "Upload FSSAI Certificate"}
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
                        <p className="text-[10.5px] text-muted-foreground">PDF or image · max 6 MB · visible only to you and FreshLink administrators.</p>
                      </div>

                      <div className="flex items-center gap-2 rounded-lg bg-background/70 p-2.5">
                        <Clock className="size-4 shrink-0 text-harvest" />
                        <div>
                          <p className="text-xs font-semibold">Status</p>
                          <p className="text-[11px] text-muted-foreground">
                            {fssaiNumber.trim() ? "◷ Verification Pending — reviewed after registration by the FreshLink team" : "Submit your number to start compliance verification"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full bg-forest hover:bg-forest/90" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    {role === "supplier" ? "Create supplier account" : "Create recipient account"}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button onClick={() => setMode("signIn")} className="font-semibold text-forest hover:underline">
                    Sign in
                  </button>
                </p>
              </CardContent>
            </Card>
          )}

          {mode === "forgot" && (
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-2xl">
                  <MailCheck className="size-5 text-leaf" /> Reset your password
                </CardTitle>
                <CardDescription>
                  Enter your email and our support team flow will send reset instructions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input id="forgot-email" type="email" placeholder="you@organization.org" />
                </div>
                <div className="rounded-lg border bg-secondary/60 p-3 text-sm text-muted-foreground">
                  Password reset is handled by your platform administrator in this demo deployment. Try a demo
                  account below to explore the full product.
                </div>
                <Button
                  type="button"
                  className="w-full bg-forest hover:bg-forest/90"
                  onClick={() => handleDemo("recipient@freshlink.app")}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Continue with demo account
                </Button>
                <button onClick={() => setMode("signIn")} className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-forest hover:underline">
                  <ArrowLeft className="size-3.5" /> Back to sign in
                </button>
              </CardContent>
            </Card>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-forest hover:underline">← Back to FreshLink AI home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthInner />
    </Suspense>
  );
}
