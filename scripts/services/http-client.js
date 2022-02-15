import AppStorage from "../utils/app-storage.js";

class HttpClient {
    #requestOptions;
    #headers;
    #urlBase;

    constructor(urlBase, basicAuth) {
        var myHeaders = new Headers();
        myHeaders.append("Authorization", basicAuth);
        myHeaders.append("Content-Type", "application/json");
        
        this.#headers = myHeaders;

        this.#urlBase = urlBase;

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
        console.log(this.#urlBase);
        const url = new URL(`${this.#urlBase}/${path}`);

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
        const url = new URL(`${this.#urlBase ?? await AppStorage.getAtlassianDomainAsync()}/${path}`);
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

export default HttpClient;