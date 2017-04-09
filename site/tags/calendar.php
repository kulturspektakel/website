<?php

	include 'ICal/ICal.php';
	include 'ICal/EventObject.php';
	use ICal\ICal;
	kirbytext::$tags['calendar'] = array(
		'html' => function($tag) {
			$ical = new ICal($tag->attr('calendar'), array(
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
	);
?>
