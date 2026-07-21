const CONFIG = {
  googleReviewUrl: "https://maps.app.goo.gl/Zw81ipQoqiswyTjJ6",
  whatsappNumber: "212763300089",
  companyName: "LUME"
};

const screens = [...document.querySelectorAll(".screen")];
const progressDots = [...document.querySelectorAll(".progress-dot")];
const liveRegion = document.querySelector("#live-region");
const toast = document.querySelector("#toast");
const helpForm = document.querySelector("#help-form");
const googleButton = document.querySelector("#open-google");
const helpGoogleLink = document.querySelector("#help-google-link");
let currentScreen = "question";
let toastTimer;

function announce(message) {
  liveRegion.textContent = "";
  window.setTimeout(() => {
    liveRegion.textContent = message;
  }, 40);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

function updateProgress(screenName) {
  const isResult = screenName !== "question";
  progressDots[0]?.classList.add("active");
  progressDots[1]?.classList.toggle("active", isResult);
}

async function showScreen(screenName) {
  if (screenName === currentScreen) return;

  const oldScreen = document.querySelector(`[data-screen="${currentScreen}"]`);
  const nextScreen = document.querySelector(`[data-screen="${screenName}"]`);
  if (!nextScreen) return;

  if (oldScreen) {
    oldScreen.classList.add("leaving");
    await new Promise(resolve => window.setTimeout(resolve, 260));
    oldScreen.hidden = true;
    oldScreen.classList.remove("active", "leaving");
  }

  nextScreen.hidden = false;
  nextScreen.classList.add("active");
  currentScreen = screenName;
  updateProgress(screenName);
  window.scrollTo({ top: 0, behavior: "smooth" });

  const heading = nextScreen.querySelector("h1");
  heading?.setAttribute("tabindex", "-1");
  heading?.focus({ preventScroll: true });

  announce(
    screenName === "satisfied"
      ? "Merci. Vous pouvez maintenant laisser un avis Google."
      : screenName === "help"
        ? "Formulaire de contact LUME affiché."
        : "Question de satisfaction affichée."
  );
}

function saveResponse(response) {
  localStorage.setItem("lume_experience_response", response);
}

function launchConfetti() {
  const container = document.querySelector("#confetti");
  container.innerHTML = "";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return;

  const shades = ["#050505", "#555550", "#a4a49c", "#d7d7d0", "#ffffff"];
  for (let index = 0; index < 52; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = shades[index % shades.length];
    piece.style.setProperty("--duration", `${2.4 + Math.random() * 1.8}s`);
    piece.style.setProperty("--rotation", `${Math.random() * 360}deg`);
    piece.style.setProperty("--drift", `${-90 + Math.random() * 180}px`);
    piece.style.animationDelay = `${Math.random() * .45}s`;
    container.appendChild(piece);
  }

  window.setTimeout(() => {
    container.innerHTML = "";
  }, 4700);
}

function chooseSatisfied() {
  saveResponse("satisfied");
  showScreen("satisfied").then(launchConfetti);
}

function chooseHelp() {
  saveResponse("not_satisfied");
  showScreen("help");
}

function restoreQuestion() {
  showScreen("question");
}

function resetExperience() {
  helpForm.reset();
  clearErrors();
  showScreen("question");
  showToast("Expérience réinitialisée");
}

function openExternalWithDelay(button, url, loadingText) {
  const original = button.innerHTML;
  const newWindow = window.open("about:blank", "_blank");
  button.disabled = true;
  button.textContent = loadingText;

  window.setTimeout(() => {
    if (newWindow) {
      newWindow.opener = null;
      newWindow.location.href = url;
    } else {
      window.location.href = url;
    }

    button.disabled = false;
    button.innerHTML = original;
  }, 520);
}

function openGoogleReview(button = googleButton) {
  if (!CONFIG.googleReviewUrl || CONFIG.googleReviewUrl.includes("PASTE_")) {
    showToast("Le lien Google doit être configuré");
    return;
  }

  openExternalWithDelay(button, CONFIG.googleReviewUrl, "Ouverture…");
}

function normalizePhone(phone) {
  return phone.replace(/[^\d+]/g, "");
}

function isMoroccanPhone(phone) {
  const normalized = normalizePhone(phone);
  return /^(?:0[67]\d{8}|\+?212[67]\d{8})$/.test(normalized);
}

function setFieldError(field, message) {
  const error = document.querySelector(`[data-error-for="${field.id}"]`);
  field.setAttribute("aria-invalid", "true");
  if (error) error.textContent = message;
}

function clearFieldError(field) {
  const error = document.querySelector(`[data-error-for="${field.id}"]`);
  field.removeAttribute("aria-invalid");
  if (error) error.textContent = "";
}

function clearErrors() {
  helpForm.querySelectorAll("[aria-invalid=true]").forEach(clearFieldError);
  helpForm.querySelectorAll(".field-error").forEach(error => {
    error.textContent = "";
  });
}

function validateForm() {
  clearErrors();

  const name = helpForm.elements.name;
  const phone = helpForm.elements.phone;
  const message = helpForm.elements.message;
  const invalid = [];

  if (!name.value.trim()) {
    setFieldError(name, "Veuillez saisir votre nom.");
    invalid.push(name);
  }

  if (!phone.value.trim() || !isMoroccanPhone(phone.value)) {
    setFieldError(phone, "Veuillez saisir un numéro marocain valide.");
    invalid.push(phone);
  }

  if (message.value.trim().length < 10) {
    setFieldError(message, "Veuillez expliquer votre expérience en quelques mots.");
    invalid.push(message);
  }

  if (invalid.length) {
    invalid[0].focus();
    announce("Le formulaire contient des erreurs. Vérifiez les champs indiqués.");
    return false;
  }

  return true;
}

function buildWhatsAppMessage(data) {
  return [
    `Bonjour ${CONFIG.companyName},`,
    "",
    "Je souhaite vous faire part d’un problème concernant mon expérience.",
    "",
    `Nom : ${data.name}`,
    `Téléphone : ${data.phone}`,
    `Moment préféré pour être contacté : ${data.preferredTime || "Non précisé"}`,
    "",
    "Message :",
    data.message,
    "",
    "Merci de me contacter afin que nous puissions trouver une solution."
  ].join("\n");
}

function openWhatsApp(event) {
  event.preventDefault();
  if (!validateForm()) return;

  const formData = new FormData(helpForm);
  const data = {
    name: String(formData.get("name") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    message: String(formData.get("message") || "").trim(),
    preferredTime: String(formData.get("preferredTime") || "Non précisé")
  };

  const whatsappMessage = buildWhatsAppMessage(data);
  const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
  const button = document.querySelector("#open-whatsapp");
  openExternalWithDelay(button, url, "Ouverture de WhatsApp…");
}

async function copyCurrentLink() {
  const url = window.location.href;

  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = url;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  showToast("Lien copié");
}

function bindEvents() {
  document.querySelector("#choose-satisfied").addEventListener("click", chooseSatisfied);
  document.querySelector("#choose-help").addEventListener("click", chooseHelp);
  document.querySelector("#copy-link").addEventListener("click", copyCurrentLink);
  googleButton.addEventListener("click", () => openGoogleReview(googleButton));
  helpForm.addEventListener("submit", openWhatsApp);

  helpGoogleLink.href = CONFIG.googleReviewUrl;
  helpGoogleLink.target = "_blank";
  helpGoogleLink.rel = "noopener noreferrer";

  document.querySelectorAll('[data-action="back"]').forEach(button => {
    button.addEventListener("click", restoreQuestion);
  });

  document.querySelectorAll('[data-action="restart"]').forEach(button => {
    button.addEventListener("click", resetExperience);
  });

  helpForm.querySelectorAll("input, textarea").forEach(field => {
    field.addEventListener("input", () => clearFieldError(field));
  });
}

function init() {
  if (!CONFIG.googleReviewUrl || CONFIG.googleReviewUrl.includes("PASTE_")) {
    console.warn("LUME: configurez CONFIG.googleReviewUrl avant publication.");
  }

  bindEvents();
  updateProgress("question");
}

init();
