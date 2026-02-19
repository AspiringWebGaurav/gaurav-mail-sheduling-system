import https from "https";

// ═══ SIMULATION MODE ═══
// When enabled, intercepts all email sends and returns simulated success.
// Toggle: set GMSS_SIMULATION_MODE=true in functions/.env
let simulationCount = 0;
export function getSimulationCount(): number { return simulationCount; }
export function resetSimulationCount(): void { simulationCount = 0; }

interface ProviderConfig {
    serviceId: string;
    templateId: string;
    publicKey: string;
    privateKey: string;
}

interface EmailParams {
    to_email: string;
    from_name?: string;
    reply_to_email?: string;
    event_title: string;
    event_id: string;
    scheduled_time: string;
    htmlContent?: string;
    subject?: string;
    customTitle?: string;
}

const SEND_TIMEOUT_MS = 15000; // 15s timeout for EmailJS API call

export async function sendEmail(
    provider: ProviderConfig,
    params: EmailParams
): Promise<void> {
    // ── Request ID for cross-log tracing ──
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    // ═══ SIMULATION MODE GATE ═══
    if (process.env.GMSS_SIMULATION_MODE === "true") {
        simulationCount++;
        console.log(
            `📧 [SIMULATION] Email #${simulationCount} [${requestId}] | To: ${params.to_email} | ` +
            `Subject: ${params.subject || "N/A"} | Provider: ${provider.serviceId}`
        );
        // Simulate network latency
        await new Promise((r) => setTimeout(r, 200));
        return; // Success without real API call
    }

    // Validate required params
    if (!params.to_email) {
        throw new Error("Missing recipient email (to_email)");
    }
    if (!provider.serviceId || !provider.publicKey) {
        throw new Error("Invalid provider config: missing serviceId or publicKey");
    }

    const messageContent = params.htmlContent
        || `Your event "${params.event_title}" is coming up! Event ID: ${params.event_id}`;

    const emailSubject = params.subject || `Reminder: ${params.event_title}`;
    const emailTitle = params.customTitle || emailSubject;

    const payload = JSON.stringify({
        service_id: provider.serviceId,
        template_id: provider.templateId,
        user_id: provider.publicKey,
        accessToken: provider.privateKey,
        template_params: {
            to_email: params.to_email,
            from_name: params.from_name || "GMSS Reminder System",
            reply_to: params.reply_to_email || "no-reply@gmss.app",
            subject: emailSubject,
            title: emailTitle,
            name: params.from_name || "GMSS Reminder System",
            time: params.scheduled_time,
            message: messageContent,
            email: params.to_email,
        },
    });

    return new Promise((resolve, reject) => {
        // Timeout protection — reject if no response within SEND_TIMEOUT_MS
        const timeout = setTimeout(() => {
            req.destroy();
            reject(new Error(`EmailJS request timed out after ${SEND_TIMEOUT_MS}ms`));
        }, SEND_TIMEOUT_MS);

        const options = {
            hostname: "api.emailjs.com",
            port: 443,
            path: "/api/v1.0/email/send",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
            },
        };

        // ── LOG REQUEST (REDACTED) ──
        console.log(JSON.stringify({
            level: 'INFO',
            event: 'EMAIL_SEND_INIT',
            requestId,
            serviceId: provider.serviceId,
            templateId: provider.templateId,
            recipient: params.to_email,
            subject: emailSubject
        }));

        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                clearTimeout(timeout);
                if (res.statusCode === 200) {
                    // Response validation — EmailJS returns 'OK' on success
                    if (data && data.trim() !== 'OK') {
                        console.warn(JSON.stringify({
                            level: 'WARN',
                            event: 'EMAILJS_UNEXPECTED_BODY',
                            requestId,
                            body: data.slice(0, 200)
                        }));
                    }
                    console.log(JSON.stringify({
                        level: 'INFO',
                        event: 'EMAILJS_SUCCESS',
                        requestId,
                        statusCode: res.statusCode,
                        body: data.trim()
                    }));
                    resolve();
                } else {
                    console.error(JSON.stringify({
                        level: 'ERROR',
                        event: 'EMAILJS_FAILURE',
                        requestId,
                        statusCode: res.statusCode,
                        body: data
                    }));
                    reject(new Error(`[${requestId}] EmailJS API error ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on("error", (err) => {
            clearTimeout(timeout);
            console.error(JSON.stringify({
                level: 'ERROR',
                event: 'EMAILJS_NET_ERROR',
                requestId,
                error: err.message
            }));
            reject(new Error(`[${requestId}] EmailJS request failed: ${err.message}`));
        });

        req.write(payload);
        req.end();
    });
}
