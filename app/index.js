const cron = require("cron");

const job = new cron.CronJob("* * * * * *", () => {
    try {
        console.log("You will see this message every second.");
        throw new Error();
    } catch (exception) {
        //  What do we do here?
        console.log(exception);
    }
});
job.start();
