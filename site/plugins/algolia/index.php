<?php

include __DIR__ . '/vendor/autoload.php';

Kirby::plugin('kulturspektakel/algolia', [
  'hooks' => [
    'page.update:after' => function ($newPage, $oldPage) {
      Kirby\Algolia\Search::instance()->updatePage($newPage);
    },
    'page.create:after' => function ($page) {
      Kirby\Algolia\Search::instance()->insertPage($page);
    },
    'page.delete:after' => function ($status, $page) {
      Kirby\Algolia\Search::instance()->deletePage($page);
    }
  ],
]);
