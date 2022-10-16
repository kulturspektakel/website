<?php
setlocale(LC_ALL, 'de_DE');

return [
  // config.kulturspektakel.de.php
  'slack.clientId' => '',
  'slack.clientSecret' => '',
  'slack.webhook' => '',

  'algolia' => [
    'app' => '8SGC8OUGMR',
    'api_key'  => '0ff850912266754e00b2561f2a810a4c',
    'index'  => 'kulturspektakel.de',
    'fields' => [
      'url',
      'title',
      'genre',
      'year' => function($page) {
        return $page->parent()->title()->toString();
      },
    ],
    'templates' => [
      'band',
    ]
  ],
  'api' => [
    'basicAuth' => true
  ],
  'smartypants' => true,
  'date.handler' => 'strftime',
  'locale' => 'de_DE.utf-8',
  'routes' => [
    [
      'pattern' => 'duschgel',
      'action'  => function () {
        return go('https://dschungel.kulturspektakel.de', 301);
      }
    ],
    [
      'pattern' => 'dschungel',
      'action'  => function () {
        return go('https://dschungel.kulturspektakel.de', 301);
      }
    ],
    [
      'pattern' => 'archiv',
      'action'  => function () {
        return page('home')->render([
          'archive' => true
        ]);
      }
    ],
    [
      'pattern' => '(:any)',
      'action'  => function($uid) {
        $page = page($uid);
        if(!$page) $page = page('home/' . $uid);
        if(!$page) $page = site()->errorPage();
        return $page;
      }
    ],
  ],
  'cache' => [
    'pages' => [
      'active' => true,
      'ignore' => function ($page) {
        return option('debug');
      }
    ]
  ],
];

function stagenames($shorthand) {
  $shorthand = (string)$shorthand;
  $name = array(
    "GB" => "Große&nbsp;Bühne",
    "KB" => "Kleine&nbsp;Bühne",
    "WB" => "Waldbühne",
    "A"  => "Aula",
    "DJ" => "DJ-Area"
  );
  return $name[$shorthand];
}

function cleanKirbytext($text, $allowedTags = '') {
  return strip_tags(kirbytext($text), $allowedTags);
}
