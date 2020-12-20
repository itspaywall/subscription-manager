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

const addDays = require("date-fns/addDays");
const Invoice = require("./model/invoice");
const redisClient = require("./util/redis");

function pad(number, size, base) {
    let result = number.toString(base).toUpperCase();
    while (result.length < size) {
        result = "0" + result;
    }
    return result;
}

function getInvoiceNumber(prefix, id) {
    return new Promise((resolve, reject) => {
        redisClient.incr(id, (error, count) => {
            if (error) {
                return reject(error);
            }

            if (count == 1) {
                const now = new Date();
                const midnight = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate(),
                    0,
                    0,
                    0
                );
                const sinceMidnight = parseInt(
                    Math.round((now.getTime() - midnight.getTime()) / 1000)
                );
                const ttl = 86400 - sinceMidnight;
                redisClient.expire(id, ttl);
            }

            const today = new Date();
            const date =
                today.getFullYear() +
                pad(today.getMonth(), 2, 10) +
                pad(today.getDate(), 2, 10);
            const number = pad(count, 4, 36);
            resolve(`${prefix}-${date}-${number}`);
        });
    });
}

// TODO: Move this to `invoices.test.js`.
// function generate(prefix, id) {
//     getInvoiceNumber(prefix, id)
//         .then((value) => {
//             console.log(`New invoice number: ${value}`);
//         })
//         .catch((error) => {
//             console.log(error);
//         });
// }

// generate("HUB", "hubble_abc");
// generate("DAR", "darwin_123");
// generate("DAR", "darwin_123");
// generate("DAR", "darwin_123");
// generate("DAR", "darwin_123");
// generate("HUB", "hubble_abc");
// generate("HUB", "hubble_abc");

async function create(subscription, items) {
    let total = 0;
    let subtotal = 0;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        total += item.total;
        subtotal += item.subtotal;
    }

    const invoice = new Invoice({
        ownerId: subscription.ownerId,
        accountId: subscription.accountId,
        subscriptionId: subscription._id,
        invoiceNumber: await getInvoiceNumber(
            "HUB",
            subscription.ownerId.toString()
        ),
        status: "pending",
        subtotal,
        total,
        origin: "purchase",
        notes: subscription.notes,
        termsAndConditions: subscription.termsAndConditions,
        dueAt: addDays(new Date(), 1),
        closedAt: null,
        items,
    });

    return invoice;
}

async function createInitial(subscription) {
    const invoice = await create(subscription, [
        {
            referenceId: subscription._id,
            type: "setup_fee",
            description: "Setup Fee",
            quantity: 1,
            startedAt: subscription.createdAt,
            endedAt: subscription.createdAt,
            subtotal: subscription.setupFee,
            total: subscription.setupFee,
        },
    ]);
    return invoice;
}

module.exports = {
    create,
    createInitial,
};
