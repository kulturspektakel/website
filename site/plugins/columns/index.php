<?php
Kirby::plugin('kirby/columns', [
  'hooks' => [
    'kirbytags:before' => function ($text, array $data = []) {
      $text = preg_replace_callback(
        '!\(columns(…|\.{3})\)(.*?)\((…|\.{3})columns\)!is',
        function ($matches) use ($text, $data) {
          $columns = preg_split('!^\+{4}\s*$!m', $matches[2]);
          $html = [];
          $classItem = $this->option('kirby.columns.item', 'column');
          $classContainer = $this->option('kirby.columns.container', 'columns');

          foreach ($columns as $column) {
            $html[] =
              '<div class="col-xs-'.floor(12/count($columns)).'">' .
              $this->kirbytext($column, $data) .
              '</div>';
          }

          return '<div class="row">' .
            implode($html) .
            '</div>';
        },
        $text
      );

      return $text;
    }
  ]
]);
?>
