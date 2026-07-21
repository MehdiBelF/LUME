const CONFIG = {
  googleReviewUrl: "https://maps.app.goo.gl/Zw81ipQoqiswyTjJ6",
  whatsappNumber: "212763300089",
  companyName: "LUME"
};

const questionScreen = document.querySelector('[data-screen="question"]');
const helpScreen = document.querySelector('[data-screen="help"]');
const helpForm = document.querySelector("#help-form");
const helpButton = document.querySelector("#choose-help");
const satisfiedLink = document.querySelector("#choose-satisfied");
const backButton = document.querySelector("#back-button");
const copyButton = document.querySelector("#copy-link");
const stepNumber = document.querySelector("#step-number");
const stepProgress = document.querySelector("#step-progress");
const liveRegion = document.querySelector("#live-region");
const toast = document.querySelector("#toast");
const visualPanel = document.querySelector(".visual-panel");
const lightSculpture = document.querySelector(".light-sculpture");
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

function saveResponse(response) {
  try {
    localStorage.setItem("lume_experience_response", response);
  } catch {
    // The experience remains usable when local storage is unavailable.
  }
}

async function switchScreen(target) {
  const outgoing = target === "help" ? questionScreen : helpScreen;
  const incoming = target === "help" ? helpScreen : questionScreen;

  outgoing.classList.add("leaving");
  await new Promise(resolve => window.setTimeout(resolve, 230));

  outgoing.hidden = true;
  outgoing.classList.remove("active", "leaving");
  incoming.hidden = false;
  incoming.classList.add("active");

  const isHelp = target === "help";
  stepNumber.textContent = isHelp ? "02" : "01";
  stepProgress.style.width = isHelp ? "100%" : "50%";

  window.scrollTo({ top: 0, behavior: "smooth" });

  const focusTarget = isHelp ? helpScreen.querySelector("h1") : questionScreen.querySelector("h1");
  focusTarget.setAttribute("tabindex", "-1");
  focusTarget.focus({ preventScroll: true });

  announce(isHelp ? "Formulaire de contact LUME affiché." : "Question de satisfaction affichée.");
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

  const message = buildWhatsAppMessage(data);
  const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
  const button = document.querySelector("#open-whatsapp");
  const original = button.innerHTML;

  button.disabled = true;
  button.querySelector(".button-copy strong").textContent = "Ouverture de WhatsApp…";
  button.querySelector(".button-copy small").textContent = "Un instant";

  window.setTimeout(() => {
    window.location.href = url;
    button.disabled = false;
    button.innerHTML = original;
  }, 320);
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

function bindParallax() {
  if (!visualPanel || !lightSculpture || window.matchMedia("(pointer: coarse)").matches) return;

  visualPanel.addEventListener("pointermove", event => {
    const rect = visualPanel.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - .5;
    const y = (event.clientY - rect.top) / rect.height - .5;

    lightSculpture.style.transform = `translate(${x * 14}px, ${y * 14}px)`;
  });

  visualPanel.addEventListener("pointerleave", () => {
    lightSculpture.style.transform = "";
  });
}

function init() {
  satisfiedLink.href = CONFIG.googleReviewUrl;

  satisfiedLink.addEventListener("click", () => {
    saveResponse("satisfied");
  });

  helpButton.addEventListener("click", () => {
    saveResponse("not_satisfied");
    switchScreen("help");
  });

  backButton.addEventListener("click", () => {
    clearErrors();
    switchScreen("question");
  });

  copyButton.addEventListener("click", copyCurrentLink);
  helpForm.addEventListener("submit", openWhatsApp);

  helpForm.querySelectorAll("input, textarea").forEach(field => {
    field.addEventListener("input", () => clearFieldError(field));
  });

  bindParallax();
}

init();
