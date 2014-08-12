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

function stagetimeParser($string) {
	$ra = array();
	foreach (explode("\n-",$string) as $s) {
		$ro = new stdClass();
		foreach (explode("\n",$s) as $o) {

			if (strpos($o, ':') === FALSE) continue;
			else {
				$key = current(explode(":",$o));
				$value = substr($o, strlen($key)+2);
				$key = trim($key);
				$ro->$key = $value;
			}
		}
		array_push($ra,$ro);
	}
	usort($ra, "revsort");
	return $ra;
}

function revsort($a, $b) {
	return -strcmp($a->year, $b->year);
}

function filterByStagetimes($o,$d,$y=false) {
	$a = array();
	foreach ($o as $i) {
		$s = stagetimeParser($i->stagetimes()->toString());
		foreach ($s as $t) {
			if ((!$y || $t->year==$y) && strtolower($t->day)==strtolower($d)) {
				array_push($a,$i);
				break;
			}
		};  
	}
	return $a;
}

function bandPlays($s,$y = "") {
	if ($y=="") $y=date('Y');
	$s = stagetimeParser($s);
	foreach ($s as $a) {
		if ($a->year==$y) return $a;
	}
	return false;
}


function listBands($bands,$tag) {
	$ra = array();
	foreach($bands as $band) {
		$stagetimes = stagetimeParser($band->stagetimes());
		foreach ($stagetimes as $stagetime) {
			if ($stagetime->day!=$tag) continue;
			$rb = clone $band;
			$rb->stagetime = $stagetime;
			
			array_push($ra,$rb);
		}
	}
	usort($ra, "revsort");
	//TODO SORTING
	return $ra;
}

