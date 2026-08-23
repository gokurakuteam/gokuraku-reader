Blueprint: Manga Website Prototype

Overview

This document outlines the plan for creating a prototype of a manga website based on a user-provided design. The website will feature a modern, dark-themed interface for browsing and reading manga.

Design and Features

General Aesthetics

Theme: Dark theme with a textured background.

Color Palette: A vibrant and energetic color palette will be used for interactive elements, with a base of dark and light colors for the main UI. The accent color is customizable via the Cabinet page.

Typography: Expressive and hierarchical typography will be used to guide the user's attention.

Interactivity: Interactive elements will have "glow" effects and shadows to create a sense of depth.

Layout: The layout will be responsive and adapt to different screen sizes.

Implemented Features

Header: A navigation header with the site logo and links to "Home", "Catalog", and "Cabinet".

Main Page:

A section to support the Armed Forces of Ukraine (ЗСУ).

A large, interactive banner for featured manga.

An "Updates" section showing the latest manga chapters.

Footer: A simple footer with relevant links.

Catalog Page: A page to browse all manga titles with filtering and view options.

Title Page: A detailed page for a single manga, showing its description, genres, and chapter list.

Cabinet Page: A personal account page for users featuring:

Bookmarks: Categorized list of saved manga.

History: List of recently read chapters.

GokuClicker: A mini-game to earn coins and unlock site themes and avatars.

Current Plan

Based on the user's request, a "GokuClicker" game has been added to the Cabinet page.

Clicker Game (js/clicker.js, cabinet.html):

A new tab in the Cabinet for the game.

Users can click on a "Chibik" avatar to earn coins.

Coins can be spent in an in-game shop.

Design Customization (js/clicker.js, css/cabinet.css, storage-manager.js):

Users can buy and equip different accent colors (Themes) for the entire site.

Users can unlock different Chibik avatars (based on manga covers) to use in the clicker.

Theme settings are persisted in localStorage.

Files Updated:

cabinet.html: Added structure for the clicker tab.

css/cabinet.css: Added styles for the game and shop.

js/clicker.js: Implemented game logic and shop functionality.

js/router.js: Integrated clicker initialization.

main.js: Added theme initialization on app load.

storage-manager.js: Added data persistence functions for the game and theme.

This addition gamifies the user experience and allows for personalization of the website's interface.

## Recent Updates

**Material 3 Expressive Redesign (August 2026):**
The Cabinet and Title pages have been completely redesigned to follow the Material 3 Expressive aesthetic. This update introduces:
- **Asymmetric and Unusual Shapes:** Replaced standard pill shapes with asymmetric border-radii for cards, categories, and tags to create a more dynamic and playful interface.
- **Looped Animations:** Added subtle background animations (like slow floating, pulsing glows, and rotating elements) to make the UI feel alive.
- **Enhanced Tonal Surfaces:** Increased the use of soft background colors and state layers for better visual feedback on interactive elements.
- **Deeper Shadows:** Upgraded shadows to be multi-layered and softer, enhancing the perception of depth for covers and prominent UI cards.

**Reader Improvements (August 2026):**
Enhanced the reading experience with new settings and better loading states:
- **Settings Modal:** Added a dedicated settings modal in the reader.
- **Manga/Manhwa Settings:** Users can now change reading direction (Vertical, Horizontal LTR/RTL), image fit (Width, Height, Original), configure image preloading, artificially adjust image brightness, and toggle tap-to-scroll for horizontal modes.
- **Novel Settings:** Added customizable font sizes, line height, font family (serif/sans-serif), and reading themes (Light, Dark, Sepia).
- **Skeleton Loading:** Replaced blank spaces during image loading with dynamic skeleton animations that act as placeholders until pages fully load, preventing layout shifts and providing visual feedback.
- **Data Persistence:** All reader preferences are saved in localStorage and automatically applied on the next visit.

Files updated: `css/main.css`, `css/cabinet.css`, `css/title.css`, `css/home.css`, `cabinet.html`.