<?php

function getPage() {
  $slug = kirby()->option('kulturspektakel.contactless.slug');
  $page = page($slug);
  if ($page) {
    return $page;
  }
  kirby()->impersonate('kirby');
  return Page::create([
    "slug"     => $slug,
    "template" => "contactless",
    "draft"    => false
  ]);
}

function getDevice($page, $deviceID) {
  if (!$deviceID) {
    return;
  }
  $devices = $page->devices()->toStructure() ?? new Structure([]);
  $device = $devices->find($deviceID);
  $device = new Kirby\Cms\StructureObject([
    "id"      => $deviceID,
    "content" => array_merge(
      $device ? $device->toArray() : [],
      ["lastconnected" => date("Y-m-d H:i:s")]
    )
  ]);
  kirby()->impersonate('kirby');
  $page->update(['Devices' => Yaml::encode($devices->add($device)->toArray())]);
  return $device;
}

function getBude($page, $device) {
  if (!$device || !$device->bude()) {
    return;
  }
  return $page->buden()->toStructure()->findBy(
    'name',
    $device->bude()->toString()
  );
}

function getProducts($page, $deviceID) {
  $bude = getBude($page, $deviceID);
  if (!$bude) {
    return;
  }

  $response = "";
  $products = $bude->products()->value();
  if (count($products) > 0) {
    $response = join("\n", array_map(function($p) {
      $name = iconv('UTF-8', 'ASCII//TRANSLIT', $p['name']);
      return "" . ($p['price'] * 100) . "," . $name;
    }, $products));
  }

  $budenname = iconv('UTF-8', 'ASCII//TRANSLIT', $bude->name());
  return join("\n", [crc32($response), $budenname, $response]);
}

return [
  'pattern' => '/$$$/config',
  'action'  => function () {
    enforceContactlessDomain($this);
    $deviceID = $_SERVER['HTTP_USER_AGENT'];
    $page = getPage();
    $device = getDevice($page, $deviceID);
    return new Response(getProducts($page, $device), "text/plain");
  }
];
