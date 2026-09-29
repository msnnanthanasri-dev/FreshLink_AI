/**
 * FreshLink AI — AI-Assisted Compatibility Analysis
 *
 * A transparent, deterministic, rule-based scoring engine. It analyzes an
 * application against a food listing and produces an explainable score with
 * reasons and warnings. No machine learning is claimed — this is explainable
 * optimization ("AI-Assisted Compatibility Analysis").
 */

export interface MatchOrg {
  _id: string;
  name: string;
  type: "supplier" | "recipient";
  category: string;
  lat: number;
  lng: number;
  storageCapability: boolean;
  coldChainCapability: boolean;
  pickupCapability?: string;
}

export interface MatchListing {
  title: string;
  category: string;
  foodType: "raw" | "prepared" | "packaged";
  quantityAvailable: number;
  unit: string;
  storageCondition: "ambient" | "refrigerated" | "frozen" | "hot";
  coldChainRequired: boolean;
  pickupDeadline: number;
  preparedAt?: number;
  useBy?: number;
  bestBefore?: number;
  lat: number;
  lng: number;
}

export interface MatchApplication {
  requestedQuantity: number;
  unit: string;
  intendedUse: string;
  storageCapability: boolean;
  coldChainCapability: boolean;
  pickupCapability: string;
  preferredPickupDate?: string;
  preferredPickupTime?: string;
}

export interface ScoreBreakdownLine {
  label: string;
  points: number;
  max: number;
}

export interface MatchResult {
  score: number;
  recommendedQuantity: number;
  breakdown: ScoreBreakdownLine[];
  reasons: string[];
  warnings: string[];
}

/** Haversine distance in km. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const USE_KEYWORDS: Record<string, string[]> = {
  fruits: ["juice", "fruit", "smoothie", "dessert", "salad", "bake", "consume", "serve", "distribut", "meal", "cook"],
  vegetables: ["meal", "cook", "kitchen", "salad", "soup", "distribut", "serve", "consume", "process"],
  dairy: ["breakfast", "milk", "dairy", "serve", "kitchen", "distribut", "consume", "tea", "coffee"],
  bakery: ["bread", "bakery", "serve", "meal", "distribut", "breakfast", "sandwich"],
  prepared: ["meal", "serve", "kitchen", "distribut", "consume", "immediate", "community"],
  packaged: ["distribut", "pantry", "pack", "store", "emergency", "serve", "consume"],
  fresh: ["serve", "meal", "kitchen", "cook", "distribut", "consume"],
  other: ["distribut", "serve", "consume", "meal", "kitchen"],
};

const COMPATIBLE_USE: Record<string, string[]> = {
  juice: ["fruits"],
  "community kitchen": ["prepared", "fresh", "vegetables", "fruits", "dairy", "bakery"],
  kitchen: ["prepared", "fresh", "vegetables", "fruits", "dairy"],
  ngo: ["packaged", "bakery", "fruits", "vegetables", "dairy", "prepared"],
  processor: ["fruits", "vegetables", "packaged", "dairy", "fresh"],
  restaurant: ["prepared", "fresh", "bakery", "fruits", "vegetables"],
};

function norm(s: string): string {
  return s.toLowerCase().trim();
}

/** Approximate unit compatibility (kg vs L treated as roughly interchangeable for bulk food). */
function unitsCompatible(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  const volumeish = ["l", "litre", "litres", "liter", "liters"];
  const massish = ["kg", "kilogram", "kilograms"];
  const countish = ["pieces", "piece", "packs", "pack", "boxes", "box"];
  const isVol = (u: string) => volumeish.includes(u);
  const isMass = (u: string) => massish.includes(u);
  const isCount = (u: string) => countish.some((c) => u.startsWith(c));
  if (isCount(na) && isCount(nb)) return true;
  return !((isVol(na) && isMass(nb)) || (isMass(na) && isVol(nb)));
}

/** Food compatibility score (0-20) based on intended use vs category and org category. */
function foodCompatibility(
  listing: MatchListing,
  app: MatchApplication,
  org: MatchOrg,
): { points: number; max: number; notes: string[] } {
  const max = 20;
  const notes: string[] = [];
  const use = norm(app.intendedUse);
  const keywords = USE_KEYWORDS[listing.category] ?? USE_KEYWORDS.other;
  const kwHit = keywords.some((k) => use.includes(k));

  // Org category compatibility with food category
  const cat = norm(org.category);
  const compatCats = Object.entries(COMPATIBLE_USE).find(([k]) => cat.includes(k))?.[1];
  const catOk = !compatCats || compatCats.includes(listing.category);

  if (kwHit && catOk) {
    notes.push("Intended use and organization type fit this food category");
    return { points: max, max, notes };
  }
  if (kwHit || catOk) {
    notes.push("Intended use is plausible for this food type");
    return { points: 14, max, notes };
  }
  notes.push("Intended use does not clearly fit this food category");
  return { points: 6, max, notes };
}

