import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Sprout, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="topo-texture flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-forest ring-1 ring-forest/20">
        <Sprout className="size-7 text-lime" />
      </span>
      <p className="mt-6 font-display text-6xl font-semibold text-forest">404</p>
      <h1 className="mt-2 font-display text-2xl font-semibold">This route left the network</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="mt-6 flex gap-2.5">
        <Button asChild className="bg-forest hover:bg-forest/90">
          <Link to="/">
            <ArrowLeft className="mr-1.5 size-4" /> Back to FreshLink AI
          </Link>
        </Button>
        <Button asChild variant="outline" className="border-forest/30 text-forest">
          <Link to="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
