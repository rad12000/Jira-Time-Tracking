import TimeEntry from "./classes/time-entry.js";
import exportToCsv from "./utils/array-to-csv.js";
import { showJiraSuggestionsAsync } from "./jira.js";
import { getLastEntry, getLogArray, stopTime, getFormattedDate, saveLogArray } from "./utils/log.js";

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
//#endregion

//#region event listeners
window.addEventListener('load', async () => {
    await displayLogCount();

    ticketInput.addEventListener('input', showJiraSuggestionsAsync);
});

startTimerButton.addEventListener("click", async () => {
    await createNewEntry();
    await checkForRunningLog();

    timeSpentPTag.classList.add("hide");

    chrome.runtime.sendMessage({message: "Started"});
});

stopTimerButton.addEventListener("click", async () => {
    var timeSpent = await stopTime();
    await displayLogCount();
    await checkForRunningLog();

    timeSpentPTag.classList.remove("hide");
    timeSpentSpan.innerHTML = timeSpent;

        
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
//#endregion

//#region setup
getLoggedEventCount();
checkForRunningLog();
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