interface PartialScore {
  points: number;
  max: number;
  recommended?: number;
  notes: string[];
}

/** Quantity fit score (0-20). */
function quantityFit(listing: MatchListing, app: MatchApplication): PartialScore {
  const max = 20;
  const recommended = Math.min(app.requestedQuantity, listing.quantityAvailable);
  if (!unitsCompatible(listing.unit, app.unit)) {
    return {
      points: 10,
      max,
      recommended,
      notes: ["Units differ between listing and application — quantity was capped to available surplus"],
    };
  }
  const ratio = app.requestedQuantity / Math.max(listing.quantityAvailable, 0.0001);
  const notes: string[] = [];
  let points: number;
  if (app.requestedQuantity <= listing.quantityAvailable && ratio >= 0.25) {
    points = max;
    notes.push("Requested quantity fits the available surplus");
  } else if (app.requestedQuantity <= listing.quantityAvailable) {
    points = 16;
    notes.push("Requested quantity is available but small relative to the surplus");
  } else {
    points = 8;
    notes.push("Requested quantity exceeds the remaining surplus — a partial allocation may be recommended");
  }
  return { points, max, recommended, notes };
}

/** Time feasibility score (0-20). */
function timeFeasibility(
  listing: MatchListing,
  app: MatchApplication,
  now: number,
): { points: number; max: number; notes: string[] } {
  const max = 20;
  const hoursLeft = (listing.pickupDeadline - now) / 3_600_000;
  const notes: string[] = [];
  if (hoursLeft <= 0) {
    notes.push("Pickup deadline has passed");
    return { points: 0, max, notes };
  }
  let points = 20;
  if (hoursLeft < 2) {
    points = 8;
    notes.push("Very little usable time remains before the pickup deadline");
  } else if (hoursLeft < 6) {
    points = 15;
    notes.push("Usable time is limited — pickup should be arranged soon");
  }
  // Check preferred slot is before the deadline
  if (app.preferredPickupDate && app.preferredPickupTime) {
    const [y, mo, d] = app.preferredPickupDate.split("-").map(Number);
    const [h, mi] = app.preferredPickupTime.split(":").map(Number);
    if (y && mo && d && !Number.isNaN(h)) {
      const pref = new Date(y, mo - 1, d, h, mi).getTime();
      if (pref > listing.pickupDeadline) {
        points = Math.min(points, 6);
        notes.push("Preferred pickup time is after the listing's pickup deadline");
      }
    }
  }
  if (notes.length === 0) notes.push("Pickup window is feasible within the remaining usable time");
  return { points, max, notes };
}

/** Distance score (0-15). */
function distanceScore(
  listing: MatchListing,
  org: MatchOrg,
): { points: number; max: number; km: number; notes: string[] } {
  const max = 15;
  const km = distanceKm(listing, org);
  const notes: string[] = [];
  let points: number;
  if (km <= 2) {
    points = 15;
    notes.push("Recipient location is very close to the surplus");
  } else if (km <= 5) {
    points = 13;
    notes.push("Recipient location is nearby");
  } else if (km <= 10) {
    points = 10;
    notes.push("Distance is manageable for pickup");
  } else if (km <= 25) {
    points = 6;
    notes.push("Pickup requires a longer trip");
  } else {
    points = 2;
    notes.push("Recipient is far from the surplus location");
  }
  return { points, max, km, notes };
}

/** Storage/cold-chain score (0-15). */
function storageScore(
  listing: MatchListing,
  app: MatchApplication,
): { points: number; max: number; notes: string[] } {
  const max = 15;
  const needsCold =
    listing.coldChainRequired ||
    listing.storageCondition === "refrigerated" ||
    listing.storageCondition === "frozen";
  const notes: string[] = [];
  if (!needsCold) {
    notes.push("Storage requirements are compatible");
    return { points: max, max, notes };
  }
  if (listing.coldChainRequired && !app.coldChainCapability) {
    notes.push("Listing requires cold chain but the applicant did not confirm cold-chain capability");
    return { points: 4, max, notes };
  }
  if (needsCold && !app.storageCapability) {
    notes.push("Listing needs refrigerated storage but the applicant did not confirm storage capability");
    return { points: 6, max, notes };
  }
  notes.push("Applicant confirmed the required storage / cold-chain capability");
  return { points: max, max, notes };
}

