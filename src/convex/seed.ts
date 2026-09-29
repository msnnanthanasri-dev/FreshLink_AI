import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Scrypt } from "lucia";
import { analyzeCompatibility, distanceKm } from "./lib/matching";
import { toDateKey } from "./lib/util";
import type { Doc } from "./_generated/dataModel";

const DAY = 24 * 60 * 60 * 1000;

/** Inline SVG data-URI photos for demo listings (stored in food_listings.photo_url). */
function foodPhoto(colorA: string, colorB: string, glyph: string): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='480' viewBox='0 0 640 480'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${colorA}'/><stop offset='1' stop-color='${colorB}'/>` +
    `</linearGradient></defs>` +
    `<rect width='640' height='480' fill='url(#g)'/>` +
    `<g opacity='0.14' stroke='#ffffff' stroke-width='1' fill='none'>` +
    `<path d='M0 80 Q 160 40 320 80 T 640 80'/><path d='M0 160 Q 160 120 320 160 T 640 160'/>` +
    `<path d='M0 240 Q 160 200 320 240 T 640 240'/><path d='M0 320 Q 160 280 320 320 T 640 320'/>` +
    `<path d='M0 400 Q 160 360 320 400 T 640 400'/></g>` +
    `<text x='320' y='270' font-size='170' text-anchor='middle'>${glyph}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

const PASSWORD = "freshlink123";

interface OrgSeed {
  key: string;
  name: string;
  type: "supplier" | "recipient";
  category: string;
  address: string;
  lat: number;
  lng: number;
  description: string;
  storageCapability: boolean;
  coldChainCapability: boolean;
  pickupCapability: string;
  userName: string;
  userEmail: string;
  phone: string;
}

const ORGS: OrgSeed[] = [
  {
    key: "greenleaf",
    name: "GreenLeaf Supermarket",
    type: "supplier",
    category: "Supermarket",
    address: "48 Riverside Market Rd, Harborne, Birmingham B17 9TA",
    lat: 52.4591,
    lng: -1.9616,
    description: "Neighbourhood supermarket redistributing fresh surplus daily.",
    storageCapability: true,
    coldChainCapability: true,
    pickupCapability: "Loading dock at rear, staffed 8am-8pm",
    userName: "Dana Whitfield",
    userEmail: "supplier@freshlink.app",
    phone: "+44 121 555 0101",
  },
  {
    key: "grandpalace",
    name: "Grand Palace Hotel",
    type: "supplier",
    category: "Hotel",
    address: "12 Colmore Row, Birmingham B3 2QD",
    lat: 52.481,
    lng: -1.9012,
    description: "Boutique hotel kitchens with daily prepared-food surplus.",
    storageCapability: true,
    coldChainCapability: true,
    pickupCapability: "Kitchen service entrance, ask for duty chef",
    userName: "Marcus Osei",
    userEmail: "hotel@freshlink.app",
    phone: "+44 121 555 0102",
  },
  {
    key: "harvestbakery",
    name: "Harvest Bakery Co.",
    type: "supplier",
    category: "Bakery",
    address: "7 Moseley Village Sq, Birmingham B13 8JJ",
    lat: 52.4466,
    lng: -1.8895,
    description: "Artisan bakery donating day-end bread and pastry surplus.",
    storageCapability: false,
    coldChainCapability: false,
    pickupCapability: "Shopfront pickup after 6pm",
    userName: "Priya Raman",
    userEmail: "bakery@freshlink.app",
    phone: "+44 121 555 0103",
  },
  {
    key: "helpinghands",
    name: "Helping Hands NGO",
    type: "recipient",
    category: "NGO",
    address: "220 Dudley Rd, Birmingham B18 4HT",
    lat: 52.4765,
    lng: -1.9304,
    description: "Community food distribution NGO serving 400 families weekly.",
    storageCapability: true,
    coldChainCapability: false,
    pickupCapability: "Refrigerated van (morning routes)",
    userName: "Amara Diallo",
    userEmail: "ngo@freshlink.app",
    phone: "+44 121 555 0201",
  },
  {
    key: "juicecorner",
    name: "Fresh Juice Corner",
    type: "recipient",
    category: "Juice Shop",
    address: "31 Bennetts Hill, Birmingham B2 5SN",
    lat: 52.4797,
    lng: -1.8958,
    description: "Cold-pressed juice bar using surplus fruit daily.",
    storageCapability: false,
    coldChainCapability: true,
    pickupCapability: "Walk-in pickup, two staff on bikes",
    userName: "Tom Ince",
    userEmail: "juice@freshlink.app",
    phone: "+44 121 555 0202",
  },
  {
    key: "communitykitchen",
    name: "Community Kitchen",
    type: "recipient",
    category: "Community Kitchen",
    address: "9 St. Pauls Square, Birmingham B3 1QU",
    lat: 52.4839,
    lng: -1.9078,
    description: "Serves 250 hot meals every evening from donated surplus.",
    storageCapability: true,
    coldChainCapability: true,
    pickupCapability: "Own van, evening runs 4pm-9pm",
    userName: "Sofia Marchetti",
    userEmail: "recipient@freshlink.app",
    phone: "+44 121 555 0203",
  },
  {
    key: "foodprocessor",
    name: "Local Food Processor",
    type: "recipient",
    category: "Food Processor",
    address: "Unit 4, Tyseley Industrial Estate, Birmingham B11 2AR",
    lat: 52.4539,
    lng: -1.8523,
    description: "Processes surplus produce into soups, jams and preserves.",
    storageCapability: true,
    coldChainCapability: true,
    pickupCapability: "Pallet truck + van, business hours",
    userName: "Ravi Patel",
    userEmail: "processor@freshlink.app",
    phone: "+44 121 555 0204",
  },
  {
    key: "greenbite",
    name: "GreenBite Restaurant",
    type: "recipient",
    category: "Restaurant",
    address: "15 Kingly Court, London W1B 5PW",
    lat: 52.4124,
    lng: -0.9166,
    description: "Zero-waste restaurant incorporating surplus into daily menus.",
    storageCapability: true,
    coldChainCapability: true,
    pickupCapability: "Chef's own car, afternoons",
    userName: "Elena Novak",
    userEmail: "greenbite@freshlink.app",
    phone: "+44 121 555 0205",
  },
];

const ADMIN = {
  userName: "Asha Verma",
  userEmail: "admin@freshlink.app",
  phone: "+44 121 555 0001",
};

/** Demo listing blueprints. Times are relative to seed run (now). */
interface ListingSeed {
  supplier: string;
  title: string;
  description: string;
  category: "fruits" | "vegetables" | "dairy" | "bakery" | "prepared" | "packaged" | "fresh" | "other";
  foodType: "raw" | "prepared" | "packaged";
  quantity: number;
  unit: string;
  photo: [string, string, string];
  storageCondition: "ambient" | "refrigerated" | "frozen" | "hot";
  temperatureNote?: string;
  coldChainRequired: boolean;
  deadlineHours: number;
  preparedHoursAgo?: number;
  bestBeforeDays?: number;
  handlingInstructions: string;
  seedApplications?: Array<{ recipient: string; quantity: number; use: string; note: string }>;
}

const LISTINGS: ListingSeed[] = [
  {
    supplier: "grandpalace",
    title: "Fresh Biryani",
    description: "Hyderabadi vegetable biryani from tonight's banquet — kept in hotel hot-holding, boxed for handoff.",
    category: "prepared",
    foodType: "prepared",
    quantity: 30,
    unit: "kg",
    photo: ["#f59e0b", "#b45309", "🍛"],
    storageCondition: "hot",
    temperatureNote: "Held above 63°C in hot-holding; reheat to 74°C before serving.",
    coldChainRequired: false,
    deadlineHours: 7,
    preparedHoursAgo: 1.5,
    handlingInstructions: "Collect in insulated containers. Do not reheat more than once. Serve within 4 hours of pickup.",
    seedApplications: [
      {
        recipient: "communitykitchen",
        quantity: 15,
        use: "Serve tonight at our community kitchen for 120 guests",
        note: "I would like 15 kg for our community kitchen. We can collect at 5:30 PM with our van.",
      },
      {
        recipient: "helpinghands",
        quantity: 10,
        use: "Evening meal packs for shelter residents",
        note: "Our refrigerated van finishes its route nearby around 6 PM.",
      },
    ],
  },
  {
    supplier: "greenleaf",
    title: "Fresh Apples",
    description: "Crisp Gala apples — cosmetically imperfect grades, perfect for juicing or direct distribution.",
    category: "fruits",
    foodType: "raw",
    quantity: 200,
    unit: "kg",
    photo: ["#84cc16", "#166534", "🍎"],
    storageCondition: "ambient",
    coldChainRequired: false,
    deadlineHours: 30,
    handlingInstructions: "Crates provided. Keep dry and shaded. Best within 4 days.",
    seedApplications: [
      { recipient: "juicecorner", quantity: 80, use: "Cold-pressed apple juice for weekend service", note: "We run two presses and can collect at 9 AM." },
      { recipient: "foodprocessor", quantity: 100, use: "Apple purée and preserve production batch", note: "We can send our pallet van any morning." },
      { recipient: "communitykitchen", quantity: 70, use: "Fruit for school breakfast club", note: "Happy to take a smaller share if needed." },
    ],
  },
  {
    supplier: "greenleaf",
    title: "Fresh Bread",
    description: "End-of-day artisan loaves, rolls and bloomers from the in-store bakery.",
    category: "bakery",
    foodType: "prepared",
    quantity: 50,
    unit: "kg",
    photo: ["#d6a45c", "#8b5a2b", "🍞"],
    storageCondition: "ambient",
    coldChainRequired: false,
    deadlineHours: 10,
    preparedHoursAgo: 5,
    handlingInstructions: "Paper bags provided. Cool, dry storage. Freeze same day for longer life.",
    seedApplications: [
      { recipient: "helpinghands", quantity: 50, use: "Breakfast distribution for 400 families", note: "Our morning van route covers the supermarket." },
    ],
  },
  {
    supplier: "greenleaf",
    title: "Fresh Milk",
    description: "Surplus whole and semi-skimmed milk, short-dated but properly refrigerated.",
    category: "dairy",
    foodType: "raw",
    quantity: 80,
    unit: "litres",
    photo: ["#e8f4fa", "#93c5fd", "🥛"],
    storageCondition: "refrigerated",
    temperatureNote: "Kept at 3°C. Must stay below 5°C in transit.",
    coldChainRequired: true,
    deadlineHours: 26,
    bestBeforeDays: 1,
    handlingInstructions: "Cold-chain transport required. Return clean crates at next visit.",
    seedApplications: [
      { recipient: "communitykitchen", quantity: 20, use: "Tea, porridge and desserts for evening service", note: "Our van has a refrigerated box." },
    ],
  },
  {
    supplier: "grandpalace",
    title: "Steamed Rice",
    description: "Plain steamed basmati from the banquet kitchen, ideal for immediate service.",
    category: "prepared",
    foodType: "prepared",
    quantity: 20,
    unit: "kg",
    photo: ["#f8fafc", "#cbd5e1", "🍚"],
    storageCondition: "hot",
    temperatureNote: "Hot-held above 63°C since service.",
    coldChainRequired: false,
    deadlineHours: 5,
    preparedHoursAgo: 2,
    handlingInstructions: "Collect hot in insulated boxes. Serve within 2 hours. Do not reheat.",
    seedApplications: [
      { recipient: "helpinghands", quantity: 12, use: "Evening meal packs", note: "Can collect within the hour if needed." },
    ],
  },
  {
    supplier: "grandpalace",
    title: "Chapati & Flatbreads",
    description: "Fresh chapatis and naan from the live cooking counters.",
    category: "prepared",
    foodType: "prepared",
    quantity: 15,
    unit: "kg",
    photo: ["#fde68a", "#d97706", "🫓"],
    storageCondition: "ambient",
    coldChainRequired: false,
    deadlineHours: 8,
    preparedHoursAgo: 2,
    handlingInstructions: "Wrap in cloth to keep soft. Best consumed same day.",
    seedApplications: [],
  },
  {
    supplier: "harvestbakery",
    title: "Surplus Pastries",
    description: "Croissants, danishes and sweet buns from the day's bake.",
    category: "bakery",
    foodType: "prepared",
    quantity: 12,
    unit: "kg",
    photo: ["#fbbf24", "#b45309", "🥐"],
    storageCondition: "ambient",
    coldChainRequired: false,
    deadlineHours: 9,
    preparedHoursAgo: 6,
    handlingInstructions: "Boxes provided at the shopfront. Best same day.",
    seedApplications: [],
  },
  {
    supplier: "greenleaf",
    title: "Mixed Vegetables",
    description: "Carrots, onions, peppers and greens — odd shapes and surplus stock, great for cooking.",
    category: "vegetables",
    foodType: "raw",
    quantity: 120,
    unit: "kg",
    photo: ["#22c55e", "#14532d", "🥕"],
    storageCondition: "ambient",
    coldChainRequired: false,
    deadlineHours: 44,
    handlingInstructions: "Crates provided. Store cool and dark. Check per-crate condition on collection.",
    seedApplications: [],
  },
  {
    supplier: "greenleaf",
    title: "Packaged Pasta & Rice",
    description: "Short-dated sealed pantry packs — ambient, unopened, labels intact.",
    category: "packaged",
    foodType: "packaged",
    quantity: 60,
    unit: "kg",
    photo: ["#a3e635", "#3f6212", "📦"],
    storageCondition: "ambient",
    coldChainRequired: false,
    deadlineHours: 60,
    bestBeforeDays: 20,
    handlingInstructions: "Ambient storage. Check seals on handoff.",
    seedApplications: [],
  },
  {
    supplier: "harvestbakery",
    title: "Sourdough Starter Bakes",
    description: "Twenty-four-hour sourdough loaves from yesterday's batch.",
    category: "bakery",
    foodType: "prepared",
    quantity: 18,
    unit: "kg",
    photo: ["#e7d3b1", "#7c4a1e", "🥖"],
    storageCondition: "ambient",
    coldChainRequired: false,
    deadlineHours: 12,
    preparedHoursAgo: 4,
    handlingInstructions: "Bakery boxes provided. Slice on receipt if freezing.",
    seedApplications: [],
  },
];

/** Public wrapper so the app can trigger idempotent seeding after load. */
export const run = mutation({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.seed.seedInternal);
    return { ok: true };
  },
});

export const seedInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Idempotency: don't seed twice.
    const existing = await ctx.db.query("organizations").first();
    if (existing) return;

    const now = Date.now();
    const scrypt = new Scrypt();
    const preparedAt = undefined as number | undefined;
    const bestBefore = undefined as number | undefined;

    // ---- organizations & users ----
    const orgIds: Record<string, any> = {};
    const userIds: Record<string, any> = {};
    for (const o of ORGS) {
      const orgId = await ctx.db.insert("organizations", {
        name: o.name,
        type: o.type,
        category: o.category,
        description: o.description,
        address: o.address,
        lat: o.lat,
        lng: o.lng,
        contactName: o.userName,
        contactPhone: o.phone,
        storageCapability: o.storageCapability,
        coldChainCapability: o.coldChainCapability,
        pickupCapability: o.pickupCapability,
        createdAt: now,
      });
      orgIds[o.key] = orgId;
    }
    const adminOrgId = await ctx.db.insert("organizations", {
      name: "FreshLink Administration",
      type: "supplier",
      category: "Platform Admin",
      description: "Platform administration.",
      address: "1 Foundry St, Birmingham B3 1QT",
      lat: 52.4862,
      lng: -1.8904,
      contactName: ADMIN.userName,
      contactPhone: ADMIN.phone,
      storageCapability: false,
      coldChainCapability: false,
      pickupCapability: "N/A",
      createdAt: now,
    });
    orgIds["admin"] = adminOrgId;

    const passwordHash = await scrypt.hash(PASSWORD);
    for (const o of ORGS) {
      const userId = await ctx.db.insert("users", {
        name: o.userName,
        email: o.userEmail,
        emailVerificationTime: now,
        role: o.type,
        organizationId: orgIds[o.key],
        phone: o.phone,
        passwordHash,
        locationName: o.address,
        lat: o.lat,
        lng: o.lng,
      });
      userIds[o.key] = userId;
    }
    userIds["admin"] = await ctx.db.insert("users", {
      name: ADMIN.userName,
      email: ADMIN.userEmail,
      emailVerificationTime: now,
      role: "admin",
      organizationId: adminOrgId,
      phone: ADMIN.phone,
      passwordHash,
      locationName: "Birmingham, UK",
      lat: 52.4862,
      lng: -1.8904,
    });

    // ---- listings ----
    const listingIds: Record<string, any> = {};
    for (const L of LISTINGS) {
      const supplierOrg = ORGS.find((o) => o.key === L.supplier)!;
      const preparedAt = L.preparedHoursAgo !== undefined ? now - L.preparedHoursAgo * 3_600_000 : undefined;
      const bestBefore = L.bestBeforeDays !== undefined ? now + L.bestBeforeDays * DAY : undefined;
      const listingId = await ctx.db.insert("foodListings", {
        supplierOrgId: orgIds[L.supplier],
        supplierUserId: userIds[L.supplier],
        title: L.title,
        description: L.description,
        category: L.category,
        foodType: L.foodType,
        quantityAvailable: L.quantity,
        quantityOriginal: L.quantity,
        unit: L.unit,
        photoUrl: foodPhoto(L.photo[0], L.photo[1], L.photo[2]),
        photoIsUpload: false,
        preparedAt,
        bestBefore,
        useBy: undefined,
        storageCondition: L.storageCondition,
        temperatureNote: L.temperatureNote,
        coldChainRequired: L.coldChainRequired,
        pickupDeadline: now + L.deadlineHours * 3_600_000,
        pickupWindowStart: undefined,
        handlingInstructions: L.handlingInstructions,
        address: supplierOrg.address,
        lat: supplierOrg.lat,
        lng: supplierOrg.lng,
        status: "available",
        safetyStatus: "complete",
        flagged: false,
        createdAt: now,
        updatedAt: now,
      });
      listingIds[L.title] = listingId;
    }

    // ---- demo applications with real AI analysis ----
    type AppSeed = { listingTitle: string; recipient: string; quantity: number; use: string; note: string; status: any; a: any };
    const appSeeds: AppSeed[] = [];
    for (const L of LISTINGS) {
      for (const A of L.seedApplications ?? []) {
        const supplierOrg = ORGS.find((o) => o.key === L.supplier)!;
        const recipientOrg = ORGS.find((o) => o.key === A.recipient)!;
        const listingDoc = {
          title: L.title,
          category: L.category,
          foodType: L.foodType,
          quantityAvailable: L.quantity,
          unit: L.unit,
          storageCondition: L.storageCondition,
          coldChainRequired: L.coldChainRequired,
          pickupDeadline: now + L.deadlineHours * 3_600_000,
          preparedAt,
          bestBefore,
          lat: supplierOrg.lat,
          lng: supplierOrg.lng,
        };
        const analysis = analyzeCompatibility(
          listingDoc,
          {
            requestedQuantity: A.quantity,
            unit: L.unit,
            intendedUse: A.use,
            storageCapability: recipientOrg.storageCapability,
            coldChainCapability: recipientOrg.coldChainCapability,
            pickupCapability: recipientOrg.pickupCapability,
          },
          {
            _id: A.recipient,
            name: recipientOrg.name,
            type: "recipient" as const,
            category: recipientOrg.category,
            lat: recipientOrg.lat,
            lng: recipientOrg.lng,
            storageCapability: recipientOrg.storageCapability,
            coldChainCapability: recipientOrg.coldChainCapability,
          },
          now,
        );
        appSeeds.push({
          listingTitle: L.title,
          recipient: A.recipient,
          quantity: A.quantity,
          use: A.use,
          note: A.note,
          status: "ai_evaluated",
          a: analysis,
        });
      }
    }

    const appIds: Record<string, any> = {};
    for (const s of appSeeds) {
      const id = await ctx.db.insert("foodApplications", {
        listingId: listingIds[s.listingTitle],
        recipientOrgId: orgIds[s.recipient],
        recipientUserId: userIds[s.recipient],
        requestedQuantity: s.quantity,
        unit: LISTINGS.find((l) => l.title === s.listingTitle)!.unit,
        intendedUse: s.use,
        preferredPickupDate: toDateKey(now + DAY),
        preferredPickupTime: "17:30",
        pickupCapability: ORGS.find((o) => o.key === s.recipient)!.pickupCapability,
        storageCapability: ORGS.find((o) => o.key === s.recipient)!.storageCapability,
        coldChainCapability: ORGS.find((o) => o.key === s.recipient)!.coldChainCapability,
        note: s.note,
        status: s.status,
        aiScore: s.a.score,
        aiReasons: s.a.reasons,
        aiWarnings: s.a.warnings,
        aiRecommendedQuantity: s.a.recommendedQuantity,
        aiBreakdown: s.a.breakdown,
        aiEvaluatedAt: now,
        createdAt: now - 2 * 3_600_000,
        updatedAt: now - 2 * 3_600_000,
      });
      appIds[`${s.listingTitle}:${s.recipient}`] = id;
    }

    // ---- historical impact data: 8 weeks of completed transactions ----
    const histPatterns: Array<{ supplier: string; recipient: string; title: string; category: any; qty: number; unit: string }> = [
      { supplier: "greenleaf", recipient: "helpinghands", title: "Fresh Apples", category: "fruits", qty: 65, unit: "kg" },
      { supplier: "greenleaf", recipient: "communitykitchen", title: "Fresh Bread", category: "bakery", qty: 38, unit: "kg" },
      { supplier: "grandpalace", recipient: "communitykitchen", title: "Steamed Rice", category: "prepared", qty: 14, unit: "kg" },
      { supplier: "greenleaf", recipient: "juicecorner", title: "Fresh Apples", category: "fruits", qty: 40, unit: "kg" },
      { supplier: "harvestbakery", recipient: "helpinghands", title: "Surplus Pastries", category: "bakery", qty: 11, unit: "kg" },
      { supplier: "greenleaf", recipient: "foodprocessor", title: "Mixed Vegetables", category: "vegetables", qty: 55, unit: "kg" },
      { supplier: "grandpalace", recipient: "helpinghands", title: "Chapati & Flatbreads", category: "prepared", qty: 9, unit: "kg" },
      { supplier: "greenleaf", recipient: "communitykitchen", title: "Fresh Milk", category: "dairy", qty: 18, unit: "litres" },
      { supplier: "harvestbakery", recipient: "greenbite", title: "Sourdough Starter Bakes", category: "bakery", qty: 7, unit: "kg" },
      { supplier: "greenleaf", recipient: "foodprocessor", title: "Packaged Pasta & Rice", category: "packaged", qty: 30, unit: "kg" },
      { supplier: "grandpalace", recipient: "communitykitchen", title: "Fresh Biryani", category: "prepared", qty: 12, unit: "kg" },
      { supplier: "greenleaf", recipient: "helpinghands", title: "Mixed Vegetables", category: "vegetables", qty: 48, unit: "kg" },
    ];

    let histIdx = 0;
    for (let week = 7; week >= 0; week--) {
      // 1-3 transactions per week
      const perWeek = 1 + ((week * 7 + 3) % 3);
      for (let i = 0; i < perWeek; i++) {
        const p = histPatterns[histIdx % histPatterns.length];
        histIdx++;
        const completedAt = now - week * 7 * DAY - i * 2 * DAY - 3_600_000 * ((histIdx * 5) % 8);
        await ctx.db.insert("transactionHistory", {
          listingTitle: p.title,
          category: p.category,
          supplierOrgId: orgIds[p.supplier],
          recipientOrgId: orgIds[p.recipient],
          quantity: p.qty,
          unit: p.unit,
          completedAt,
        });
        // occasional feedback
        if (histIdx % 3 === 0) {
          await ctx.db.insert("feedback", {
            fromOrgId: orgIds[p.recipient],
            toOrgId: orgIds[p.supplier],
            rating: 4 + (histIdx % 2),
            comment: "Smooth handoff, food well packed and on time.",
            createdAt: completedAt + 3_600_000,
          });
        }
      }
    }

    // ---- THE LIVE DEMO TRANSACTION: Fresh Biryani 15 kg → Community Kitchen ----
    // Application approved → allocation approved → pickup scheduled today 17:30
    const biryaniAppId = appIds["Fresh Biryani:communitykitchen"];
    await ctx.db.patch(biryaniAppId, {
      status: "pickup_scheduled",
      updatedAt: now,
    });

    const biryaniAllocId = await ctx.db.insert("allocations", {
      listingId: listingIds["Fresh Biryani"],
      applicationId: biryaniAppId,
      supplierOrgId: orgIds["grandpalace"],
      recipientOrgId: orgIds["communitykitchen"],
      quantity: 15,
      unit: "kg",
      status: "approved",
      pickupDate: toDateKey(now),
      pickupTime: "17:30",
      reason:
        "Strong compatibility: the requested quantity fits the available surplus, the pickup window is feasible, and the recipient has the required storage capability.",
      proposedBy: "ai",
      createdAt: now - 1.5 * 3_600_000,
      updatedAt: now - 1 * 3_600_000,
    });

    // Reduce biryani availability (15 of 30 kg allocated)
    await ctx.db.patch(listingIds["Fresh Biryani"], {
      quantityAvailable: 15,
      status: "partially_allocated",
      updatedAt: now,
    });

    const biryaniPickupId = await ctx.db.insert("pickupSchedules", {
      allocationId: biryaniAllocId,
      listingId: listingIds["Fresh Biryani"],
      supplierOrgId: orgIds["grandpalace"],
      recipientOrgId: orgIds["communitykitchen"],
      scheduledDate: toDateKey(now),
      scheduledTime: "17:30",
      pickupLocation: "Grand Palace Hotel — Kitchen service entrance, 12 Colmore Row, Birmingham B3 2QD",
      quantity: 15,
      unit: "kg",
      status: "scheduled",
      supplierContact: "+44 121 555 0102",
      recipientContact: "+44 121 555 0203",
      specialInstructions: "Ask for the duty chef at the service entrance. Insulated containers required.",
      createdAt: now - 1 * 3_600_000,
      updatedAt: now - 1 * 3_600_000,
    });

    // Second scheduled pickup: bread → Helping Hands NGO tomorrow morning
    const breadApp = appIds["Fresh Bread:helpinghands"];
    await ctx.db.patch(breadApp, { status: "pickup_scheduled", updatedAt: now });
    const breadAllocId = await ctx.db.insert("allocations", {
      listingId: listingIds["Fresh Bread"],
      applicationId: breadApp,
      supplierOrgId: orgIds["greenleaf"],
      recipientOrgId: orgIds["helpinghands"],
      quantity: 50,
      unit: "kg",
      status: "approved",
      pickupDate: toDateKey(now + DAY),
      pickupTime: "08:30",
      reason:
        "Quantity matches the NGO's breakfast distribution capacity and their morning van route passes the supermarket.",
      proposedBy: "ai",
      createdAt: now - 3 * 3_600_000,
      updatedAt: now - 2 * 3_600_000,
    });
    await ctx.db.patch(listingIds["Fresh Bread"], {
      quantityAvailable: 0,
      status: "fully_allocated",
      updatedAt: now,
    });
    await ctx.db.insert("pickupSchedules", {
      allocationId: breadAllocId,
      listingId: listingIds["Fresh Bread"],
      supplierOrgId: orgIds["greenleaf"],
      recipientOrgId: orgIds["helpinghands"],
      scheduledDate: toDateKey(now + DAY),
      scheduledTime: "08:30",
      pickupLocation: "GreenLeaf Supermarket — rear loading dock, 48 Riverside Market Rd, Harborne, Birmingham B17 9TA",
      quantity: 50,
      unit: "kg",
      status: "scheduled",
      supplierContact: "+44 121 555 0101",
      recipientContact: "+44 121 555 0201",
      specialInstructions: "Ask for Dana at the customer service desk before loading.",
      createdAt: now - 2 * 3_600_000,
      updatedAt: now - 2 * 3_600_000,
    });

    // Pending allocations (proposed by AI, awaiting supplier approval) for other applications
    const proposals: Array<{ key: string; qty: number; reason: string }> = [
      {
        key: "Fresh Apples:juicecorner",
        qty: 80,
        reason: "Requested quantity fits the surplus; juice bar regularly presses Gala grades.",
      },
      {
        key: "Fresh Apples:foodprocessor",
        qty: 70,
        reason: "Processor can absorb a large share; remaining surplus after Juice Corner fits their capacity.",
      },
      {
        key: "Fresh Milk:communitykitchen",
        qty: 20,
        reason: "Recipient confirmed refrigerated van capability for the cold-chain run.",
      },
    ];
    for (const p of proposals) {
      const appId = appIds[p.key];
      if (!appId) continue;
      const appDoc = (await ctx.db.get(appId)) as Doc<"foodApplications"> | null;
      if (!appDoc) continue;
      const listingDoc = (await ctx.db.get(appDoc.listingId)) as Doc<"foodListings"> | null;
      if (!listingDoc) continue;
      await ctx.db.insert("allocations", {
        listingId: appDoc.listingId,
        applicationId: appId,
        supplierOrgId: listingDoc.supplierOrgId,
        recipientOrgId: appDoc.recipientOrgId,
        quantity: p.qty,
        unit: appDoc.unit,
        status: "proposed",
        pickupDate: toDateKey(now + DAY),
        pickupTime: "10:00",
        reason: p.reason,
        proposedBy: "ai",
        createdAt: now - 1 * 3_600_000,
        updatedAt: now - 1 * 3_600_000,
      });
    }

    // ---- notifications for demo users ----
    const notif = (
      userId: any,
      title: string,
      body: string,
      type: string,
      link: string,
    ) =>
      ctx.db.insert("notifications", {
        userId,
        title,
        body,
        type,
        link,
        read: false,
        createdAt: now - Math.floor(Math.random() * 3_600_000 * 5),
      });

    await notif(
      userIds["communitykitchen"],
      "Application approved",
      "Your application for 15 kg Fresh Biryani has been approved by Grand Palace Hotel.",
      "allocation",
      "/pickups",
    );
    await notif(
      userIds["communitykitchen"],
      "Pickup scheduled today at 5:30 PM",
      "Pickup of 15 kg Fresh Biryani from Grand Palace Hotel. Ask for the duty chef at the service entrance.",
      "pickup",
      "/pickups",
    );
    await notif(
      userIds["grandpalace"],
      "Pickup scheduled today at 5:30 PM",
      "Community Kitchen will collect 15 kg Fresh Biryani at 5:30 PM today.",
      "pickup",
      "/pickups",
    );
    await notif(
      userIds["greenleaf"],
      "New application received",
      "Fresh Juice Corner applied for 80 kg of your Fresh Apples.",
      "application",
      "/applications",
    );
    await notif(
      userIds["greenleaf"],
      "AI allocation proposal ready",
      "Review the proposed allocation for your 200 kg Fresh Apples listing.",
      "allocation",
      "/allocations",
    );
    await notif(
      userIds["grandpalace"],
      "New application received",
      "Helping Hands NGO applied for 10 kg of your Fresh Biryani.",
      "application",
      "/applications",
    );

    return { ok: true, orgs: Object.keys(orgIds).length, listings: Object.keys(listingIds).length };
  },
});
