const amqp = require("amqplib/callback_api");

const QUEUE_NAME = "message";

async function sendMail(from, to, subject, body) {
    const connection = await amqp.connect("amqp://localhost");
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    const content = {
        platform: "email",
        from,
        to,
        subject,
        body,
    };
    const payload = JSON.stringify(content);
    await channel.sendToQueue(
        QUEUE_NAME,
        Buffer.from(payload, { persistent: true })
    );
    console.log(`[info] Placed a message on the ${QUEUE_NAME} queue.`);
}

module.exports = {
    sendMail,
};
