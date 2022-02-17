import TimeEntry from "./classes/time-entry.js";
import exportToCsv from "./utils/array-to-csv.js";
import { showJiraSuggestionsAsync } from "./jira.js";
import { getLastEntry, getLogArray, stopTime, getFormattedDate, saveLogArray } from "./utils/log.js";
import AppStorage from "./utils/app-storage.js";
import { moveCursorToEnd } from "./utils/move-to-end.js";
import BadgeUtil from "./utils/badge-util.js";
import { createAlarmAsync } from "./utils/alarm.js";

//#region const
const csvHeader = ["Ticket No", "Start Date", "Timespent", "Comment"];

const startTimerButton = document.getElementById("start");
const stopTimerButton = document.getElementById("stop");
const exportButton = document.getElementById("export");
const resetButton = document.getElementById("reset");
const commentInput = document.getElementById("comment");
const ticketInput = document.getElementById("ticket-number");
const timeSpentSpan = document.getElementById("time-spent");
const timeSpentPTag = document.getElementsByTagName("P")[0];
const eventCounter = document.getElementById("logged-events");
const pluralMinuteSpan = document.getElementById("plural-minutes");
const reminderMinuteInput = document.getElementById("reminder-minutes");
//#endregion

//#region event listeners
window.addEventListener('load', () => {
    displayLogCount();
    displayReminderDuration();

    ticketInput.addEventListener('input', showJiraSuggestionsAsync);
});

startTimerButton.addEventListener("click", async () => {
    await createNewEntry();
    await checkForRunningLog();

    timeSpentPTag.classList.add("hide");

    chrome.runtime.sendMessage({message: "Started"});
    BadgeUtil.showTrackingBadgeAsync();
});

stopTimerButton.addEventListener("click", async () => {
    var timeSpent = await stopTime();

    timeSpentPTag.classList.remove("hide");
    timeSpentSpan.innerHTML = timeSpent;

    await displayLogCount();
    await checkForRunningLog();
        
    chrome.runtime.sendMessage({message: "Stopped"});
});

exportButton.addEventListener("click", async () => {
    const logs = await getLogArray();
    logs.unshift(csvHeader);

    exportToCsv(`Time Log - ${getFormattedDate()}`, logs);
});

resetButton.addEventListener("click", async () => {
    saveLogArray([]);
    await checkForRunningLog();
    await displayLogCount();
    window.close();
});

reminderMinuteInput.addEventListener("input", async (e) => {
    console.log("input event called")
    const str = e.target.innerText;
    if (str.length === 0) {
        reminderMinuteInput.classList.add("inverted");
        return;
    };

    reminderMinuteInput.classList.remove("inverted");

    let val = Number(str);

    if (isNaN(val) || val < 1) {
        val = 60;   
    }

    val = Math.round(val);

    if (val === 1) {
        pluralMinuteSpan.classList.add("hide");
    } else {
        pluralMinuteSpan.classList.remove("hide");
    }

    AppStorage.setMinutesToRemindAsync(val).then(e => createAlarmAsync());
    reminderMinuteInput.innerText = val;
    moveCursorToEnd(e.target);
});
//#endregion

//#region setup
getLoggedEventCount();
checkForRunningLog();
async function displayReminderDuration() {
    const duration = await AppStorage.getMinutesToRemindAsync();
    reminderMinuteInput.innerText = duration;
    if (duration === 1) {
        pluralMinuteSpan.classList.add("hide");
    } else {
        pluralMinuteSpan.classList.remove("hide");
    }
}

async function checkForRunningLog() {
    const lastEntry = await getLastEntry();

    if (!lastEntry || lastEntry.timeSpent.length > 0) {
        stopTimerButton.classList.add("disabled");
        stopTimerButton.disabled = true;

        startTimerButton.classList.remove("disabled");
        startTimerButton.disabled = false;

        return;
    }

    ticketInput.value = lastEntry.ticketNumber;
    commentInput.value = lastEntry.comment;

    startTimerButton.classList.add("disabled");
    startTimerButton.disabled = true;

    stopTimerButton.classList.remove("disabled");
    stopTimerButton.disabled = false;
}
//#endregion

//#region UI
async function displayLogCount() {
    const count = await getLoggedEventCount();
    eventCounter.textContent = count;
}
//#endregion

//#region time log methods
async function getLoggedEventCount() {
    const events = await getLogArray();
    const timeLogEvents = events.map(event => new TimeEntry(event)).filter(entry => entry.timeSpent?.length > 0);

    return timeLogEvents.length;
}

async function createNewEntry() {
    const timeEntry = new TimeEntry();
    timeEntry.comment = commentInput.value;
    timeEntry.startDate = getFormattedDate();
    timeEntry.ticketNumber = ticketInput.value.toUpperCase();

    let logArray = await getLogArray();
    logArray.push(timeEntry);
    
    saveLogArray(logArray);
    displayLogCount();
}
//#endregion

function setTicketInputValue(val) {
    ticketInput.value = val;
}

export { setTicketInputValue };