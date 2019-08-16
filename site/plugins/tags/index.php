<?php

require __DIR__ . '/vendor/autoload.php';

Kirby::plugin('kulturspektakel/tags', [
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
  ],
  'tags' => [
    'honeycomb' => [
      'html' => function($tag) {
        return '<div class="honeycomb">
            <img src="'.$tag->parent()->image($tag->attr('honeycomb'))->thumb(['width' => 200,'height' => 200, 'crop' => true])->url().'" />
          </div>
        ';
      }
    ],
    'banner' => [
      'html' => function($tag) {
        if ($tag->parent()->image($tag->attr('banner'))) {
          return '</section><section class="banner photo" style="background-image: url('.$tag->parent()->image($tag->attr('banner'))->url().')"></section><section class="container subpage">';
        } else {
          return snippet($tag->attr('banner'));
        }
      }
    ],
    'calendar' => [
      'html' => function($tag) {
        $ical = new ICal\ICal($tag->attr('calendar'), array(
          'defaultSpan'           => 2,
          'defaultWeekStart'      => 'MO',
          'skipRecurrence'        => false,
          'useTimeZoneWithRRules' => false,
        ));
        $events = $ical->eventsFromInterval('50 weeks');
        $res = "<ul class='ics-calendar'>";
        foreach ($events as $event) {
          $dtstart = new \DateTime('@' . (int) $ical->iCalDateToUnixTimestamp($event->dtstart));
          $dtend = new \DateTime('@' . (int) ($ical->iCalDateToUnixTimestamp($event->dtend)-1));
          $target_timezone = new DateTimeZone('Europe/Berlin');
          $dtstart->setTimeZone($target_timezone);
          $dtend->setTimeZone($target_timezone);

          if ($dtstart->format('d.m.Y') != $dtend->format('d.m.Y')) {
            $time = ($ical->iCalDateToUnixTimestamp($event->dtstart)%86400 === 0) ? $dtstart->format('d.m.') : $dtstart->format('d.m.');
            $time .= ' bis '.(($ical->iCalDateToUnixTimestamp($event->dtend)%86400 === 0) ? $dtend->format('d.m.Y') : $dtend->format('d.m.Y H:i').' Uhr');
          } else {
            $time = ($ical->iCalDateToUnixTimestamp($event->dtstart)%86400 === 0) ? $dtstart->format('d.m.Y') : $dtstart->format('d.m.Y, H:i').' Uhr';
          }
          $res .= '<li>'.
          '<time>'.$time.'</time>'.
          '<h3>'.$event->summary.'</h3>'.
          $event->location.'</li>';
        }
        return $res.'</ul><div class="ics-subscribe">
          <a href="'.$tag->attr('calendar').'">Kalender abonnieren</a>
        </div>';
      }
    ]
  ]
]);
?>
