const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".main-nav");
const filterButtons = document.querySelectorAll(".filter-btn");
const themeButtons = document.querySelectorAll(".theme-btn");
const listingCards = document.querySelectorAll(".listing-card");
const form = document.querySelector("#contact-form");
const formMessage = document.querySelector("#form-message");
const yearEl = document.querySelector("#year");
const THEME_KEY = "sun-sand-theme";

if (menuToggle && nav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

const setTheme = (theme) => {
  const normalizedTheme = theme || "coastal";
  document.body.dataset.theme = normalizedTheme;
  themeButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.theme === normalizedTheme);
  });
};

const savedTheme = localStorage.getItem(THEME_KEY) || "coastal";
setTheme(savedTheme);

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const selectedTheme = button.dataset.theme || "coastal";
    setTheme(selectedTheme);
    localStorage.setItem(THEME_KEY, selectedTheme);
  });
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const selectedType = button.dataset.type || "all";

    filterButtons.forEach((btn) => btn.classList.remove("is-active"));
    button.classList.add("is-active");

    listingCards.forEach((card) => {
      const cardType = card.getAttribute("data-type");
      const shouldShow = selectedType === "all" || selectedType === cardType;
      card.style.display = shouldShow ? "" : "none";
    });
  });
});

if (form && formMessage) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    formMessage.textContent =
      "Thanks! We received your inquiry and will contact you shortly.";
    form.reset();
  });
}

if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}
