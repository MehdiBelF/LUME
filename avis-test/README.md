# LUME — Test animé d’expérience client

Application statique mobile-first pour tester le parcours client LUME.

## Lien public

https://mehdibelf.github.io/LUME/avis-test/

## Fonctionnalités

- Question **Satisfait(e) / Pas satisfait(e)**.
- Animations premium inspirées de la lumière.
- Confettis sobres après une réponse positive.
- Redirection vers Google Maps pour laisser un avis.
- Formulaire de retour négatif ouvrant WhatsApp avec un message prérempli.
- Validation des numéros marocains.
- Bouton pour copier le lien.
- Responsive iPhone, Android, tablette et ordinateur.
- Respect de `prefers-reduced-motion`.

## Configuration

Les réglages se trouvent au début de `app.js` :

```js
const CONFIG = {
  googleReviewUrl: "https://maps.app.goo.gl/Zw81ipQoqiswyTjJ6",
  whatsappNumber: "212763300089",
  companyName: "LUME"
};
```

Le numéro WhatsApp doit être écrit sans `+`, espaces ou tirets.

## Données

Cette version est entièrement statique :

- aucun serveur ;
- aucune base de données ;
- aucune API Meta ;
- aucune donnée du formulaire n’est stockée ;
- seule la dernière réponse de satisfaction est enregistrée dans `localStorage` pour le test local.

Le bouton WhatsApp ouvre une conversation préremplie avec LUME. Le visiteur doit encore appuyer sur **Envoyer** dans WhatsApp.
