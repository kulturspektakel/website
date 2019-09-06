<?php
Kirby::plugin('kulturspektakel/contactless', [
  'routes' => [
    [
      'pattern' => '/contactless',
      'action'  => function () {
        $results = site()->devices()->toStructure()->map(function ($device) {
          $products = site()->buden()->toStructure()->findBy(
            'name',
            $device->bude()->toString(),
          )->products();
          return [
            'device' => $device->id(),
            'products' => $products->value()
          ];
        });
        return $results->values();
      }
    ],
  ]
]);
?>
