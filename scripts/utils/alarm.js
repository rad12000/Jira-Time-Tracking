import AppStorage from './app-storage.js';

async function createAlarmAsync() {
    console.log("Calling clear alarms")
    await clearAlarmsAsync();
    
    const minutes = await AppStorage.getMinutesToRemindAsync();

    console.log("Alarm created "  + new Date())
    return await chrome.alarms.create("Reminder check", {delayInMinutes: minutes});
}

async function clearAlarmsAsync() {
    console.log("Alarms cleared")
    return await chrome.alarms.clearAll();
}

export { createAlarmAsync, clearAlarmsAsync };