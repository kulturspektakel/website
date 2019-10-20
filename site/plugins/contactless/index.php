<?php

function getProducts($device) {
  if (!$device) {
    return;
  }
  $map = site()->devices()->toStructure()->find($device);
  if (!$map || !$map->bude()) {
    return;
  }
  $products = site()->buden()->toStructure()->findBy(
    'name',
    $map->bude()->toString()
  )->products()->value();

  if (count($products) == 0) {
    return;
  }

  return join("\n", array_map(function($p) {
    $name = iconv('UTF-8', 'ASCII//TRANSLIT', $p['name']);
    return "" . ($p['price'] * 100) . "," . $name;
  }, $products));
}

function getColumns($tableName) {
  switch ($tableName) {
    case 'charge':
      return [
        "id"            => [ "name" => "id",            "type" => "text", "null" => false ],
        "device"        => [ "name" => "device",        "type" => "text", "null" => false ],
        "time"          => [ "name" => "time",          "type" => "int",  "null" => false ],
        "card"          => [ "name" => "card",          "type" => "text", "null" => false ],
        "value_before"  => [ "name" => "value_before",  "type" => "int",  "null" => false ],
        "tokens_before" => [ "name" => "tokens_before", "type" => "int",  "null" => false ],
        "value_after"   => [ "name" => "value_after",   "type" => "int",  "null" => false ],
        "tokens_after"  => [ "name" => "tokens_after",  "type" => "int",  "null" => false ],
        "cart"          => [ "name" => "cart",          "type" => "text",                 ],
      ];
      break;
  }
}

Kirby::plugin('kulturspektakel/contactless', [
  'routes' => [
    [
      'pattern' => '/contactless/api/config',
      'action'  => function () {
        date_default_timezone_set('Europe/Berlin');
        $response = date("dmHi")."\n";
        $response .= getProducts($_SERVER['HTTP_USER_AGENT']);
        return new Response($response);
      }
    ],
    [
      'pattern' => '/contactless/api/(charge)',
      'method'  => 'POST',
      'action'  => function($tableName) {
        //"_ABCDEF,AA:A3:55,1571277103,9A826EAE,571,0,570,0,"
        $body = file_get_contents('php://input');
        if (!$body) {
          return new Error("no body");
        }
        $message = explode(",", $body);
        $columns = getColumns($tableName);
        $db = new Database([
          'type'     => 'sqlite',
          'database' => 'site/plugins/contactless/logs.sqlite',
        ]);

        // create table if not existing
        $db->createTable($tableName, $columns);
        $table = $db->table($tableName);

        $row = array_column(array_map(function($key, $value) {
          return [$key, $value];
        }, array_keys($columns), $message), 1, 0);

        if ($table->insert($row)) {
          return new Response("ok");
        }
        return new Error("error");
      }
    ],
  ]
]);
?>
