<?php

/*

---------------------------------------
License Setup
---------------------------------------

Please add your license key, which you've received
via email after purchasing Kirby.

If you have no license yet, please buy one:
http://getkirby.com/buy and support an indie developer.

You are not allowed to run a website without a valid license key.
Please read the End User License Agreement for more information:
http://getkirby.com/license

*/

c::set('license', 'put your license key here');

/*

---------------------------------------
Kirby Configuration
---------------------------------------

By default you don't have to configure anything to
make Kirby work. For more fine-grained configuration
of the system, please check out http://getkirby.com/docs

*/

ini_set('memory_limit', '-1');

function stagenames($shorthand) {
	$shorthand = (string)$shorthand;
	$name = array(
		"GB" => "Große&nbsp;Bühne",
		"KB" => "Kleine&nbsp;Bühne",
		"WB" => "Waldbühne",
		"A"  => "Aula",
		"DJ" => "DJ-Eck"
	);
	return $name[$shorthand];
}

c::set('routes', array(
	array(
		'pattern' => 'archiv',
		'action'  => function() {
			$data = array(
			  'archive' => true
			);

			return array('home', $data);
		}
	),
	array(
		'pattern' => 'wiki',
		'action'  => function() {
			go('http://wiki.kulturspektakel.de');
		}
	),
	array(
		'pattern' => 'mail',
		'action'  => function() {
			go('https://mail.bxdc.de/owa');
		}
	),
	array(
		'pattern' => 'shop/order',
		'method' => 'POST',
		'action'  => function() {
			mail("info@kulturspektakel.de","Kult Shop Bestellung",print_r($_POST,true));
			echo "ok";
		}
	),
	array(
		'pattern' => 'search',
		'action'  => function() {
			$result = array();
			foreach (page('lineup')->search(get('q'),'title') as $page) {
				$x = array();
				$x['name'] = (string) $page->title();
				$x['year'] = (string) $page->parent()->title();
				$x['url']  = (string) $page->url();
				array_push($result,$x);
			}
			return response::json($result);
		}
	),
	array(
		'pattern' => 'feed',
		'action'  => function() {
			echo page('home')->children()->sortBy('date', 'desc')->limit(10)->feed(array(
				'title'       => 'Kulturspektakel Gauting',
				'description' => 'asd',
				'link'        => 'asd'
			));
		}
	),
	array(
		'pattern' => '(:any)',
		'action'  => function($uid) {
			$page = page($uid);
			if(!$page) $page = page('home/' . $uid);
			if(!$page) $page = site()->errorPage();
			return site()->visit($page);
		}
	),
	array(
		'pattern' => 'home/(:any)',
		'action'  => function($uid) {
			go($uid);
		}
	)
));

function cleanKirbytext($text, $allowedTags = '') {
	return strip_tags(kirbytext($text), $allowedTags);
}

//c::set('cache', true);
c::set('cache.ignore', array(
  'home',
  'search'
));

kirby()->hook('panel.page.create', function($page) {
	$message = "Neue Seite angelegt: <".$page->url()."|".$page->title().">";
	file_get_contents("http://dev.kulturspektakel.de/slack.php?data=".urlencode($message));
});

kirby()->hook('panel.page.update', function($page) {
	$message = "Seite aktualisiert: <".$page->url()."|".$page->title().">";
  file_get_contents("http://dev.kulturspektakel.de/slack.php?data=".urlencode($message));
});


//c::set('debug', true);
