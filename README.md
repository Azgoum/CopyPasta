# CopyPasta

Un utilitaire desktop léger et toujours au premier plan pour sauvegarder vos textes fréquemment utilisés et les copier en un clic.

Construit avec [Tauri v2](https://v2.tauri.app/) et du HTML/CSS/JS vanilla.

## Téléchargement

Rendez-vous sur la page [Releases](../../releases/latest) et téléchargez l'installeur correspondant à votre plateforme :

| Plateforme | Fichier |
|------------|---------|
| Windows | `.msi` ou `.exe` |
| macOS (Apple Silicon) | `.dmg` |
| macOS (Intel) | `.dmg` |
| Linux | `.AppImage` ou `.deb` |

## Fonctionnalités

- **Fenêtre toujours au premier plan** — reste visible pendant que vous travaillez
- **Copie en un clic** — cliquez sur un texte pour le copier dans le presse-papier
- **Modification au clic droit** — modifiez un texte enregistré directement
- **Stockage persistant** — vos textes sont conservés après redémarrage
- **Ajout et suppression** — gestion simple avec confirmation avant suppression
- **Retour visuel** — notification "Copié !" à chaque copie
- **Compact et rapide** — empreinte minimale, démarrage instantané


## Développement

### Prérequis

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/)
- MSVC Build Tools (Windows) / Xcode (macOS) / webkit2gtk (Linux)

### Lancer en local

```bash
npm install
npm run tauri:dev
```

### Compiler

```bash
npm run tauri:build
```

L'installeur sera dans `src-tauri/target/release/bundle/`.

## Auteur

Créé par **Aziz Goumiri**.

Pour toute demande d'outils de productivité ou d'outils personnalisés IA, contactez-moi : [contact@mrautomate.fr](mailto:contact@mrautomate.fr)

## Licence

MIT
