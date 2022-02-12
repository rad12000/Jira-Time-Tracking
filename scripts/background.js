const notificationResolve = {};
createListener();

function createListener() {
    chrome.alarms.onAlarm.addListener(handleReminderIntervalAsync);

    chrome.runtime.onMessage.addListener((e) => {
        switch (e.message) {
            case "Started":
                chrome.alarms.clearAll(() => {
                    chrome.alarms.create("Reminder check", {delayInMinutes: 1});
                });
                break;
            case "Stopped":
                chrome.alarms.clearAll();
                break;
            default:
                ""
        }
    });

    // Notification decision
    chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
        const resolver = notificationResolve[notificationId];
        if (!resolver) return;
        resolver(buttonIndex);
        delete notificationResolve[notificationId]
    });
}

//#region Helper funcs
function saveLogArray(logArray) {
    return new Promise ((resolve, reject) => { 
        chrome.storage.sync.set({logArray: JSON.stringify(logArray)}, function() {
            resolve();
        });
    });
}

async function clearAlarmsAsync() {
    return chrome.alarms.clearAll();
}

async function getLogArrayAsync() {
    var { logArray } = await chrome.storage.sync.get('logArray');

    if (logArray) {
        return JSON.parse(logArray);
    }

    return [];
}


async function getLastEntryAsync() {
    const logArray = await getLogArrayAsync();
    const logArrLen = logArray.length;

    if(logArrLen == 0) return false;
    
    return new TimeEntry(logArray[logArrLen - 1]);
}
//#endregion

//#region Logic
async function handleReminderIntervalAsync() {
    console.log("handler called")
    await clearAlarmsAsync();

    const entry = await getLastEntryAsync();
    if (!entry) return;

    const { isActive, ticketNumber } = entry;
    if (!isActive) return;

    const isDone = await isFinishedAsync(ticketNumber);

    console.log(isDone);

    if (!isDone) {
        chrome.alarms.create("Reminder check", {delayInMinutes: 1});
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
            title: "YES"
        };
    
        const noButton = {
            title: "NO"
        };
    
        const decisionAlertOptions = {
            title: 'Jira Time Tracking',
            message: `Are you still working on ${issueKey}?\n(Your time will automatically stop being tracked if yuo don't respond in 5 minutes)`,
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
        return this.timeSpent.length === 0;
    }

    set comment(comment) {
        this[3] = comment;
    }
}
//#endregion

//#region too much
async function updateLastEntry(timeEntry) {
    const logArray = await getLogArrayAsync();
    const logArrLen = logArray.length;

    if(logArrLen == 0) return false;

    logArray[logArrLen - 1] = timeEntry;

    saveLogArray(logArray);
}

async function removeLastEntry() {
    const logArray = await getLogArrayAsync();
    const logArrLen = logArray.length;

    if(logArrLen == 0) return fa
    
    logArray.splice(logArrLen - 1, 1);
    
    await saveLogArray(logArray);
}

async function stopTime() {
    const lastEntry = await getLastEntryAsync();

    if (!lastEntry) return;

    const stopDate = getFormattedDate();
    const startDate = lastEntry.startDate;
    const timeSpent = getTimeSpent(startDate, stopDate);

    lastEntry.timeSpent = timeSpent;

    await updateLastEntry(lastEntry);
    const jiraService = new JiraService();
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

//#region service calls
const urlBase = () => `${localStorage.domain ?? ""}/rest/api/2`;

class JiraService {
    #httpClient = new HttpClient();
    /**
     * 
     * @param {Date} startDate 
     * @param {string} hourAndMin. E.g. 00:00 
     * @param {string} comment 
     */
    async pushWorklogAsync(issueNumber, startDate, hourAndMin, comment) {
        const queryParams = {
            notifyUsers: false,
            adjustEstimate: "leave"
        };

        const [hour, minute] = hourAndMin.split(":");
        const isoDate = startDate.toISOString();
        const formattedDate = isoDate.substring(0, isoDate.length - 1) + "+0000"; // REMOVES THE "Z"

        const body = {
            timeSpent: `${hour} h ${minute} m`,
            comment,
            started: formattedDate
        }
        try {
            await this.#httpClient.postAsync(`issue/${issueNumber}/worklog`, body, queryParams);

            return true;
        } catch (e) {
            return false;
        }
    }
}

class HttpClient {
    #requestOptions;
    #headers;

    constructor() {
        chrome.storage.sync.get('basicAuth');
        var myHeaders = new Headers();
        myHeaders.append("Authorization", localStorage.basicAuth ?? "");
        myHeaders.append("Content-Type", "application/json");
        
        this.#headers = myHeaders;

        this.#requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };
    }

    /**
     * 
     * @param {string} path - path to be appended to base URL. DO not start with "/" 
     * @param {Record<string, string>} params - key, value pairs to use for query string
     * @returns 
     */
    async getAsync(path, params, signal) {
        const url = new URL(`${urlBase()}/${path}`);

        if (params) {
            url.search = new URLSearchParams(params);
        }

        if (!signal) {
            return (await fetch(url, this.#requestOptions)).json();
        }

        const options = {
            ...this.#requestOptions,
            signal
        }

        try {
            return (await fetch(url, options)).json();
        } catch (e) {
            if (e.name === "AbortError") {
                return false;
            }

            throw e;
        }
    }

    /**
     * 
     * @param {string} path - path to be appended to base URL. DO not start with "/" 
     * @param {Record<string, string>} params - key, value pairs to use for query string
     * @returns 
     */
     async postAsync(path, body, params) {
        const url = new URL(`${urlBase()}/${path}`);
        const request = {
            method: 'POST',
            headers: this.#headers,
            redirect: 'follow',
            body: JSON.stringify(body)
        };

        if (params) {
            url.search = new URLSearchParams(params);
        }

        return (await fetch(url, request));
    }
}
//#endregion