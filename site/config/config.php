<?php

return [
  'debug' => true,
  'smartypants' => true,
  'date.handler' => 'strftime',
  'locale' => 'de_DE.utf-8',
  'slack.clientId' => '',
  'slack.clientSecret' => '',
  'slack.webhook' => '',
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
