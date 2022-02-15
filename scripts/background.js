import jiraService from "./services/jira-service.js";
import SearchOptions from "./static/search-options.js";
import AppStorage from "./utils/app-storage.js";
import { getLastEntry } from "./utils/log.js";
import { stopTime } from "./utils/log.js";

const notificationResolve = {};
createListener();

function createListener() {
    createAlarmListener();
    createMessageListener();
    createNotificationDecisionListener();
    createAlarmAsync();
}

//#region Listeners
function createAlarmListener() {
    chrome.alarms.onAlarm.addListener(handleReminderIntervalAsync);
}

function createMessageListener() {
    chrome.runtime.onMessage.addListener((e) => {
        switch (e.message) {
            case "Started":
                createAlarmAsync();
                break;
            case "Stopped":
                clearAlarmsAsync();
                break;
            default:
                ""
        }
    });
}

function createNotificationDecisionListener() {
    chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
        const resolver = notificationResolve[notificationId];
        if (!resolver) return;
        resolver(buttonIndex);
        delete notificationResolve[notificationId]
    });
}
//#endregion

//#region Helper funcs
async function createAlarmAsync() {
    await clearAlarmsAsync();
    console.log(SearchOptions.domain) 
    return await chrome.alarms.create("Reminder check", {delayInMinutes: 1});
}

async function clearAlarmsAsync() {
    return await chrome.alarms.clearAll();
}
//#endregion

//#region Logic
async function handleReminderIntervalAsync() {
    jiraService.refreshClientAsync();

    await clearAlarmsAsync();

    const entry = await getLastEntry();
    if (!entry) return;

    const { isActive, ticketNumber } = entry;
    if (!isActive) return;

    const isDone = await isFinishedAsync(ticketNumber);

    if (!isDone) {
        await createAlarmAsync();
        return;
    }

    await stopTime();
}

async function isFinishedAsync(issueKey) {
    const id = await displayWarningNotificationAsync(issueKey);
    const prms = new Promise((resolve, _) => notificationResolve[id] = resolve);

    // After 5 minutes
    setTimeout(() => {
        const resolver = notificationResolve[id];
        if (!resolver) return;
        resolver(true);
        delete notificationResolve[id];
        chrome.notifications.clear(id);
    }, 300000)

    return prms;
}

function displayWarningNotificationAsync(issueKey) {
    return new Promise((resolve, _) => {
        const yesButton = {
            title: "YES, I'm finished"
        };
    
        const noButton = {
            title: "NO, I'm still working"
        };
    
        const decisionAlertOptions = {
            title: 'Jira Time Tracking',
            message: `Are you done working on ${issueKey}?\n(Your time will automatically stop being tracked if you don't respond in 5 minutes)`,
            buttons: [noButton, yesButton],
            requireInteraction: true,
            eventTime: Date.now(),
            iconUrl: '../icons/icon128.png',
            type: 'basic'
        };
    
        chrome.notifications.create(decisionAlertOptions, (id) => resolve(id));
    })
}
//#endregion