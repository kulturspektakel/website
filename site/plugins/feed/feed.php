<?php

/**
 * Feed Plugin
 *
 * @author Bastian Allgeier <bastian@getkirby.com>
 * @version 2.0.0
 */
Pages::$methods['feed'] = function($pages, $params = array()) {

	$html = array();
	foreach ($pages->get('lineup/2017')->children() as $band) {
		array_push($html, array(
			'title' => $band.'',
			'name' => $band->title().'',
			'day' => $band->day().'',
			'stage' => $band->stage().'',
			'time' => $band->time().'',
			'shortDescription' => ''.$band->shortDescription()
		));
	}

	return json_encode($html);

};

?>
