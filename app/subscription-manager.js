const isAfter = require("date-fns/isAfter");
const addDays = require("date-fns/addDays");
const addMonths = require("date-fns/addMonths");
const assert = require("assert");

const logger = require("./util/logger");
const Subscription = require("./model/subscription");
const Plan = require("./model/plan");

const NEW_BATCH_LIMIT = parseInt(process.env.NEW_BATCH_LIMIT || 100);
const FUTURE_BATCH_LIMIT = parseInt(process.env.FUTURE_BATCH_LIMIT || 100);
const IN_TRIAL_BATCH_LIMIT = parseInt(process.env.IN_TRIAL_BATCH_LIMIT || 100);
const ACTIVE_BATCH_LIMIT = parseInt(process.env.ACTIVE_BATCH_LIMIT || 100);

const incrementerByUnit = {
    days: addDays,
    months: addMonths,
};

function incrementDate(date, amount, unit) {
    const incrementer = incrementerByUnit[unit];
    return incrementer(date, amount);
}

function updateState(subscription, plan, now) {
    const activateTrial = () => {
        subscription.status = "in_trial";
        subscription.trialStartedAt = now;
        return incrementDate(now, plan.trialPeriod, plan.trialPeriodUnit);
    };

    const endTrial = () => {
        subscription.currentPeriodStart = now;
        subscription.currentPeriodEnd = activatePlan(subscription, plan, now);
    };

    const activatePlan = () => {
        subscription.status = "active";
        subscription.activatedAt = now;
        subscription.currentBillingCycle = 1;
        return incrementDate(
            now,
            plan.billingCyclePeriod,
            plan.billingCyclePeriodUnit
        );
    };

    const activateNextCycle = () => {
        subscription.currentPeriodStart = now;
        subscription.currentPeriodEnd = incrementDate(
            now,
            plan.billingCyclePeriod,
            plan.billingCyclePeriodUnit
        );
        subscription.currentBillingCycle++;
    };

    const expire = () => {
        subscription.status = "expired";
        subscription.expiredAt = now;
        subscription.currentPeriodStart = null;
        subscription.currentPeriodEnd = null;
    };

    const activateInitial = () => {
        if (plan.trialPeriod > 0) {
            currentPeriodEnd = activateTrial();
        } else {
            currentPeriodEnd = activatePlan();
        }
        subscription.currentPeriodStart = now;
        subscription.currentPeriodEnd = currentPeriodEnd;
    };

    switch (subscription.status) {
        case "new": {
            let currentPeriodEnd;
            if (isAfter(now, subscription.startsAt)) {
                activateInitial();
            } else {
                subscription.status = "future";
            }
            break;
        }

        case "future": {
            assert(
                isAfter(now, subscription.startsAt),
                "The specified subscription is ineligible."
            );

            activateInitial();
            break;
        }

        case "in_trial": {
            assert(
                isAfter(now, subscription.currentPeriodEnd),
                "The specified subscription is ineligible."
            );

            endTrial();
            break;
        }

        case "active": {
            assert(
                isAfter(now, subscription.currentPeriodEnd),
                "The specified subscription is ineligible."
            );

            if (
                subscription.currentBillingCycle + 1 <=
                subscription.totalBillingCycles
            ) {
                activateNextCycle();
            } else {
                expire();
            }
            break;
        }

        default: {
            logger.error(
                `Unknown subscription status "${subscription.status}".`
            );
            break;
        }
    }
}

async function updateBatchState(status, query, limit) {
    const subscriptions = await Subscription.find(query).limit(limit).exec();
    logger.info(`Found ${subscriptions.length} subscriptions for "${status}".`);
    const uniquePlanIds = {};
    subscriptions.forEach(
        (subscription) => (uniquePlanIds[subscription.planId] = true)
    );
    const planIds = Object.keys(uniquePlanIds);

    const plans = await Plan.find({ _id: { $in: planIds } });
    const planByIds = {};
    plans.forEach((plan) => (planByIds[plan.id] = plan));

    subscriptions.forEach((subscription) => {
        try {
            const now = new Date();
            const plan = planByIds[subscription.planId];
            updateState(subscription, plan, now);
            logger.info(`Updated subscription "${subscription.id}"`);
            subscription.save();
        } catch (error) {
            logger.error(error);
        }
    });
}

/*
 * A subscription can go to one of the following states from the 'new' state.
 * - in_trial
 * - active
 * - future
 */
function updateNew() {
    return updateBatchState("new", { status: "new" }, NEW_BATCH_LIMIT);
}

function updateFuture() {
    return updateBatchState(
        "future",
        { status: "future", startsAt: { $lte: new Date() } },
        FUTURE_BATCH_LIMIT
    );
}

function updateInTrial() {
    return updateBatchState(
        "in_trial",
        { status: "in_trial", currentPeriodEnd: { $lte: new Date() } },
        IN_TRIAL_BATCH_LIMIT
    );
}

function updateActive() {
    return updateBatchState(
        "active",
        { status: "active", currentPeriodEnd: { $lte: new Date() } },
        ACTIVE_BATCH_LIMIT
    );
}

module.exports = {
    updateFuture,
    updateInTrial,
    updateActive,
    updateNew,
};
