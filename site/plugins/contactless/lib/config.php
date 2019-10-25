<?php

function getBude($device) {
  if (!$device) {
    return;
  }
  $map = site()->devices()->toStructure()->find($device);
  if (!$map || !$map->bude()) {
    return;
  }

  return site()->buden()->toStructure()->findBy(
    'name',
    $map->bude()->toString(),
  );
}

function getProducts($device) {
  $bude = getBude($device);
  if (!$bude) {
    return;
  }
  $products = $bude->products()->value();
  if (count($products) == 0) {
    return;
  }

  return join("\n", array_map(function($p) {
    $name = iconv('UTF-8', 'ASCII//TRANSLIT', $p['name']);
    return "" . ($p['price'] * 100) . "," . $name;
  }, $products));
}

return [
  'pattern' => '/$$$/config',
  'action'  => function () {
    enforceContactlessDomain($this);
    date_default_timezone_set('Europe/Berlin');
    $response = date("dmHi") . "\n" . getProducts($_SERVER['HTTP_USER_AGENT']);
    return new Response($response, "text/plain");
  }
];
