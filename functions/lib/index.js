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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemHealthCheck = exports.disasterBankProcessor = exports.reminderScheduler = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const scheduler_2 = require("./scheduler");
const disasterBank_1 = require("./disasterBank");
admin.initializeApp();
// ═══════════════════════════════════════════════════════════════
// LAYER 1: Normal Scheduler — Every minute
// Processes pending reminders with retry, provider rotation, quota checks.
// ═══════════════════════════════════════════════════════════════
exports.reminderScheduler = (0, scheduler_1.onSchedule)({
    schedule: "* * * * *", // Every minute
    timeZone: "UTC",
    retryCount: 0,
    memory: "256MiB",
    timeoutSeconds: 60,
    region: "asia-south1",
}, async () => {
    await (0, scheduler_2.processReminders)();
});
// ═══════════════════════════════════════════════════════════════
// LAYER 2: Disaster Bank Processor — Every 5 minutes
// Attempts recovery of captured failed jobs with exponential backoff.
// ═══════════════════════════════════════════════════════════════
exports.disasterBankProcessor = (0, scheduler_1.onSchedule)({
    schedule: "*/5 * * * *", // Every 5 minutes
    timeZone: "UTC",
    retryCount: 0,
    memory: "256MiB",
    timeoutSeconds: 120,
    region: "asia-south1",
}, async () => {
    try {
        await (0, disasterBank_1.processDisasterBank)();
    }
    catch (err) {
        console.error("🚨 DISASTER BANK PROCESSOR CRASHED:", err);
    }
});
// ═══════════════════════════════════════════════════════════════
// LAYER 3: System Health Check — Every 15 minutes
// Validates system integrity and auto-repairs corrupted state.
// ═══════════════════════════════════════════════════════════════
exports.systemHealthCheck = (0, scheduler_1.onSchedule)({
    schedule: "*/15 * * * *", // Every 15 minutes
    timeZone: "UTC",
    retryCount: 0,
    memory: "256MiB",
    timeoutSeconds: 60,
    region: "asia-south1",
}, async () => {
    try {
        await (0, disasterBank_1.runHealthCheck)();
        await (0, disasterBank_1.repairState)();
    }
    catch (err) {
        console.error("🚨 HEALTH CHECK CRASHED:", err);
    }
});
__exportStar(require("./triggers"), exports);
//# sourceMappingURL=index.js.map