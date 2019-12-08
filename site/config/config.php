<?php
setlocale(LC_ALL, 'de_DE');

return [
  // config.kulturspektakel.de.php
  'slack.clientId' => '',
  'slack.clientSecret' => '',
  'slack.webhook' => '',

  // config.kult.cash.php
  'contactless.salt' => '',
  'contactless.webhook' => '',

  'algolia' => [
    'app' => '8SGC8OUGMR',
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

  'smartypants' => true,
  'date.handler' => 'strftime',
  'locale' => 'de_DE.utf-8',
  'routes' => [
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
      'ignore' => function () {
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
