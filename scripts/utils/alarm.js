import AppStorage from './app-storage.js';
import { getLastEntry } from "./log.js";

async function hasLogInProgressAsync() {
    const entry = await getLastEntry();
    if (!entry) return false;

    return entry.isActive;
}

async function createAlarmAsync() {
    if (!(await hasLogInProgressAsync())) return;

    await clearAlarmsAsync();
    
    const minutes = await AppStorage.getMinutesToRemindAsync();

    return await chrome.alarms.create("Reminder check", {delayInMinutes: minutes});
}

async function clearAlarmsAsync() {
    return await chrome.alarms.clearAll();
}

export { createAlarmAsync, clearAlarmsAsync };