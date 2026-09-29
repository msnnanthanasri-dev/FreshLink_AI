import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Camera, Upload, X, Check, ArrowLeft, ArrowRight, Leaf, PackageCheck } from "lucide-react";

const CATEGORIES = [
  { key: "fruits", label: "Fruits" },
  { key: "vegetables", label: "Vegetables" },
  { key: "dairy", label: "Dairy" },
  { key: "bakery", label: "Bakery" },
  { key: "prepared", label: "Prepared meals" },
  { key: "packaged", label: "Packaged" },
  { key: "fresh", label: "Fresh (other)" },
  { key: "other", label: "Other" },
];

const UNITS = ["kg", "litres", "boxes", "packs", "pieces"];

export default function CreateSurplus() {
  const navigate = useNavigate();
  const createListing = useMutation(api.listings.create);

  const [step, setStep] = useState(1);
  const [publishing, setPublishing] = useState(false);

  // Step 1
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("fruits");
  const [description, setDescription] = useState("");

  // Step 2
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");

  // Step 3 — photo (required)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoIsUpload, setPhotoIsUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 4 — food information & safety
  const [foodType, setFoodType] = useState("raw");
  const [storageCondition, setStorageCondition] = useState("ambient");
  const [temperatureNote, setTemperatureNote] = useState("");
  const [coldChain, setColdChain] = useState(false);
  const [preparedAt, setPreparedAt] = useState("");
  const [bestBefore, setBestBefore] = useState("");
  const [deadlineHours, setDeadlineHours] = useState("12");
  const [handling, setHandling] = useState("");

  const uploadPhoto = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const convexUrl = (import.meta.env.VITE_CONVEX_URL as string).replace(".cloud", ".site");
      const res = await fetch(`${convexUrl}/api/upload`, {
        method: "POST",
        body: (() => {
          const fd = new FormData();
          fd.append("photo", file);
          return fd;
        })(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }
      const data = await res.json();
      setPhotoUrl(data.url);
      setPhotoIsUpload(true);
      toast.success("Photo attached");
    } catch (e: any) {
      setUploadError(e?.message ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const preparedTs = preparedAt ? new Date(preparedAt).getTime() : undefined;
      const bestBeforeTs = bestBefore ? new Date(bestBefore).getTime() : undefined;
      const id = await createListing({
        title,
        description: description || undefined,
        category,
        foodType,
        quantity: Number(quantity),
        unit,
        photoUrl: photoUrl ?? undefined,
        photoIsUpload,
        preparedAt: preparedTs,
        bestBefore: bestBeforeTs,
        storageCondition,
        temperatureNote: temperatureNote || undefined,
        coldChainRequired: coldChain,
        pickupDeadline: Date.now() + Number(deadlineHours) * 3_600_000,
        handlingInstructions: handling || undefined,
      });
      toast.success("Surplus published", { description: "Recipient organizations in your network have been notified." });
      navigate(`/surplus/${id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not publish listing");
      setPublishing(false);
    }
  };

  const canNext =
    (step === 1 && title.trim().length >= 2) ||
    (step === 2 && Number(quantity) > 0) ||
    step === 3 ||
    step === 4;

  return (
    <AppLayout title="List Surplus Food" subtitle="Four quick steps — recipients see exactly what you see.">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <div className="mb-1.5 flex justify-between text-xs font-semibold text-muted-foreground">
            <span>Step {step} of 4</span>
            <span>{["What are you offering?", "How much?", "Show us the surplus", "Food information"][step - 1]}</span>
          </div>
          <Progress value={(step / 4) * 100} className="h-1.5" />
        </div>

        <Card>
          <CardContent className="p-6">
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                  <Leaf className="size-5 text-leaf" /> What are you offering?
                </h2>
                <div className="space-y-1.5">
                  <Label htmlFor="title">Food name</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fresh Biryani, Apples, Bread…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setCategory(c.key)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                          category === c.key ? "border-forest bg-forest text-white" : "bg-card hover:border-leaf/50"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="desc">Description (optional)</Label>
                  <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Condition, packaging, anything recipients should know…" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                  <PackageCheck className="size-5 text-leaf" /> How much?
                </h2>
                <div className="grid grid-cols-[1fr_140px] gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="qty">Quantity</Label>
                    <Input id="qty" type="number" min={0.1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Unit</Label>
                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
                  One listing can be allocated to multiple recipients — the AI proposes the split and you approve it.
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-xl font-semibold">📸 Show us the surplus</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    FreshLink AI works with the food that actually exists. Upload a clear photo of the actual food you are offering.
                  </p>
                </div>

                {!photoUrl ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="card-hover flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-leaf/50 bg-leaf/5 p-8 text-center"
                    >
                      <span className="flex size-12 items-center justify-center rounded-full bg-forest text-white">
                        <Camera className="size-6" />
                      </span>
                      <span className="text-sm font-semibold">Take Photo</span>
                      <span className="text-xs text-muted-foreground">Opens your camera where supported</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="card-hover flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-forest/40 bg-secondary/60 p-8 text-center"
                    >
                      <span className="flex size-12 items-center justify-center rounded-full bg-leaf/20 text-forest">
                        <Upload className="size-6" />
                      </span>
                      <span className="text-sm font-semibold">Upload Photo</span>
                      <span className="text-xs text-muted-foreground">JPG, PNG · up to 6 MB</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-xl border">
                      <img src={photoUrl} alt="Preview of the surplus food photo" className="max-h-80 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoUrl(null);
                          setPhotoIsUpload(false);
                        }}
                        className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-destructive px-2.5 py-1 text-xs font-semibold text-white"
                        aria-label="Remove photo"
                      >
                        <X className="size-3.5" /> Remove
                      </button>
                    </div>
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-leaf">
                      <Check className="size-4" /> Photo attached
                    </p>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()} disabled={uploading}>
                        <Camera className="mr-1.5 size-4" /> Replace via camera
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        <Upload className="mr-1.5 size-4" /> Replace via upload
                      </Button>
                    </div>
                  </div>
                )}

                {uploading && <p className="text-sm text-leaf">Uploading photo…</p>}
                {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

                {/* Hidden inputs: capture=environment uses the rear camera on mobile */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadPhoto(f);
                    e.currentTarget.value = "";
                  }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadPhoto(f);
                    e.currentTarget.value = "";
                  }}
                />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h2 className="font-display text-xl font-semibold">Food information &amp; safety</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Food type</Label>
                    <Select value={foodType} onValueChange={setFoodType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="raw">Raw</SelectItem>
                        <SelectItem value="prepared">Prepared</SelectItem>
                        <SelectItem value="packaged">Packaged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Storage condition</Label>
                    <Select value={storageCondition} onValueChange={setStorageCondition}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ambient">Ambient</SelectItem>
                        <SelectItem value="refrigerated">Refrigerated</SelectItem>
                        <SelectItem value="frozen">Frozen</SelectItem>
                        <SelectItem value="hot">Hot-held</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(foodType === "prepared") && (
                    <div className="space-y-1.5">
                      <Label htmlFor="prepared">Prepared at (date &amp; time)</Label>
                      <Input id="prepared" type="datetime-local" value={preparedAt} onChange={(e) => setPreparedAt(e.target.value)} />
                    </div>
                  )}
                  {(foodType === "packaged" || foodType === "raw") && (
                    <div className="space-y-1.5">
                      <Label htmlFor="bb">Best before (optional)</Label>
                      <Input id="bb" type="date" value={bestBefore} onChange={(e) => setBestBefore(e.target.value)} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="deadline">Pickup deadline (hours from now)</Label>
                    <Input id="deadline" type="number" min={1} max={168} value={deadlineHours} onChange={(e) => setDeadlineHours(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="temp">Temperature information (optional)</Label>
                  <Input id="temp" value={temperatureNote} onChange={(e) => setTemperatureNote(e.target.value)} placeholder="Kept at 3°C; must stay below 5°C in transit" />
                </div>
                <label className="flex items-center justify-between rounded-lg border bg-secondary/50 p-3 text-sm font-medium">
                  Cold-chain required for transport
                  <Switch checked={coldChain} onCheckedChange={setColdChain} />
                </label>
                <div className="space-y-1.5">
                  <Label htmlFor="handling">Handling instructions (optional)</Label>
                  <Textarea id="handling" value={handling} onChange={(e) => setHandling(e.target.value)} rows={2} placeholder="Insulated containers required. Serve within 4 hours of pickup." />
                </div>
              </div>
            )}

            {/* Nav buttons */}
            <div className="mt-6 flex items-center justify-between border-t pt-4">
              <Button variant="ghost" onClick={() => (step === 1 ? navigate("/surplus") : setStep(step - 1))}>
                <ArrowLeft className="mr-1.5 size-4" /> {step === 1 ? "Cancel" : "Back"}
              </Button>
              {step < 4 ? (
                <Button className="bg-forest hover:bg-forest/90" disabled={!canNext} onClick={() => setStep(step + 1)}>
                  Continue <ArrowRight className="ml-1.5 size-4" />
                </Button>
              ) : (
                <Button className="bg-forest hover:bg-forest/90" disabled={publishing || !title || !quantity} onClick={handlePublish}>
                  {publishing ? "Publishing…" : "Publish surplus"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
