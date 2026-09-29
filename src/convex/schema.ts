import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  SUPPLIER: "supplier",
  RECIPIENT: "recipient",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.SUPPLIER),
  v.literal(ROLES.RECIPIENT),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

export const orgTypeValidator = v.union(
  v.literal("supplier"),
  v.literal("recipient"),
);

// FSSAI (Food Safety and Standards) license / registration types.
export const fssaiTypeValidator = v.union(
  v.literal("LICENSE"),
  v.literal("REGISTRATION"),
);

// FSSAI verification lifecycle (FreshLink compliance review, not government verification).
export const fssaiStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("VERIFIED"),
  v.literal("REQUIRES_REVIEW"),
  v.literal("REJECTED"),
);

export const listingCategoryValidator = v.union(
  v.literal("fruits"),
  v.literal("vegetables"),
  v.literal("dairy"),
  v.literal("bakery"),
  v.literal("prepared"),
  v.literal("packaged"),
  v.literal("fresh"),
  v.literal("other"),
);

export const foodTypeValidator = v.union(
  v.literal("raw"),
  v.literal("prepared"),
  v.literal("packaged"),
);

export const storageConditionValidator = v.union(
  v.literal("ambient"),
  v.literal("refrigerated"),
  v.literal("frozen"),
  v.literal("hot"),
);

export const listingStatusValidator = v.union(
  v.literal("available"),
  v.literal("partially_allocated"),
  v.literal("fully_allocated"),
  v.literal("completed"),
  v.literal("expired"),
  v.literal("cancelled"),
  v.literal("flagged"),
);

export const applicationStatusValidator = v.union(
  v.literal("submitted"),
  v.literal("under_review"),
  v.literal("ai_evaluated"),
  v.literal("approved"),
  v.literal("partially_approved"),
  v.literal("rejected"),
  v.literal("pickup_scheduled"),
  v.literal("picked_up"),
  v.literal("completed"),
  v.literal("cancelled"),
);

