# Kulturspektakel.de

Die Kulturspektakel.de-Seite verwendet das CMS [Kirby 2](http://getkirby.com). Das Repository enthält nur den Code (PHP und Frontend), ohne Inhalte. Außerdem werden Benutzeraccounts (`/site/accounts`) nicht mit commitet.

Der Branch `deploy` wird per post-commit-hook direkt auf dem Server gepullt und stehen dann sofort unter [kulturspektakel.de](kulturspektakel.de) zur Verfügung.

## CSS, JS, Fonts und Grafiken
Für die Verwendung von 3rd-party-CSS/JS-Komponenten wird [bower](http://bower.io) verwendet. Die Komponenten liegen dann im `bower_components`-Verzeichnis und werden direkt von dort eingebunden. Zur Zeit werden alle Bower-Komponenten mit commitet.

Selbst entwickeltes CSS/JS und Grafiken werden im Ordner `assets` abgelegt.
