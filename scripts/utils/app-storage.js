class AppStorage {
    static getMinutesToRemindAsync = async () => {
        const minutesToRemind = await this.#getItemAsync("minutesToRemind");

        if (!minutesToRemind) {
            return 60;
        }

        return Number(minutesToRemind);
     }
 
     static setMinutesToRemindAsync = async (minutes) => {
         return await this.#setItemAsync("minutesToRemind", minutes)
     }

    static getAssigneeOnlyAsync = async () => {
       return await this.#getItemAsync("assigneeOnly");
    }

    static setAssigneeOnlyAsync = async (assigneeOnly) => {
        return await this.#setItemAsync("assigneeOnly", assigneeOnly)
    }

    static getEnabledProjectsAsync = async () => {
        const vals = await this.#getItemAsync("enabledProjects")

        if (!vals) return [];
        return vals;
    }

    static setEnabledProjectsAsync = async (projectArr) => {
        return await this.#setItemAsync("enabledProjects", projectArr)
    }

    static getEnabledStatusesAsync = async () => {
        const vals = await this.#getItemAsync("enabledStatuses")

        if (!vals) return [];
        return vals;
    }

    static setEnabledStatusesAsync = async (statusArr) => {
        return await this.#setItemAsync("enabledStatuses", statusArr)
    }

    static getEnabledIssuesAsync = async () => {
        const vals = await this.#getItemAsync("enabledIssues")

        if (!vals) return [];
        return vals;
    }

    static setEnabledIssuesAsync = async (issueArr) => {
        return await this.#setItemAsync("enabledIssues", issueArr)
    }

    static setAtlassianAuthAsync = async (authStr) => {
        return await this.#setItemAsync("basicAuth", authStr);
    }

    static getAtlassianAuthAsync = async () => {
        const val = await this.#getItemAsync("basicAuth");

        if (!val) return "";
        return val;
    }

    static setAtlassianDomainAsync = async (url) => {
        let isComplete = false;
        // Remove any forward slashes at the end of the url
        while (!isComplete) {
            console.log()
            const length = url.length;
            if (length === 0) {
                isComplete = true;
            }

            const lastIndex = url.lastIndexOf("/");
            
            if (lastIndex === (length - 1)) {
                url = url.substring(0, lastIndex);
            } else {
                isComplete = true;
            }
        }

        return await this.#setItemAsync("domain", url);
    }

    static getAtlassianDomainAsync = async () => {
        const val = await this.#getItemAsync("domain");

        if (!val) return "";
        return val;
    }

    //#region Private Methods
    static #getItemAsync = async (key) => {
        const result = await chrome.storage.sync.get(key);

        const val = result[`${key}`];
        if (val) {
            return JSON.parse(val);
        }

        return false;
    }

    static #setItemAsync = async (key, value) => {
        const object = {}
        object[key] = JSON.stringify(value);

        await chrome.storage.sync.set(object);
    }
    //#endregion
}

export default AppStorage;