import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Apple,
  FileText,
  Network,
  Truck,
  MapPin,
  Bell,
  BarChart3,
  ShieldCheck,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  Search,
  Sprout,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { time24to12, dateKeyToLabel } from "@/components/shared";
import type { ReactNode } from "react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/surplus", label: "Surplus Food", icon: Apple },
  { to: "/applications", label: "Applications", icon: FileText },
  { to: "/allocations", label: "Allocations", icon: Network },
  { to: "/pickups", label: "Pickup & Delivery", icon: Truck },
  { to: "/map", label: "GIS Map", icon: MapPin },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/impact", label: "Impact Analytics", icon: BarChart3 },
  { to: "/history", label: "Trust & History", icon: ShieldCheck },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, org, signOut } = { ...useAuth(), org: undefined } as any;
  // useAuth returns user only; fetch org name via profile query instead
  const profile = useQuery(api.users.myProfile);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary/15 ring-1 ring-sidebar-primary/30">
            <Sprout className="size-5 text-sidebar-primary" />
          </span>
          <span>
            <span className="block font-display text-[17px] font-semibold leading-tight text-white">FreshLink AI</span>
            <span className="block text-[9.5px] font-medium uppercase tracking-[0.22em] text-sidebar-foreground/60">
              Surplus Redistribution
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Primary">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "sidebar-link flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium",
                isActive
                  ? "bg-sidebar-accent text-white shadow-[inset_2px_0_0_0_var(--sidebar-primary)]"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-white",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("size-4.5 shrink-0", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60")} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border/60 p-3">
        <SidebarSecondaryLink to="/settings" icon={Settings} label="Settings" onNavigate={onNavigate} />
        <SidebarSecondaryLink to="/help" icon={HelpCircle} label="Help" onNavigate={onNavigate} />
        <button
          onClick={handleSignOut}
          className="sidebar-link flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-white"
        >
          <LogOut className="size-4.5 text-sidebar-foreground/60" />
          Logout
        </button>
      </div>
    </div>
  );
}

function SidebarSecondaryLink({
  to,
  icon: Icon,
  label,
  onNavigate,
}: {
  to: string;
  icon: any;
  label: string;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "sidebar-link flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium",
          isActive ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-white",
        )
      }
    >
      <Icon className="size-4.5 text-sidebar-foreground/60" />
      {label}
    </NavLink>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const results = useQuery(api.insights.search, q.trim().length >= 2 ? { q } : "skip");
  const navigate = useNavigate();

  const hasResults =
    results && (results.food.length > 0 || results.organizations.length > 0 || results.pickups.length > 0);

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search food, organizations…"
        className="pl-9 bg-card"
        aria-label="Global search"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border bg-popover shadow-lg">
          {!hasResults && <p className="px-4 py-3 text-sm text-muted-foreground">No matches for “{q}”.</p>}
          {results && results.food.length > 0 && (
            <div className="p-1.5">
              <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Food</p>
              {results.food.map((f) => (
                <button
                  key={f._id}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-secondary"
                  onMouseDown={() => {
                    navigate(`/surplus/${f._id}`);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <span>
                    <span className="font-medium">{f.title}</span>
                    <span className="text-muted-foreground"> · {f.supplierName}</span>
                  </span>
                  <span className="text-xs text-coral">
                    {f.quantity} {f.unit}{f.pickupToday ? " · today" : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
          {results && results.organizations.length > 0 && (
            <div className="border-t p-1.5">
              <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Organizations</p>
              {results.organizations.map((o) => (
                <div key={o._id} className="flex items-center justify-between rounded-md px-2.5 py-2 text-sm">
                  <span className="font-medium">{o.name}</span>
                  <span className="text-xs text-muted-foreground">{o.category}</span>
                </div>
              ))}
            </div>
          )}
          {results && results.pickups.length > 0 && (
            <div className="border-t p-1.5">
              <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pickups</p>
              {results.pickups.map((p) => (
                <button
                  key={p._id}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-secondary"
                  onMouseDown={() => {
                    navigate(`/pickups/${p._id}`);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <span>
                    {p.supplierName} → {p.recipientName}
                  </span>
                  <span className="text-xs text-muted-foreground">{p.when}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const data = useQuery(api.insights.listNotifications, {});
  const navigate = useNavigate();
  const unread = data?.unread ?? 0;
  return (
    <button
      onClick={() => navigate("/notifications")}
      className="relative flex size-9 items-center justify-center rounded-full border bg-card hover:bg-secondary"
      aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
    >
      <Bell className="size-4.5 text-forest" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex min-w-4.5 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

export function AppLayout({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const { user } = useAuth();
  const profile = useQuery(api.users.myProfile);
  const navigate = useNavigate();
  const role = (profile?.user?.role ?? user?.role ?? "") as string;
  const orgName = profile?.org?.name ?? "";
  const roleLabel = role === "supplier" ? "Supplier" : role === "recipient" ? "Recipient" : "Admin";
  const initial = (user?.name ?? "U").charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarContent />
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 border-b bg-ivory/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 border-0 bg-transparent p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SidebarContent />
              </SheetContent>
            </Sheet>

            <div className="hidden flex-1 justify-center md:flex">
              <GlobalSearch />
            </div>
            <div className="flex-1 md:hidden" />

            <div className="ml-auto flex items-center gap-2.5">
              <Button size="sm" className="hidden bg-forest hover:bg-forest/90 sm:inline-flex" onClick={() => navigate(role === "supplier" ? "/surplus/new" : "/surplus")}>
                <Plus className="size-4" />
                {role === "supplier" ? "List Surplus" : "Find Food"}
              </Button>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 rounded-full border bg-card py-1 pl-1 pr-3 hover:bg-secondary">
                    <span className="flex size-8 items-center justify-center rounded-full bg-forest font-display text-sm font-bold text-primary-foreground">
                      {initial}
                    </span>
                    <span className="hidden text-left sm:block">
                      <span className="block max-w-36 truncate text-[13px] font-semibold leading-tight">{orgName || user?.name}</span>
                      <span className="block text-[10.5px] font-medium uppercase tracking-wider text-leaf">{roleLabel}</span>
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>
                    <p className="text-sm font-semibold">{user?.name}</p>
                    <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="mr-2 size-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/help")}>
                    <HelpCircle className="mr-2 size-4" /> Help
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="px-4 pb-3 md:hidden">
            <GlobalSearch />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

/** Shared page-state blocks. */
export function PageLoading() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="relative overflow-hidden rounded-xl border bg-card p-6">
          <div className="shimmer-line absolute inset-x-0 top-0 h-px" />
          <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export { time24to12, dateKeyToLabel };
