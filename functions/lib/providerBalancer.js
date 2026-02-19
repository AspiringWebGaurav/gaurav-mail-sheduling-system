"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectProvider = selectProvider;
exports.recordProviderFailure = recordProviderFailure;
exports.recordProviderSuccess = recordProviderSuccess;
exports.incrementProviderUsage = incrementProviderUsage;
const admin = __importStar(require("firebase-admin"));
const DEFAULT_DAILY_QUOTA = 200;
const CIRCUIT_BREAKER_THRESHOLD = 5; // Auto-disable after N consecutive failures
function getTodayString() {
    return new Date().toISOString().split("T")[0];
}
// ═══════════════════════════════════════════════════════════════
// SEED DEFAULT PROVIDERS
// On first invocation, seed 2 default providers from env vars
// if no providers exist in Firestore yet.
// ═══════════════════════════════════════════════════════════════
async function ensureDefaultProviders() {
    const db = admin.firestore();
    const snap = await db.collection("emailProviders").limit(1).get();
    if (!snap.empty)
        return; // Already seeded
    const defaults = [
        {
            name: "Primary Provider",
            serviceId: process.env.EMAILJS_PROVIDER_1_SERVICE_ID || "",
            templateId: process.env.EMAILJS_PROVIDER_1_TEMPLATE_ID || "",
            publicKey: process.env.EMAILJS_PROVIDER_1_PUBLIC_KEY || "",
            privateKey: process.env.EMAILJS_PROVIDER_1_PRIVATE_KEY || "",
            priority: 1,
        },
        {
            name: "Secondary Provider",
            serviceId: process.env.EMAILJS_PROVIDER_2_SERVICE_ID || "",
            templateId: process.env.EMAILJS_PROVIDER_2_TEMPLATE_ID || "",
            publicKey: process.env.EMAILJS_PROVIDER_2_PUBLIC_KEY || "",
            privateKey: process.env.EMAILJS_PROVIDER_2_PRIVATE_KEY || "",
            priority: 2,
        },
    ];
    const batch = db.batch();
    for (const p of defaults) {
        // Only seed if credentials exist
        if (!p.serviceId || !p.publicKey)
            continue;
        const ref = db.collection("emailProviders").doc();
        batch.set(ref, {
            ...p,
            status: "active",
            dailyQuota: DEFAULT_DAILY_QUOTA,
            isDefault: true,
            createdBy: "system",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    await batch.commit();
    console.log("Seeded default email providers from env vars");
}
// ═══════════════════════════════════════════════════════════════
// GET PROVIDER USAGE (Atomic with transaction)
// ═══════════════════════════════════════════════════════════════
async function getProviderUsage(providerId) {
    const db = admin.firestore();
    const ref = db.collection("providerUsage").doc(providerId);
    const today = getTodayString();
    return db.runTransaction(async (txn) => {
        const snap = await txn.get(ref);
        if (!snap.exists) {
            txn.set(ref, {
                date: today,
                usedToday: 0,
                lastResetAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return 0;
        }
        const data = snap.data();
        if (data.date !== today) {
            txn.update(ref, {
                date: today,
                usedToday: 0,
                lastResetAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return 0;
        }
        return data.usedToday || 0;
    });
}
// ═══════════════════════════════════════════════════════════════
// SELECT PROVIDER — Dynamic, Randomized, Balanced
//
// 1. Fetch ALL active providers from Firestore
// 2. Get daily usage for each
// 3. Filter out exhausted providers
// 4. Randomized-weighted selection (lower usage = higher chance)
// ═══════════════════════════════════════════════════════════════
async function selectProvider() {
    const db = admin.firestore();
    // Ensure defaults exist on first run
    await ensureDefaultProviders();
    // Fetch all active providers dynamically from Firestore
    const snap = await db
        .collection("emailProviders")
        .where("status", "==", "active")
        .get();
    if (snap.empty) {
        console.error("No active email providers found in Firestore");
        return null;
    }
    const providers = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    }));
    // Get usage for each provider in parallel
    const usagePromises = providers.map(async (p) => {
        try {
            const usedToday = await getProviderUsage(p.id);
            const quota = p.dailyQuota || DEFAULT_DAILY_QUOTA;
            return {
                ...p,
                usedToday,
                remainingQuota: Math.max(0, quota - usedToday),
            };
        }
        catch (err) {
            console.warn(`Usage fetch failed for ${p.name}:`, err);
            return {
                ...p,
                usedToday: 0,
                remainingQuota: p.dailyQuota || DEFAULT_DAILY_QUOTA,
            };
        }
    });
    const providersWithUsage = await Promise.all(usagePromises);
    // Filter: only providers with remaining quota
    const available = providersWithUsage.filter((p) => p.remainingQuota > 0);
    if (available.length === 0) {
        console.warn("All providers exhausted quota for today");
        return null;
    }
    // ═══ RANDOMIZED-WEIGHTED SELECTION ═══
    // Weight = remainingQuota (more remaining = higher selection chance)
    // This ensures balanced distribution + no predictable fixed order
    const totalWeight = available.reduce((sum, p) => sum + p.remainingQuota, 0);
    let random = Math.random() * totalWeight;
    for (const provider of available) {
        random -= provider.remainingQuota;
        if (random <= 0) {
            return provider;
        }
    }
    // Fallback: return the one with the most remaining
    return available[0];
}
// ═══════════════════════════════════════════════════════════════
// CIRCUIT BREAKER — Track consecutive failures per provider
// Auto-disables after CIRCUIT_BREAKER_THRESHOLD consecutive failures.
// ═══════════════════════════════════════════════════════════════
async function recordProviderFailure(providerId) {
    const db = admin.firestore();
    const ref = db.collection("providerUsage").doc(providerId);
    await db.runTransaction(async (txn) => {
        const snap = await txn.get(ref);
        const currentFailures = snap.exists ? (snap.data()?.consecutiveFailures || 0) : 0;
        const newFailures = currentFailures + 1;
        txn.set(ref, {
            consecutiveFailures: newFailures,
            lastFailureAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        // Auto-disable provider after threshold
        if (newFailures >= CIRCUIT_BREAKER_THRESHOLD) {
            const provRef = db.collection("emailProviders").doc(providerId);
            txn.update(provRef, {
                status: "error",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.error(`🔴 CIRCUIT BREAKER: Provider ${providerId} disabled after ${newFailures} consecutive failures`);
        }
    });
}
async function recordProviderSuccess(providerId) {
    const db = admin.firestore();
    await db.collection("providerUsage").doc(providerId).set({
        consecutiveFailures: 0,
        lastSuccessAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
// ═══════════════════════════════════════════════════════════════
// INCREMENT PROVIDER USAGE
// ═══════════════════════════════════════════════════════════════
async function incrementProviderUsage(providerId) {
    const db = admin.firestore();
    const ref = db.collection("providerUsage").doc(providerId);
    const today = getTodayString();
    await ref.set({
        date: today,
        usedToday: admin.firestore.FieldValue.increment(1),
        lastIncrementAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
//# sourceMappingURL=providerBalancer.js.map