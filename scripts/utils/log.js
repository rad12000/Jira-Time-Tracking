import TimeEntry from "../classes/time-entry.js";
import jiraService from "../services/jira-service.js";
import BadgeUtil from "../utils/badge-util.js";

async function getLogArray() {
    var { logArray } = await chrome.storage.sync.get('logArray');

    if (logArray) {
        return JSON.parse(logArray);
    }

    return [];
}

async function getLastEntry() {
    const logArray = await getLogArray();
    const logArrLen = logArray.length;

    if(logArrLen == 0) return false;
    
    return new TimeEntry(logArray[logArrLen - 1]);
}


function getTimeSpent(startDateString, stopDateString) {
    const start = new Date(startDateString);
    const stop = new Date(stopDateString);

    const difInMil = Math.abs(stop - start);
    const difInSec = difInMil / 1000;
    const difInMin = Math.floor(difInSec / 60);

    const hoursSpent = Math.floor(difInMin / 60);
    const minutesSpent = difInMin % 60;

    return `${hoursSpent}:${String(minutesSpent).padStart(2, "0")}`;
}

function getFormattedDate() {
    var date = new Date();

    var dateString = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}`;

    return dateString;
}

function saveLogArray(logArray) {
    return new Promise ((resolve, reject) => { 
        chrome.storage.sync.set({logArray: JSON.stringify(logArray)}, function() {
            resolve();
        });
    });
}

async function updateLastEntry(timeEntry) {
    const logArray = await getLogArray();
    const logArrLen = logArray.length;

    if(logArrLen == 0) return false;

    logArray[logArrLen - 1] = timeEntry;

    saveLogArray(logArray);
}

async function removeLastEntry() {
    const logArray = await getLogArray();
    const logArrLen = logArray.length;

    if(logArrLen == 0) return fa
    
    logArray.splice(logArrLen - 1, 1);
    
    await saveLogArray(logArray);
}

async function stopTime() {
    const lastEntry = await getLastEntry();

    if (!lastEntry) return;

    const stopDate = getFormattedDate();
    const startDate = lastEntry.startDate;
    const timeSpent = getTimeSpent(startDate, stopDate);

    lastEntry.timeSpent = timeSpent;

    await updateLastEntry(lastEntry);
    const success = await jiraService.pushWorklogAsync(lastEntry.ticketNumber, new Date(startDate), timeSpent, lastEntry.comment);

    if (success) {
        await removeLastEntry()
    }

    BadgeUtil.hideTrackingBadgeAsync();
    return timeSpent;
}

export { getLastEntry, getLogArray, stopTime, getFormattedDate, saveLogArray }