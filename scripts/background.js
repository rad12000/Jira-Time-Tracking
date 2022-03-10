import jiraService from "./services/jira-service.js";
import { getLastEntry } from "./utils/log.js";
import { stopTime } from "./utils/log.js";
import { clearAutoStopAlarmsAsync, clearReminderAlarmsAsync, createAutoStopAlarmAsync, createReminderAlarmAsync, reminderAlarm } from "./utils/alarm.js";
import AppStorage from "./utils/app-storage.js";

createListener();

function createListener() {
    createAlarmListener();
    createMessageListener();
    createNotificationDecisionListener();
    createReminderAlarmAsync();
}

//#region Listeners
function createAlarmListener() {
    chrome.alarms.onAlarm.addListener(handleReminderIntervalAsync);
}

function createMessageListener() {
    chrome.runtime.onMessage.addListener((e, _, sendResponse) => {
        switch (e.message) {
            case "Started":
                sendResponse(true);
                createReminderAlarmAsync();
                break;
            case "Stopped":
                sendResponse(true);
                clearReminderAlarmsAsync();
                break;
            default:
                ""
        }
    });
}

function createNotificationDecisionListener() {
    chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
        await AppStorage.setShouldAutoStopAsync({ shouldStop: false });
        await clearAutoStopAlarmsAsync();

        if(!buttonIndex) {
            await createReminderAlarmAsync();
        } else {
            await stopTime();
        }
    });
}
//#endregion

//#region Logic
async function handleReminderIntervalAsync(e) {
    if (e.name === reminderAlarm) {
        jiraService.refreshClientAsync();

        await clearReminderAlarmsAsync();

        const entry = await getLastEntry();
        if (!entry) return;

        const { isActive, ticketNumber } = entry;
        if (!isActive) return;

        await confirmFinishedAsync(ticketNumber);
    } else {
        const shouldStopSettings = await AppStorage.getShouldAutoStopAsync();

        await clearAutoStopAlarmsAsync();

        if (!shouldStopSettings.shouldStop) return;

        await clearReminderAlarmsAsync();
        await stopTime();

        chrome.notifications.clear(shouldStopSettings.notificationId);
    }
}

async function confirmFinishedAsync(issueKey) {
    const notificationId = await displayWarningNotificationAsync(issueKey);
    await createAutoStopAlarmAsync();
    await AppStorage.setShouldAutoStopAsync({ notificationId, shouldStop: true });
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