<?php

function enforceContactlessDomain(&$context) {
  if (Url::host() !== 'kult.cash' && Url::host() !== 'localhost') {
    $context->next();
    throw null;
  }
}

Kirby::plugin('kulturspektakel/contactless', [
  'options' => [
    'slug' => 'contactless'
  ],
  'routes' => [
    require_once __DIR__ . '/lib/landing.php',
    require_once __DIR__ . '/lib/config.php',
    require_once __DIR__ . '/lib/logging.php',
    require_once __DIR__ . '/lib/card.php',
    require_once __DIR__ . '/lib/robots.php',
  ],
  'snippets' => [
    'card' => __DIR__ . '/templates/card.php'
  ],
  'blueprints' => [
    'pages/contactless' => __DIR__ . '/templates/contactless.yml'
  ]
]);
