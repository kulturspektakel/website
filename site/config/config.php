<?php
/**
 * The config file is optional. It accepts a return array with config options
 * Note: Never include more than one return statement, all options go within this single return array
 * In this example, we set debugging to true, so that errors are displayed onscreen.
 * This setting must be set to false in production.
 * All config options: https://getkirby.com/docs/reference/system/options
 */

return [
  'debug' => true,
  'smartypants' => true,
  
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
      'pattern' => 'home/(:any)',
      'action'  => function($uid) {
        return page($uid);
      }
    ]
  ]
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
