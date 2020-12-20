/*
 * Copyright 2017-2020 Samuel Rowe, Joel E. Rego
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
