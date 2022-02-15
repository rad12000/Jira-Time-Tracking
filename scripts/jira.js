import { setTicketInputValue } from './home.js';
import jiraService from './services/jira-service.js';
import SearchOptions from './static/search-options.js';
import AppStorage from './utils/app-storage.js';

try {
    window.addEventListener('load', setup);
} catch (e) {}

//#region setup
async function setup() {
    await setUrlBaseAsync();
    await getEnabledIssues();
    await getEnabledStatuses();
    await getEnabledProjects();
    getAssigneeOnly();
    displayEnabledProjects();
    document.getElementById("issue-types").addEventListener('click', displayIssueTypesAsync);
    document.getElementById("status-types").addEventListener('click', displayStatusTypesAsync);
    document.getElementById("project-search").addEventListener('input', searchProjectsAsync);
    document.getElementById("set-base-url").addEventListener('click', updateBaseUrl);
    document.getElementById("set-basic-auth").addEventListener('click', setBasicAuth);
    document.getElementById("set-assignee").addEventListener('click', setAssigneeOnly);
}

async function getAssigneeOnly() {
    SearchOptions.assigneeOnly = await AppStorage.getAssigneeOnlyAsync();

    document.getElementById("set-assignee").checked = SearchOptions.assigneeOnly;
}

function setAssigneeOnly(e) {
    const isChecked = e.target.checked;
    AppStorage.setAssigneeOnlyAsync(isChecked);
    SearchOptions.assigneeOnly = isChecked;
}

async function setUrlBaseAsync() {
    SearchOptions.domain = await AppStorage.getAtlassianDomainAsync();

    jiraService.refreshClientAsync();

    if (!SearchOptions.domain) {
        SearchOptions.domain = "";
    }

    displayDomain();
}

function displayDomain() {
    document.getElementById("base-url").value = SearchOptions.domain;
}

function updateBaseUrl() {
    SearchOptions.domain = document.getElementById("base-url").value;
    AppStorage.setAtlassianDomainAsync(SearchOptions.domain)
    .then(_ => jiraService.refreshClientAsync());
}

function setBasicAuth() {
    var email = prompt("Please enter the email associated with your Atlassian account")
    var apiToken = prompt("Please provide your Jira api token")

    if (email && apiToken) {
        const basicAuth = `Basic ${btoa(`${email}:${apiToken}`)}`
        AppStorage.setAtlassianAuthAsync(basicAuth)
        .then(_ => jiraService.refreshClientAsync());
    } else {
        alert("You must provide both an email and API token!")
    }
}
//#endregion

//#region Issue types
async function getEnabledIssues() {
    SearchOptions.enabledIssues = await AppStorage.getEnabledIssuesAsync();
}

async function displayIssueTypesAsync() {
    if (document.getElementById("issue-types").open) return;

    const types = SearchOptions.issueTypes ?? await jiraService.getIssueTypes();

    let output = "";
    for (const type of types) {
        const enabled = SearchOptions.enabledIssues.indexOf(type.id) > -1;
        output += createIssueTypeEl(type.name, type.id, enabled);
    }

    document.getElementById("issue-type-container").innerHTML = output;

    const typeCheckboxes = document.getElementsByClassName('toggle-issue-type');

    for (const box of typeCheckboxes) {
        box.addEventListener('click', toggleType)
    }
}

function toggleType(e) {
    const typeCheckboxes = document.getElementsByClassName('toggle-issue-type');

    const tempArr = [];
    for (const box of typeCheckboxes) {
        if (box.checked) {
            tempArr.push(box.id);
        }
    }

    SearchOptions.enabledIssues = tempArr;
    AppStorage.setEnabledIssuesAsync(tempArr);
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
async function getEnabledStatuses() {
    SearchOptions.enabledStatuses = await AppStorage.getEnabledStatusesAsync();
}

async function displayStatusTypesAsync() {
    if (document.getElementById("status-types").open) return;

    const types = SearchOptions.statusTypes ?? await jiraService.getStatusTypes();

    let output = "";
    for (const type of types) {
        const enabled = SearchOptions.enabledStatuses.indexOf(type.id) > -1 || SearchOptions.enabledStatuses.indexOf(`${type.id}`) > -1;
        output += createStatusTypeEl(type.name, type.id, enabled);
    }

    document.getElementById("issue-status-container").innerHTML = output;

    const typeCheckboxes = document.getElementsByClassName('toggle-status-type');

    for (const box of typeCheckboxes) {
        box.addEventListener('click', toggleStatusType)
    }
}

function toggleStatusType(e) {
    const enabled = e.target.checked;
    const id = e.target.id;
    
    if (enabled) {
        SearchOptions.enabledStatuses.push(id);
        
        AppStorage.setEnabledStatusesAsync(SearchOptions.enabledStatuses);
        return;
    }

    const index = SearchOptions.enabledStatuses.indexOf(id);
    if (index > -1) {
        SearchOptions.enabledStatuses.splice(index, 1);
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
async function getEnabledProjects() {
    SearchOptions.enabledProjects = await AppStorage.getEnabledProjectsAsync();
}

function saveEnabledProjects() {
    AppStorage.setEnabledProjectsAsync(SearchOptions.enabledProjects);
}

function displayEnabledProjects() {
    let output = "";

    for (const project of SearchOptions.enabledProjects) {
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
    
    const index = SearchOptions.enabledProjects.indexOf(projectId);

    if (index > -1) {
        SearchOptions.enabledProjects.splice(index, 1);
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

    if (SearchOptions.enabledProjects.indexOf(project) > -1) return;

    SearchOptions.enabledProjects.push(project);

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

        if (SearchOptions.enabledProjects.indexOf(key) > -1) continue;

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
export async function showJiraSuggestionsAsync(e) {
    const searchVal = e.target.value;
    if (searchVal.length === 0) {
        jiraService.abortIssueSuggestion();
        setTimeout(() => {
            document.getElementById("issue-suggestion-container").innerHTML = "";
        }, 500);
        return;
    }

    const issues = await jiraService.getIssueSuggestionsAsync(searchVal, true);

    if (issues === false) return;

    const issueCount = () => issues.length;

    if (issueCount() < 3) {
        console.log("fallback 1")
        const altIssues = await jiraService.getIssueSuggestionsAsync(searchVal, false);

        if (altIssues) {
            for (const issue of altIssues) {
                if (issues.findIndex(i => i.key === issue.key) > -1) continue;
        
                issues.push(issue);
            }
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
    setTicketInputValue(issueKey);
    displayIssueSuggestions([]);
}
//#endregion