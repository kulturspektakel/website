<?php
	kirbytext::$tags['eventbutton'] = array(
		'html' => function($tag) {
			$r = '<a class="btn btn-danger btn-block" target="_blank" onclick="fbq(\'track\', \'CompleteRegistration\');" href="'.$tag->attr('link').'">';
			$r .= $tag->attr('eventbutton');
			$r .= '</a>';
			return $r;
		}
	);
?>
