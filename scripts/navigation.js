window.addEventListener("load", async () => {
  subscribeToNavEvents();
});

function subscribeToNavEvents() {
  const navButtons = document.getElementsByClassName("nav-button");

  for (const button of navButtons) {
    button.addEventListener("click", navigate);
  }
}

function navigate(e) {
  var pageName = e.target.innerText.toLowerCase();

  // Update active tab
  var navButtons = document.getElementsByClassName("nav-button");
  for (const button of navButtons) {
    button.classList.remove("active");
  }
  e.target.classList.add("active");

  // Show/hide pages
  var pages = document.getElementsByClassName("page");

  for (const page of pages) {
    page.classList.add("hide");

    if (page.classList.contains(pageName)) {
      page.classList.remove("hide");
    }
  }
}

