//#region Classes
class JiraService {
    #httpClient = new HttpClient();
    #abortController;

    abortIssueSuggestion() {
        this.#abortController.abort();
    }

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

    async getIssueTypes() {
        const issues = [];
        for (const projectKey of enabledProjects) {
            const projTypes = await this.#getProjectIssueTypesAsync(projectKey);

            for (const { id, name } of projTypes) {
                if (issues.findIndex(el => el.id === id) > -1) continue;

                issues.push({id, name});
            }
        }

        issues.sort((a, b) => (a.name > b.name) ? 1 : ((a.name < b.name) ? -1 : 0))

        return issues;
    }

    async getStatusTypes() {
        var statuses = await this.#httpClient.getAsync("statuscategory");
        statuses.sort((a, b) => (a.name > b.name) ? 1 : ((a.name < b.name) ? -1 : 0))

        return statuses;
    }

    async getProjectSuggestionsAsync(projectName) {
        const queryParams = {
            query: projectName
        };

        return (await this.#httpClient.getAsync("project/search", queryParams)).values;
    }

    async #getProjectStatusTypesAsync(projectKey) {
        try {
            return (await this.#httpClient.getAsync(`project/${projectKey}/statuses`)).issueTypes;
        } catch(e) {
            return [];
        }
    }

    async #getProjectIssueTypesAsync(projectKey) {
        try {
            return (await this.#httpClient.getAsync(`project/${projectKey}`)).issueTypes;
        } catch(e) {
            return [];
        }
    }

    async getIssueSuggestionsAsync(str, useActiveSprint) {
        this.#abortController?.abort();
        this.#abortController = new AbortController();
        const { signal } = this.#abortController;

        str = str.replace(/[^A-Za-z0-9]/g, " ");
        console.log(str);

        let JQL = "";
        const queryParams = {
            query: `${str}`,
            showSubTasks: false
        };

        const checkAnd = () => { if (JQL.length > 0) JQL += " AND "; };

        //#region Option Params
        if (assigneeOnly) {
            checkAnd();
            JQL += "assignee=currentUser()"
        }

        if (useActiveSprint) {
            checkAnd();
            JQL += "sprint IN openSprints()"
        }

        if (enabledIssues.length > 0) {
            checkAnd();
            const issueStr = enabledIssues.join(", ");
            JQL += `issueType IN (${issueStr})`
        }

        if (enabledProjects.length > 0) {
            checkAnd();
            const projectStr = enabledProjects.join(", ");
            JQL += `project IN (${projectStr})`
        }

        if (enabledStatuses.length > 0) {
            checkAnd();
            const statusStr = enabledStatuses.join(", ");
            JQL += `statusCategory IN (${statusStr})`
        }

        if (JQL.length > 0) {
            queryParams.currentJQL = JQL;
        }
        //#endregion

        const response = (await this.#httpClient.getAsync("issue/picker", queryParams, signal)).sections;
        if (!response) return [];

        let [history, current] = response;

        const issues = [...(history?.issues ?? [])]

        for (const issue of (current?.issues ?? [])) {
            if (issues.findIndex(i => i.key === issue.key) > -1) continue;
    
            issues.push(issue);
        }

        return issues;
    }

    async getPlainIssueSuggestionsAsync(str) {
        const queryParams = {
            query: str,
            showSubTasks: false
        };

        let [history, current] = (await this.#httpClient.getAsync("issue/picker", queryParams)).sections;

        const issues = [...(history?.issues ?? [])]

        for (const issue of (current?.issues ?? [])) {
            if (issues.findIndex(i => i.key === issue.key) > -1) continue;
    
            issues.push(issue);
        }

        return issues;
    }
}

class HttpClient {
    #requestOptions;
    #headers;

    constructor() {
        var myHeaders = new Headers();
        myHeaders.append("Authorization", basicAuth);
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

let domain = null;
const urlBase = () => `${domain}/rest/api/2`;

let basicAuth = null;
let jiraService = null;
let issueTypes = null;
let statusTypes = null;
let enabledIssues = null;
let enabledStatuses = null;
let enabledProjects = null;
let assigneeOnly = false;

window.addEventListener('load', setup);

//#region setup
function setup() {
    setUrlBase();
    setupJiraAuth();
    getEnabledIssues();
    getEnabledStatuses();
    getEnabledProjects();
    getAssigneeOnly();
    displayEnabledProjects();
    document.getElementById("issue-types").addEventListener('click', displayIssueTypesAsync);
    document.getElementById("status-types").addEventListener('click', displayStatusTypesAsync);
    document.getElementById("project-search").addEventListener('input', searchProjectsAsync);
    document.getElementById("set-base-url").addEventListener('click', updateBaseUrl);
    document.getElementById("set-basic-auth").addEventListener('click', setBasicAuth);
    document.getElementById("set-assignee").addEventListener('click', setAssigneeOnly);
}

function getAssigneeOnly() {
    if (!localStorage.assigneeOnly) {
        assigneeOnly = false;
    } else {
        assigneeOnly = JSON.parse(localStorage.assigneeOnly);
    }

    document.getElementById("set-assignee").checked = assigneeOnly;
}

function setAssigneeOnly(e) {
    const isChecked = e.target.checked;
    localStorage.assigneeOnly = JSON.stringify(isChecked);
    assigneeOnly = isChecked;
}

function setUrlBase() {
    domain = localStorage.domain;

    if (!domain) {
        domain = "";
    }

    displayDomain();
}

function displayDomain() {
    document.getElementById("base-url").value = domain;
}

function updateBaseUrl() {
    domain = document.getElementById("base-url").value;
    localStorage.domain = domain;

    jiraService = new JiraService();
}

function setupJiraAuth() {
    const storageAuth = localStorage.basicAuth
    if (storageAuth) {
        basicAuth = storageAuth;
    } else {
        basicAuth = "";
    }
    
    jiraService = new JiraService();
}

function setBasicAuth() {
    var email = prompt("Please enter the email associated with your Atlassian account")
    var apiToken = prompt("Please provide your Jira api token")

    if (email && apiToken) {
        basicAuth = `Basic ${btoa(`${email}:${apiToken}`)}`
        localStorage.basicAuth = basicAuth;
        jiraService = new JiraService();
    } else {
        alert("You must provide both an email and API token!")
    }
}
//#endregion

//#region Issue types
function getEnabledIssues() {
    var issues = localStorage.enabledIssues;

    if(!issues) {
        enabledIssues = [];
        return;
    }

    enabledIssues = JSON.parse(issues);
}

async function displayIssueTypesAsync() {
    if (document.getElementById("issue-types").open) return;

    const types = issueTypes ?? await jiraService.getIssueTypes();

    let output = "";
    for (const type of types) {
        const enabled = enabledIssues.indexOf(type.id) > -1;
        output += createIssueTypeEl(type.name, type.id, enabled);
    }

    document.getElementById("issue-type-container").innerHTML = output;

    const typeCheckboxes = document.getElementsByClassName('toggle-issue-type');

    for (const box of typeCheckboxes) {
        box.addEventListener('click', toggleType)
    }
}

function saveEnabledIssues() {
    localStorage.enabledIssues = JSON.stringify(enabledIssues);
}

function toggleType(e) {
    const typeCheckboxes = document.getElementsByClassName('toggle-issue-type');

    const tempArr = [];
    for (const box of typeCheckboxes) {
        if (box.checked) {
            tempArr.push(box.id);
        }
    }

    enabledIssues = tempArr;
    saveEnabledIssues();
}

function createIssueTypeEl(name, id, isChecked) {
    return `
    <div class="issue-type-row">
        <input class='toggle-issue-type' type='checkbox' id=${id} ${isChecked ? "checked" : ""}/>
        <label>${name}</label>
    </div>
    `;
}
//#endregion

//#region Status types
function getEnabledStatuses() {
    var statuses = localStorage.enabledStatuses;

    if(!statuses) {
        enabledStatuses = [];
        return;
    }

    enabledStatuses = JSON.parse(statuses);
}

async function displayStatusTypesAsync() {
    if (document.getElementById("status-types").open) return;

    const types = statusTypes ?? await jiraService.getStatusTypes();

    let output = "";
    for (const type of types) {
        const enabled = enabledStatuses.indexOf(type.id) > -1 || enabledStatuses.indexOf(`${type.id}`) > -1;
        output += createStatusTypeEl(type.name, type.id, enabled);
    }

    document.getElementById("issue-status-container").innerHTML = output;

    const typeCheckboxes = document.getElementsByClassName('toggle-status-type');

    for (const box of typeCheckboxes) {
        box.addEventListener('click', toggleStatusType)
    }
}

function saveEnabledStatuses() {
    localStorage.enabledStatuses = JSON.stringify(enabledStatuses);
}

function toggleStatusType(e) {
    const enabled = e.target.checked;
    const id = e.target.id;
    
    if (enabled) {
        enabledStatuses.push(id);
        saveEnabledStatuses();
        return;
    }

    const index = enabledStatuses.indexOf(id);
    if (index > -1) {
        enabledStatuses.splice(index, 1);
    }

    saveEnabledStatuses();
}

function createStatusTypeEl(name, id, isChecked) {
    return `
    <div class="status-type-row">
        <input class='toggle-status-type' type='checkbox' id=${id} ${isChecked ? "checked" : ""}/>
        <label>${name}</label>
    </div>
    `;
}
//#endregion

//#region Project
function getEnabledProjects() {
    const localProjects = localStorage.enabledProjects;

    if (localProjects) {
        enabledProjects = JSON.parse(localProjects)
    } else {
        enabledProjects = [];
    }
    
}

function saveEnabledProjects() {
    localStorage.enabledProjects = JSON.stringify(enabledProjects);
}

function displayEnabledProjects() {
    let output = "";

    for (const project of enabledProjects) {
        output += createEnabledProjectEl(project);
    }

    document.getElementById("project-options-container").innerHTML = output;

    const removeButtons = document.getElementsByClassName('remove-project');

    for (const button of removeButtons) {
        button.addEventListener('click', removeProject)
    }
}

function removeProject(e) {
    const projectId = e.target.getAttribute('data-project-id');
    
    const index = enabledProjects.indexOf(projectId);

    if (index > -1) {
        enabledProjects.splice(index, 1);
    }

    saveEnabledProjects();
    displayEnabledProjects();
}

function createEnabledProjectEl(project) {
    return `
        <div class='enabled-project-wrapper'>
            <div class='remove-project' data-project-id='${project}'>x</div>
            <p class='project-name'>${project}</p>
        </div>
    `;
}

function addEnabledProject(e) {
    const project = e.target.id;

    if (enabledProjects.indexOf(project) > -1) return;

    enabledProjects.push(project);

    saveEnabledProjects();
    displayEnabledProjects();
}

async function searchProjectsAsync(e) {
    const searchVal = e.target.value;
    if (searchVal.length === 0) {
        document.getElementById("project-suggestions-container").innerHTML = "";
        return;
    }

    const projects = await jiraService.getProjectSuggestionsAsync(searchVal);
    
    let output = "";
    let counter = 0;
    for (const { name, key } of projects) {
        if (counter >= 5) break;

        if (enabledProjects.indexOf(key) > -1) continue;

        output += createProjectSuggestion(name, key);
        counter++;
    }

    document.getElementById("project-suggestions-container").innerHTML = output;

    const projectSuggestions = document.getElementsByClassName('project-suggestion');

    for (const suggestion of projectSuggestions) {
        suggestion.addEventListener('click', addEnabledProject)
    }
}

function createProjectSuggestion(projectName, key) {
    return `
        <button class='project-suggestion' id='${key}'>${key} - ${projectName}</button>
    `;
}
//#endregion

//#region Issue Suggestions
async function showJiraSuggestionsAsync(e) {
    const searchVal = e.target.value;
    if (searchVal.length === 0) {
        jiraService.abortIssueSuggestion();
        setTimeout(() => {
            document.getElementById("issue-suggestion-container").innerHTML = "";
        }, 500);
        return;
    }

    const issues = await jiraService.getIssueSuggestionsAsync(searchVal, true);

    const issueCount = () => issues.length;

    if (issueCount() < 3) {
        console.log("fallback 1")
        const altIssues = await jiraService.getIssueSuggestionsAsync(searchVal, false);

        for (const issue of altIssues) {
            if (issues.findIndex(i => i.key === issue.key) > -1) continue;
    
            issues.push(issue);
        }
    }

    if (issueCount() === 0) {
        console.log("fallback 2")
        const altIssues = await jiraService.getPlainIssueSuggestionsAsync(searchVal);

        for (const issue of altIssues) {
            if (issues.findIndex(i => i.key === issue.key) > -1) continue;
    
            issues.push(issue);
        }
    }

    displayIssueSuggestions(issues);
}

function displayIssueSuggestions(issues) {
    let output = "";
    let counter = 0;

    for (const issue of issues) {
        if (counter >= 5) break;

        output += createIssueSuggestion(issue);

        counter++;
    }

    document.getElementById("issue-suggestion-container").innerHTML = output;

    const suggestions = document.getElementsByClassName('issue-suggestion');

    for (const suggestion of suggestions) {
        suggestion.addEventListener('click', setWorkingStory)
    }
}

function createIssueSuggestion(issue) {
    return `
        <button class='issue-suggestion' data-jira-id='${issue.id}' data-jira-key='${issue.key}'>
            <div class='issue-key'>${issue.keyHtml}</div>
            <div class='issue-summary'>${issue.summary}</div>
        </button>
    `;
}

function setWorkingStory(e) {
    const issueKey = e.currentTarget.getAttribute('data-jira-key');
    ticketInput.value = issueKey;
    displayIssueSuggestions([]);
}
//#endregion