export const allocationStatusValidator = v.union(
  v.literal("proposed"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("completed"),
  v.literal("cancelled"),
);

export const pickupStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("ready"),
  v.literal("on_the_way"),
  v.literal("picked_up"),
  v.literal("completed"),
  v.literal("cancelled"),
);

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove

      // FreshLink AI fields
      organizationId: v.optional(v.id("organizations")),
      phone: v.optional(v.string()),
      passwordHash: v.optional(v.string()),
      locationName: v.optional(v.string()),
      lat: v.optional(v.number()),
      lng: v.optional(v.number()),
    }).index("email", ["email"]).index("by_organization", ["organizationId"]), // index for the email. do not remove or modify

    organizations: defineTable({
      name: v.string(),
      type: orgTypeValidator,
      category: v.string(), // Supermarket, Hotel, NGO, Community Kitchen, ...
      description: v.optional(v.string()),
      address: v.string(),
      lat: v.number(),
      lng: v.number(),
      contactName: v.optional(v.string()),
      contactPhone: v.optional(v.string()),
      // capabilities for AI matching
      storageCapability: v.optional(v.boolean()),
      coldChainCapability: v.optional(v.boolean()),
      pickupCapability: v.optional(v.string()), // e.g. "Own van", "Walk-in pickup"
      // FSSAI License / Registration compliance (Food Safety and Standards)
      fssaiNumber: v.optional(v.string()), // 14 digits
      fssaiType: v.optional(fssaiTypeValidator),
      fssaiCertificateUrl: v.optional(v.string()), // Convex storage URL — unguessable, private
      fssaiCertificateName: v.optional(v.string()),
      fssaiCertificateUploadedAt: v.optional(v.number()),
      fssaiVerificationStatus: v.optional(fssaiStatusValidator),
      fssaiVerifiedAt: v.optional(v.number()),
      fssaiSubmittedAt: v.optional(v.number()),
      fssaiVerificationReason: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_type", ["type"])
      .index("by_name", ["name"])
      .index("by_fssai", ["fssaiNumber"]),

    foodListings: defineTable({
      supplierOrgId: v.id("organizations"),
      supplierUserId: v.id("users"),
      title: v.string(),
      description: v.optional(v.string()),
      category: listingCategoryValidator,
      foodType: foodTypeValidator,
      quantityAvailable: v.number(),
      quantityOriginal: v.number(),
      unit: v.string(),
      photoUrl: v.optional(v.string()),
      photoIsUpload: v.optional(v.boolean()),
      // Food safety / information
      preparedAt: v.optional(v.number()),
      bestBefore: v.optional(v.number()),
      useBy: v.optional(v.number()),
      storageCondition: storageConditionValidator,
      temperatureNote: v.optional(v.string()),
      coldChainRequired: v.boolean(),
      pickupDeadline: v.number(),
      pickupWindowStart: v.optional(v.number()),
      handlingInstructions: v.optional(v.string()),
      // location (defaults to org location)
      address: v.optional(v.string()),
      lat: v.number(),
      lng: v.number(),
      status: listingStatusValidator,
      safetyStatus: v.optional(v.union(v.literal("complete"), v.literal("incomplete"), v.literal("not_eligible"))),
      safetyNotes: v.optional(v.string()),
      flagged: v.optional(v.boolean()),
      flagReason: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_supplier", ["supplierOrgId"])
      .index("by_status", ["status"])
      .index("by_deadline", ["pickupDeadline"]),

    foodApplications: defineTable({
      listingId: v.id("foodListings"),
      recipientOrgId: v.id("organizations"),
      recipientUserId: v.id("users"),
      requestedQuantity: v.number(),
      unit: v.string(),
      intendedUse: v.string(),
      preferredPickupDate: v.optional(v.string()), // yyyy-mm-dd
      preferredPickupTime: v.optional(v.string()), // HH:mm
      pickupCapability: v.string(),
      storageCapability: v.boolean(),
      coldChainCapability: v.boolean(),
      note: v.optional(v.string()),
      status: applicationStatusValidator,
      // AI analysis results
      aiScore: v.optional(v.number()),
      aiReasons: v.optional(v.array(v.string())),
      aiWarnings: v.optional(v.array(v.string())),
      aiRecommendedQuantity: v.optional(v.number()),
      aiBreakdown: v.optional(v.array(v.object({ label: v.string(), points: v.number(), max: v.number() }))),
      aiEvaluatedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_listing", ["listingId"])
      .index("by_recipient", ["recipientOrgId"])
      .index("by_status", ["status"]),

    allocations: defineTable({
      listingId: v.id("foodListings"),
      applicationId: v.optional(v.id("foodApplications")),
      supplierOrgId: v.id("organizations"),
      recipientOrgId: v.id("organizations"),
      quantity: v.number(),
      unit: v.string(),
      status: allocationStatusValidator,
      pickupDate: v.optional(v.string()),
      pickupTime: v.optional(v.string()),
      reason: v.optional(v.string()),
      proposedBy: v.optional(v.union(v.literal("ai"), v.literal("supplier"))),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_listing", ["listingId"])
      .index("by_application", ["applicationId"])
      .index("by_recipient", ["recipientOrgId"])
      .index("by_supplier", ["supplierOrgId"])
      .index("by_status", ["status"]),

    pickupSchedules: defineTable({
      allocationId: v.id("allocations"),
      listingId: v.id("foodListings"),
      supplierOrgId: v.id("organizations"),
      recipientOrgId: v.id("organizations"),
      scheduledDate: v.string(), // yyyy-mm-dd
      scheduledTime: v.string(), // HH:mm
      pickupLocation: v.string(),
      quantity: v.number(),
      unit: v.string(),
      status: pickupStatusValidator,
      supplierContact: v.optional(v.string()),
      recipientContact: v.optional(v.string()),
      specialInstructions: v.optional(v.string()),
      handedOverAt: v.optional(v.number()),
      confirmedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_allocation", ["allocationId"])
      .index("by_supplier", ["supplierOrgId"])
      .index("by_recipient", ["recipientOrgId"])
      .index("by_status", ["status"]),

    notifications: defineTable({
      userId: v.id("users"),
      title: v.string(),
      body: v.string(),
      type: v.string(), // application | allocation | pickup | system | impact
      link: v.optional(v.string()),
      relatedId: v.optional(v.string()),
      read: v.boolean(),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    transactionHistory: defineTable({
      listingTitle: v.string(),
      category: listingCategoryValidator,
      supplierOrgId: v.id("organizations"),
      recipientOrgId: v.id("organizations"),
      quantity: v.number(),
      unit: v.string(),
      allocationId: v.optional(v.id("allocations")),
      pickupId: v.optional(v.id("pickupSchedules")),
      completedAt: v.number(),
    })
      .index("by_completed", ["completedAt"])
      .index("by_supplier", ["supplierOrgId"])
      .index("by_recipient", ["recipientOrgId"]),

    feedback: defineTable({
      pickupId: v.optional(v.id("pickupSchedules")),
      fromOrgId: v.id("organizations"),
      toOrgId: v.id("organizations"),
      rating: v.number(), // 1-5
      comment: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_to_org", ["toOrgId"]),

    foodSafetyChecks: defineTable({
      listingId: v.id("foodListings"),
      supplierVerified: v.boolean(),
      adminVerified: v.boolean(),
      status: v.union(v.literal("complete"), v.literal("incomplete"), v.literal("not_eligible")),
      notes: v.optional(v.string()),
      updatedAt: v.number(),
    }).index("by_listing", ["listingId"]),

    platformSettings: defineTable({
      key: v.string(),
      value: v.any(),
    }).index("by_key", ["key"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
