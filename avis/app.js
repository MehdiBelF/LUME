const CONFIG = {
  googleReviewUrl: "https://maps.app.goo.gl/Zw81ipQoqiswyTjJ6",
  whatsappNumber: "212763300089",
  companyName: "LUME"
};

const STORAGE_KEY = "lume_experience_response";
const SCREEN_NAMES = {
  question: "question",
  satisfied: "satisfied",
  notSatisfied: "not-satisfied"
};

const state = {
  currentScreen: SCREEN_NAMES.question,
  previousScreen: null,
  copyTimer: null
};

const selectors = {
  screens: "[data-screen]",
  liveRegion: "#live-region",
  copyFeedback: "#copy-feedback",
  feedbackForm: "#feedback-form",
  googleLink: ".secondary-google-link"
};

document.addEventListener("DOMContentLoaded", initExperience);

function initExperience() {
  bindActions();
  showScreen(SCREEN_NAMES.question);
  updateConfiguredLinks();
}

function bindActions() {
  document.addEventListener("click", (event) => {
    const actionElement = event.target.closest("[data-action]");

    if (!actionElement) {
      return;
    }

    const action = actionElement.dataset.action;

    if (action === "satisfied") {
      saveResponse("satisfied");
      showScreen(SCREEN_NAMES.satisfied);
    }

    if (action === "not-satisfied") {
      saveResponse("not_satisfied");
      showScreen(SCREEN_NAMES.notSatisfied);
    }

    if (action === "open-google") {
      openGoogleReview(actionElement);
    }

    if (action === "copy-link") {
      copyCurrentLink();
    }

    if (action === "back") {
      showScreen(state.previousScreen || SCREEN_NAMES.question);
    }

    if (action === "reset") {
      resetExperience();
    }
  });

  const form = document.querySelector(selectors.feedbackForm);

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const validation = validateForm(form);

      if (!validation.isValid) {
        setLiveMessage("Veuillez vérifier les champs indiqués.");
        validation.firstInvalidField.focus();
        return;
      }

      openWhatsApp(form.querySelector('button[type="submit"]'), validation.data);
    });

    form.addEventListener("input", (event) => {
      if (event.target.matches("input, textarea, select")) {
        clearFieldError(event.target);
      }
    });

    form.addEventListener("change", (event) => {
      if (event.target.matches("input, textarea, select")) {
        clearFieldError(event.target);
      }
    });
  }
}

function updateConfiguredLinks() {
  document.querySelectorAll(selectors.googleLink).forEach((link) => {
    link.href = CONFIG.googleReviewUrl;
  });
}

function showScreen(screenName) {
  const targetScreen = document.querySelector(`[data-screen="${screenName}"]`);

  if (!targetScreen) {
    return;
  }

  document.querySelectorAll(selectors.screens).forEach((screen) => {
    const isTarget = screen === targetScreen;
    screen.hidden = !isTarget;
    screen.classList.toggle("is-active", isTarget);
    screen.setAttribute("aria-hidden", String(!isTarget));
  });

  if (screenName !== state.currentScreen) {
    state.previousScreen = state.currentScreen;
  }

  state.currentScreen = screenName;
  clearCopyFeedback();
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

function saveResponse(response) {
  try {
    localStorage.setItem(STORAGE_KEY, response);
  } catch (error) {
    setLiveMessage("Votre choix est pris en compte pour cette session.");
  }
}

async function openGoogleReview(button) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Ouverture…";

  await wait(500);
  window.open(CONFIG.googleReviewUrl, "_blank", "noopener,noreferrer");

  button.disabled = false;
  button.textContent = originalText;
}

