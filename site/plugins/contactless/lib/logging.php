<?php
function getColumns() {
  return [
    "id"            => [ "name" => "id",            "type" => "text", "null" => false ],
    "device"        => [ "name" => "device",        "type" => "text", "null" => false ],
    "mode"          => [ "name" => "mode",          "type" => "int",  "null" => false ],
    "time"          => [ "name" => "time",          "type" => "int",  "null" => false ],
    "card"          => [ "name" => "card",          "type" => "text", "null" => false ],
    "value_before"  => [ "name" => "value_before",  "type" => "int",  "null" => false ],
    "tokens_before" => [ "name" => "tokens_before", "type" => "int",  "null" => false ],
    "value_after"   => [ "name" => "value_after",   "type" => "int",  "null" => false ],
    "tokens_after"  => [ "name" => "tokens_after",  "type" => "int",  "null" => false ],
    "bude"          => [ "name" => "bude",          "type" => "text",                 ],
    "info"          => [ "name" => "info",          "type" => "text",                 ],
    // server only
    "server_time"   => [ "name" => "server_time",   "type" => "int",  "null" => false ],
  ];
}

function slackPost() {
  $url = kirby()->option('contactless.webhook');
  $options = [
    'http' => [
      'header'  => "Content-type: application/json\r\n",
      'method'  => 'POST',
      'content' => json_encode(['text' => $device . "," . $message])
    ]
  ];
  $context  = stream_context_create($options);
  $result = file_get_contents($url, false, $context);
}

return [
  'pattern' => '/$$$/log',
  'method'  => 'POST',
  'action'  => function() {
    enforceContactlessDomain($this);
    // ABCDEFG,AA:A3:55,0,1571277103,9A826EAE,571,0,570,0,Frittiererei,250:Fritten::
    $body = file_get_contents('php://input');
    if (!$body) {
      return new Error("no body");
    }
    $message = explode(",", $body);
    $columns = getColumns();
    $db = new Database([
      'type'     => 'sqlite',
      'database' => 'site/plugins/contactless/logs.sqlite',
    ]);

    // create table if not existing
    $tableName = "transactions";
    $db->createTable($tableName, $columns);
    $table = $db->table($tableName);

    $row = array_column(array_map(function($key, $value) {
      return [$key, $value];
    }, array_keys($columns), $message), 1, 0);

    // server fields
    $row['server_time'] = time();

    if ($table->insert($row)) {
      return new Response("ok");
    }
    return new Error("error");
  }
];
