import AppStorage from './app-storage.js';
import { getLastEntry } from "./log.js";

export const reminderAlarm = "Reminder check";
export const autoStopAlarm = "Auto stop";

async function hasLogInProgressAsync() {
    const entry = await getLastEntry();
    if (!entry) return false;

    return entry.isActive;
}

async function createReminderAlarmAsync() {
    await clearReminderAlarmsAsync();

    if (!(await hasLogInProgressAsync())) return;
    
    const minutes = await AppStorage.getMinutesToRemindAsync();

    await chrome.alarms.create(reminderAlarm, {delayInMinutes: minutes});
    await alertNewReminderAsync();

    return;
}

async function createAutoStopAlarmAsync() {
    await clearReminderAlarmsAsync();

    if (!(await hasLogInProgressAsync())) return;

    await chrome.alarms.create(autoStopAlarm, {delayInMinutes: 1});
}

async function clearReminderAlarmsAsync() {
    return await chrome.alarms.clear(reminderAlarm);
}

async function clearAutoStopAlarmsAsync() {
    return await chrome.alarms.clear(autoStopAlarm);
}

async function alertNewReminderAsync() {
    const getReminderTimeAsync = async () => {
        const minutes = await AppStorage.getMinutesToRemindAsync();
        const date = new Date();
        date.setMinutes(date.getMinutes() + minutes);

        return date.toLocaleTimeString();
    }

    const decisionAlertOptions = {
        title: 'Jira Time Tracking',
        message: `We'll double check you're still working at ${await getReminderTimeAsync()}`,
        eventTime: Date.now(),
        iconUrl: '../icons/icon128.png',
        type: 'basic'
    };

    chrome.notifications.create(decisionAlertOptions);
}

export { createReminderAlarmAsync, createAutoStopAlarmAsync, clearReminderAlarmsAsync, clearAutoStopAlarmsAsync };