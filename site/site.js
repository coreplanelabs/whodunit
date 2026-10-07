const button = document.getElementById("copy");
button.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(
      document.getElementById("command").textContent,
    );
    document.getElementById("copy-label").textContent = "Copied";
    setTimeout(() => {
      document.getElementById("copy-label").textContent = "Copy";
    }, 1800);
  } catch {
    document.getElementById("copy-label").textContent = "Select to copy";
  }
});

const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
let preference = "system";
try {
  const stored = localStorage.getItem("repo-arcade-theme");
  if (["light", "dark", "system"].includes(stored)) preference = stored;
} catch {
  /* Storage is optional. */
}
function applyTheme() {
  document.documentElement.dataset.theme =
    preference === "system"
      ? systemTheme.matches
        ? "dark"
        : "light"
      : preference;
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.themeChoice === preference),
    );
  });
}
document.querySelectorAll("[data-theme-choice]").forEach((button) => {
  button.addEventListener("click", () => {
    preference = button.dataset.themeChoice;
    try {
      localStorage.setItem("repo-arcade-theme", preference);
    } catch {
      /* Keep the choice for this page. */
    }
    applyTheme();
  });
});
systemTheme.addEventListener("change", applyTheme);
applyTheme();
