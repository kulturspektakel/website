# Kulturspektakel.de

Die Kulturspektakel.de-Seite verwendet das CMS [Kirby 2](http://getkirby.com). Das Repository enthält nur den Code (PHP und Frontend), ohne Inhalte. Außerdem werden Benutzeraccounts (`/site/accounts`) nicht mit commitet.

Die beiden Branches `staging` und `deploy` werden per post-commit-hook direkt auf dem Server gepullt und stehen dann sofort unter [kulturspektakel.de](kulturspektakel.de) und [staging.kulturspektakel.de](staging.kulturspektakel.de) zur Verfügung. Beide Branches verwenden den selben Content-Ordner auf dem Server (Änderungen der Inhalte auf dem staging-Server werden auch direkt auf der live-Version übernommen).

## CSS, JS, Fonts und Grafiken
Für die Verwendung von 3rd-party-CSS/JS-Komponenten wird [bower](http://bower.io) verwendet. Die Komponenten liegen dann im `bower_components`-Verzeichnis und werden direkt von dort eingebunden.

Selbst entwickeltes CSS/JS und Grafiken werden im Ordner `assets` abgelegt.

