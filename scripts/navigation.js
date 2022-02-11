window.addEventListener('load', async () => {
    subscribeToNavEvents();
});

function subscribeToNavEvents() {
    const navButtons = document.getElementsByClassName('nav-button');

    for (const button of navButtons) {
        button.addEventListener('click', navigate)
    }
}

function navigate(e) {
    var pageName = e.target.innerText.toLowerCase();

    var pages = document.getElementsByClassName("page")
    
    for (const page of pages) {
        page.classList.add("hide");

        if (page.classList.contains(pageName)) {
            page.classList.remove("hide");
        }
    }
}