/** Demand/pickup readiness score (0-10). */
function readinessScore(app: MatchApplication): { points: number; max: number; notes: string[] } {
  const max = 10;
  let points = 6;
  if (app.pickupCapability && app.pickupCapability.trim().length > 0) points += 2;
  if (app.preferredPickupDate && app.preferredPickupTime) points += 2;
  const notes: string[] = [];
  notes.push("Applicant provided pickup and scheduling details");
  return { points: Math.min(points, max), max, notes };
}

/**
 * Full deterministic compatibility analysis.
 */
export function analyzeCompatibility(
  listing: MatchListing,
  app: MatchApplication,
  org: MatchOrg,
  now = Date.now(),
): MatchResult {
  const food = foodCompatibility(listing, app, org);
  const qty = quantityFit(listing, app);
  const time = timeFeasibility(listing, app, now);
  const dist = distanceScore(listing, org);
  const storage = storageScore(listing, app);
  const readiness = readinessScore(app);

  const breakdown: ScoreBreakdownLine[] = [
    { label: "Food compatibility", points: food.points, max: food.max },
    { label: "Quantity fit", points: qty.points, max: qty.max },
    { label: "Pickup window", points: time.points, max: time.max },
    { label: "Distance efficiency", points: dist.points, max: dist.max },
    { label: "Storage compatibility", points: storage.points, max: storage.max },
    { label: "Demand & readiness", points: readiness.points, max: readiness.max },
  ];

  const total = breakdown.reduce((s, l) => s + l.points, 0);
  const maxTotal = breakdown.reduce((s, l) => s + l.max, 0);
  const score = Math.round((total / maxTotal) * 100);

  const reasons = [
    ...food.notes,
    ...qty.notes,
    ...time.notes,
    ...dist.notes,
    ...storage.notes,
    ...readiness.notes,
  ];
  const warnings: string[] = [];
  if (time.points < 8) warnings.push("Usable time is nearly exhausted — coordinate pickup immediately");
  if (listing.coldChainRequired && !app.coldChainCapability)
    warnings.push("Cold chain is required and not confirmed by the applicant");
  if (app.requestedQuantity > listing.quantityAvailable)
    warnings.push(
      "Only " + listing.quantityAvailable + " " + listing.unit + " remain available",
    );

  return {
    score,
    recommendedQuantity: qty.recommended ?? Math.min(app.requestedQuantity, listing.quantityAvailable),
    breakdown,
    reasons,
    warnings,
  };
}

/** Greedy allocation optimizer across applications for one listing. */
export function proposeAllocation(
  analyzed: Array<{
    applicationId: string;
    recipientName: string;
    requestedQuantity: number;
    score: number;
    recommendedQuantity: number;
  }>,
  availableQuantity: number,
): Array<{ applicationId: string; recipientName: string; quantity: number; shareReason: string }> {
  const ranked = [...analyzed].sort((a, b) => b.score - a.score);
  let remaining = availableQuantity;
  const out: Array<{
    applicationId: string;
    recipientName: string;
    quantity: number;
    shareReason: string;
  }> = [];
  for (const a of ranked) {
    if (remaining <= 0) break;
    let qty = Math.min(a.recommendedQuantity, remaining);
    if (qty <= 0) continue;
    let shareReason: string;
    if (a.score >= 80) {
      shareReason = "Highest compatibility — allocated its requested quantity first";
    } else if (a.score >= 60) {
      shareReason = "Good compatibility — allocated a fitting share";
    } else {
      shareReason = "Allocated from the remaining surplus after higher-ranked applications";
    }
    if (a.requestedQuantity > remaining && remaining > 0) {
      shareReason =
        "Partial allocation — requested " + a.requestedQuantity + " but only " + remaining + " remained";
      qty = remaining;
    }
    out.push({
      applicationId: a.applicationId,
      recipientName: a.recipientName,
      quantity: Math.round(qty * 10) / 10,
      shareReason,
    });
    remaining -= qty;
  }
  return out;
}
