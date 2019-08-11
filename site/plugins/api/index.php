<?php
Kirby::plugin('kulturspektakel/api', [
  'routes' => [
    [
      'pattern' => '/search',
      'action'  => function () {
        if (strlen(get('q')) < 2) {
          return false;
        }
        $results = page('lineup')->search(get('q'), [
          'fields' => ['title'],
          'minlength' => 2,
        ])->limit(10)->map(function ($page) {
          return [
            'name' => $page->title()->value(),
            'year' => $page->parent()->title()->value(),
            'url' => $page->url()
          ];
        });
        return $results->values();
      }
    ],
  ]
]);
?>