function validateForm(form) {
  const formData = new FormData(form);
  const data = {
    name: String(formData.get("name") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    message: String(formData.get("message") || "").trim(),
    preferredTime: String(formData.get("preferredTime") || "").trim()
  };

  const errors = {};

  if (!data.name) {
    errors.name = "Veuillez saisir votre nom.";
  }

  if (!isValidMoroccanPhone(data.phone)) {
    errors.phone = "Veuillez saisir un numéro de téléphone valide.";
  }

  if (!data.message || data.message.length < 10) {
    errors.message = "Veuillez expliquer votre expérience.";
  }

  clearFormErrors(form);

  Object.entries(errors).forEach(([fieldName, message]) => {
    const field = form.elements[fieldName];
    setFieldError(field, message);
  });

  const firstInvalidField = Object.keys(errors).length ? form.elements[Object.keys(errors)[0]] : null;

  return {
    isValid: Object.keys(errors).length === 0,
    firstInvalidField,
    data
  };
}

function buildWhatsAppMessage(data) {
  const preferredTime = data.preferredTime || "Non précisé";

  return `Bonjour ${CONFIG.companyName},

Je souhaite vous faire part d’un problème concernant mon expérience.

Nom : ${data.name}
Téléphone : ${data.phone}
Moment préféré pour être contacté : ${preferredTime}

Message :
${data.message}

Merci de me contacter afin que nous puissions trouver une solution.`;
}

async function openWhatsApp(button, data) {
  const originalText = button.textContent;
  const message = buildWhatsAppMessage(data);
  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodedMessage}`;

  button.disabled = true;
  button.textContent = "Ouverture de WhatsApp…";

  await wait(500);
  const opened = window.open(url, "_blank", "noopener,noreferrer");

  if (!opened) {
    window.location.href = url;
  }

  button.disabled = false;
  button.textContent = originalText;
}

async function copyCurrentLink() {
  const url = window.location.href;
  let copied = false;

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch (error) {
      copied = false;
    }
  }

  if (!copied) {
    copied = copyWithFallback(url);
  }

  showCopyFeedback(copied ? "Lien copié" : "Impossible de copier le lien");
  setLiveMessage(copied ? "Lien copié" : "Impossible de copier le lien");
}

function resetExperience() {
  const form = document.querySelector(selectors.feedbackForm);

  if (form) {
    form.reset();
    clearFormErrors(form);
  }

  clearCopyFeedback();
  setLiveMessage("Retour à la question principale.");
  showScreen(SCREEN_NAMES.question);
}

function isValidMoroccanPhone(phone) {
  const normalized = phone.replace(/[\s\-().]/g, "");
  return /^0[67]\d{8}$/.test(normalized) || /^\+?212[67]\d{8}$/.test(normalized);
}

function setFieldError(field, message) {
  if (!field) {
    return;
  }

  const errorElement = document.getElementById(`${field.id}-error`);
  field.setAttribute("aria-invalid", "true");
  field.setAttribute("aria-describedby", errorElement ? errorElement.id : "");

  if (errorElement) {
    errorElement.textContent = message;
  }
}

function clearFieldError(field) {
  if (!field) {
    return;
  }

  const errorElement = document.getElementById(`${field.id}-error`);
  field.removeAttribute("aria-invalid");
  field.removeAttribute("aria-describedby");

  if (errorElement) {
    errorElement.textContent = "";
  }
}

function clearFormErrors(form) {
  Array.from(form.elements).forEach((field) => {
    if (field.matches && field.matches("input, textarea, select")) {
      clearFieldError(field);
    }
  });
}

function setLiveMessage(message) {
  const liveRegion = document.querySelector(selectors.liveRegion);

  if (liveRegion) {
    liveRegion.textContent = message;
  }
}

function showCopyFeedback(message) {
  const feedback = document.querySelector(selectors.copyFeedback);

  if (!feedback) {
    return;
  }

  feedback.textContent = message;
  feedback.setAttribute("aria-hidden", "false");
  window.clearTimeout(state.copyTimer);
  state.copyTimer = window.setTimeout(clearCopyFeedback, 2200);
}

function clearCopyFeedback() {
  const feedback = document.querySelector(selectors.copyFeedback);

  if (!feedback) {
    return;
  }

  feedback.textContent = "";
  feedback.setAttribute("aria-hidden", "true");
}

function copyWithFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch (error) {
    copied = false;
  }

  document.body.removeChild(textarea);
  return copied;
}

function wait(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
