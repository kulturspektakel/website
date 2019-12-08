<?php

include __DIR__ . '/vendor/autoload.php';

Kirby::plugin('kulturspektakel/algolia', [
  'hooks' => [
    'page.update:after' => function ($page) {
      Kirby\Algolia\Search::instance()->updatePage($page);
    },
    'page.create:after' => function ($page) {
      Kirby\Algolia\Search::instance()->insertPage($page);
    },
    'page.delete:after' => function ($page) {
      Kirby\Algolia\Search::instance()->deletePage($page);
    }
  ],
]);

echo '<pre>';
print_r(kirby()->options());
