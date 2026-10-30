
const webpush = require("web-push");

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

if (!publicKey || !privateKey || !subject) {
    console.warn(
        "VAPID keys are missing. Push notifications are disabled."
    );
} else {
    webpush.setVapidDetails(
        subject,
        publicKey,
        privateKey
    );
}

async function sendPushNotification(subscription, payload) {
    if (!publicKey || !privateKey || !subject) {
        throw new Error("VAPID configuration is missing.");
    }

    try {
        await webpush.sendNotification(
            subscription,
            JSON.stringify(payload)
        );

        return { success: true };
    } catch (error) {
        console.error(
            "Push notification error:",
            error.statusCode,
            error.message
        );

        // 404 and 410 mean the subscription is no longer valid.
        return {
            success: false,
            statusCode: error.statusCode
        };
    }
}

module.exports = {
    publicKey,
    sendPushNotification
};
