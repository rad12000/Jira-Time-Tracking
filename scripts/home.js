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

function saveLogArray(logArray) {
    return new Promise ((resolve, reject) => { 
        chrome.storage.sync.set({logArray: JSON.stringify(logArray)}, function() {
            resolve();
        });
    });
}

async function getLogArray() {
    var { logArray } = await chrome.storage.sync.get('logArray');

    if (logArray) {
        return JSON.parse(logArray);
    }

    return [];
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

async function getLastEntry() {
    const logArray = await getLogArray();
    const logArrLen = logArray.length;

    if(logArrLen == 0) return false;
    
    return new TimeEntry(logArray[logArrLen - 1]);
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

    await displayLogCount();

    return timeSpent;
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
//#endregion

//#region exportToCsv
function exportToCsv(filename, rows) {
    var processRow = function (row) {
        var finalVal = '';
        for (var j = 0; j < row.length; j++) {
            var innerValue = row[j] === null ? '' : row[j].toString();
            if (row[j] instanceof Date) {
                innerValue = row[j].toLocaleString();
            };
            var result = innerValue.replace(/"/g, '""');
            if (result.search(/("|,|\n)/g) >= 0)
                result = '"' + result + '"';
            if (j > 0)
                finalVal += ',';
            finalVal += result;
        }
        return finalVal + '\n';
    };

    var csvFile = '';
    for (var i = 0; i < rows.length; i++) {
        csvFile += processRow(rows[i]);
    }

    var blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
    if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, filename);
    } else {
        var link = document.createElement("a");
        if (link.download !== undefined) { // feature detection
            // Browsers that support HTML5 download attribute
            var url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}
//#endregion

//#region TimeEntry class
class TimeEntry extends Array {
    constructor(array) {
        if(array) {
            super();
            Object.assign(this, array);
        } else {
            super(4).fill("");
        }
    }

    get ticketNumber() {
        return this[0];
    }

    set ticketNumber(ticketNumber) {
        this[0] = ticketNumber;
    }

    get startDate() {
        return this[1];
    }

    set startDate(startDate) {
        this[1] = startDate;
    }

    get timeSpent() {
        return this[2];
    }

    set timeSpent(timeSpent) {
        this[2] = timeSpent;
    }

    get comment() {
       return this[3];
    }

    get isActive () {
        return this.timeSpent.length >= 0;
    }

    set comment(comment) {
        this[3] = comment;
    }
}
//#endregion