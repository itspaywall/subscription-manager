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
