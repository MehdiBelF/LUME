# LUME | Votre expérience

Cette application est une page statique GitHub Pages destinée à recueillir le retour d’expérience des clients LUME.

## Points clés

1. L’application est entièrement statique et compatible avec GitHub Pages.
2. Elle ne nécessite pas Node.js.
3. Elle ne nécessite pas npm.
4. Elle ne nécessite pas de base de données.
5. Elle n’utilise pas l’API Meta WhatsApp.
6. Elle n’envoie aucun message automatiquement.
7. Le bouton WhatsApp ouvre simplement une conversation préremplie avec LUME.
8. Le numéro WhatsApp configuré est : `212763300089`.
9. L’URL Google configurée est : `https://maps.app.goo.gl/Zw81ipQoqiswyTjJ6`.
10. L’URL publique attendue est : `https://mehdibelf.github.io/LUME/avis/`.
11. Les données du formulaire ne sont pas stockées par la page.
12. Seul le choix de satisfaction est stocké localement dans `lume_experience_response`.
13. Les visiteurs satisfaits sont dirigés directement vers le lien Google, et les visiteurs non satisfaits gardent aussi accès au lien Google.
14. Pour changer le numéro WhatsApp, modifier `whatsappNumber` dans `app.js`.
15. Pour changer l’URL Google, modifier `googleReviewUrl` dans `app.js`.
16. Pour tester localement, ouvrir `avis/index.html` dans un navigateur.
17. Pour publier, pousser le dossier `avis/` sur la branche utilisée par GitHub Pages, puis ouvrir `https://mehdibelf.github.io/LUME/avis/`.

## Configuration

La configuration principale se trouve en haut de `app.js` :

```js
const CONFIG = {
  googleReviewUrl: "https://maps.app.goo.gl/Zw81ipQoqiswyTjJ6",
  whatsappNumber: "212763300089",
  companyName: "LUME"
};
```

Le numéro WhatsApp doit rester au format international sans `+`, espaces ni tirets.
