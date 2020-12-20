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

require("dotenv").config();

const cron = require("cron");
const mongoose = require("mongoose");
const logger = require("./util/logger");
const manager = require("./subscription-manager");

const CRON_TRIGGER = process.env.CRON_TRIGGER;
const DATABASE_URL = process.env.DATABASE_URL;

function main() {
    mongoose.connect(DATABASE_URL, {
        useNewUrlParser: true,
    });
    mongoose.connection.on("error", () =>
        logger.error("Cannot establish a connection to the database.")
    );
    mongoose.connection.once("open", () => {
        logger.info("Database connection successfully established.");

        logger.info("Initializing cron job...");
        const job = new cron.CronJob(
            CRON_TRIGGER,
            () => {
                const executor = {
                    active: manager.updateActive,
                    in_trial: manager.updateInTrial,
                    future: manager.updateFuture,
                    new: manager.updateNew,
                };

                Object.keys(executor).forEach((key) => {
                    logger.info(`Updating "${key}" subscriptions, if any.`);
                    executor[key]().catch((error) => {
                        console.log(error);
                        logger.error(error.message);
                    });
                });
            },
            null,
            false,
            undefined,
            undefined,
            true
        );
        job.start();
    });
}

main();
