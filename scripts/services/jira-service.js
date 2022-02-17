import SearchOptions from "../static/search-options.js";
import AppStorage from "../utils/app-storage.js";
import HttpClient from "./http-client.js";

class JiraService {
    #httpClient;
    #abortController;

    async refreshClientAsync() {
        const auth = await AppStorage.getAtlassianAuthAsync();
        SearchOptions.domain = await AppStorage.getAtlassianDomainAsync();
        this.#httpClient = new HttpClient(SearchOptions.urlBase(), auth);
    }

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
        if (!this.#httpClient) {
           await this.refreshClientAsync();
        }

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
        if (!this.#httpClient) {
           await this.refreshClientAsync();
        }

        const issues = [];
        for (const projectKey of SearchOptions.enabledProjects) {
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
        if (!this.#httpClient) {
           await this.refreshClientAsync();
        }

        var statuses = await this.#httpClient.getAsync("statuscategory");
        statuses.sort((a, b) => (a.name > b.name) ? 1 : ((a.name < b.name) ? -1 : 0))

        return statuses;
    }

    async getProjectSuggestionsAsync(projectName) {
        if (!this.#httpClient) {
            await this.refreshClientAsync();
         }
        
         
        const queryParams = {
            query: projectName
        };

        return (await this.#httpClient.getAsync("project/search", queryParams)).values;
    }

    async #getProjectStatusTypesAsync(projectKey) {
        if (!this.#httpClient) {
            await this.refreshClientAsync();
         }
        
         
        try {
            return (await this.#httpClient.getAsync(`project/${projectKey}/statuses`)).issueTypes;
        } catch(e) {
            return [];
        }
    }

    async #getProjectIssueTypesAsync(projectKey) {
        if (!this.#httpClient) {
            await this.refreshClientAsync();
         }
        
         
        try {
            return (await this.#httpClient.getAsync(`project/${projectKey}`)).issueTypes;
        } catch(e) {
            return [];
        }
    }

    async getIssueSuggestionsAsync(str) {
        if (!this.#httpClient) {
            await this.refreshClientAsync();
         }
        
         
        // this.#abortController?.abort();
        this.#abortController = new AbortController();
        const { signal } = this.#abortController;

        str = str.replace(/[^A-Za-z0-9\-]/g, " ");

        let JQL = "";
        const queryParams = {
            query: `${str}`,
            showSubTasks: false
        };

        const checkAnd = () => { if (JQL.length > 0) JQL += " AND "; };

        //#region Option Params
        if (SearchOptions.assigneeOnly) {
            checkAnd();
            JQL += "assignee=currentUser()"
        }

        if (SearchOptions.useActiveSprint) {
            checkAnd();
            JQL += "sprint IN openSprints()"
        }

        if (SearchOptions.enabledIssues.length > 0) {
            checkAnd();
            const issueStr = SearchOptions.enabledIssues.join(", ");
            JQL += `issueType IN (${issueStr})`
        }

        if (SearchOptions.enabledProjects.length > 0) {
            checkAnd();
            const projectStr = SearchOptions.enabledProjects.join(", ");
            JQL += `project IN (${projectStr})`
        }

        if (SearchOptions.enabledStatuses.length > 0) {
            checkAnd();
            const statusStr = SearchOptions.enabledStatuses.join(", ");
            JQL += `statusCategory IN (${statusStr})`
        }

        if (JQL.length > 0) {
            queryParams.currentJQL = JQL;
        }
        //#endregion

        const res = (await this.#httpClient.getAsync("issue/picker", queryParams, signal))
        
        if (res === false) return false;

        const response = res.sections;
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
        if (!this.#httpClient) {
            await this.refreshClientAsync();
         }
         
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

export default new JiraService();