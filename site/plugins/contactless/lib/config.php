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

function getDevice($page, $deviceID, $version) {
  if (!$deviceID) {
    return;
  }
  $devices = $page->devices()->toStructure() ?? new Structure([]);
  $device = $devices->find($deviceID);
  $device = new Kirby\Cms\StructureObject([
    "id"      => $deviceID,
    "content" => array_merge(
      $device ? $device->toArray() : [],
      [
        "lastconnected" => date("Y-m-d H:i:s"),
        "version" => $version
      ]
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

function checkForUpdate($currentVersion) {
  $github = kirby()->option('kulturspektakel.contactless.github');
  try {
    $release = json_decode(file_get_contents(
      "https://api.github.com/repos/".$github."/releases/latest",
      false,
      stream_context_create([
            'http' => [
              'method' => 'GET',
              'header' => ['User-Agent: PHP']
            ]
      ])
    ), true);
    $latestVersion = preg_replace("/[^0-9]/", "", $release['name']);
    echo $latestVersion;
    echo $currentVersion;
    if (intval($latestVersion) > intval($currentVersion)) {
      return $release['assets'][0]['browser_download_url'];
    }
  } catch (Exception $e) {}
  return null;
}

return [
  'pattern' => '/$$$/config',
  'action'  => function () {
    enforceContactlessDomain($this);

    $userAgent = [];
    $responseHeaders = [];
    preg_match('/([A-F0-9]{2}:[A-F0-9]{2}:[A-F0-9]{2})\/(\d+)/', $_SERVER['HTTP_USER_AGENT'], $userAgent);
    if (count($userAgent) < 3) {
      return null;
    }
    $deviceID = $userAgent[1];
    $deviceVersion = $userAgent[2];
    $page = getPage();
    $device = getDevice($page, $deviceID, $deviceVersion);
    $update = checkForUpdate($deviceVersion);
    if ($update) {
      $responseHeaders['X-Kult-Update'] = $update;
    }
    return new Response(getProducts($page, $device), "text/plain", 200, $responseHeaders);
  }
];
