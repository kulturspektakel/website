<?php


return [
  'pattern' => '/\$\$\$/([0-9A-F]{8})/([0-9]{4})([0-9])([0-9a-f]+)',
  'action'  => function ($cardID, $value, $tokens, $signature) {
    enforceContactlessDomain($this);

    $value = intval($value);
    $salt = kirby()->option('contactless.salt');

    if (substr(sha1($value . $tokens . $cardID . $salt), 0, 10) !== $signature) {
      return false;
    }
    
    setlocale(LC_MONETARY, 'de_DE');
    return new Response(snippet('card', [
      "value" => $value,
      "tokens" => $tokens,
    ]));
  }
];
