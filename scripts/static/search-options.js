class SearchOptions {
    static domain = null;
    static urlBase() {
        return `${this.domain}/rest/api/2`;
    }

    static issueTypes = null;
    static statusTypes = null;
    static enabledIssues = null;
    static enabledStatuses = null;
    static enabledProjects = null;
    static assigneeOnly = false;
}

export default SearchOptions;