<?php
	kirbytext::$tags['eventbutton'] = array(
		'html' => function($tag) {
			return '<a class="btn btn-danger btn-block" target="_blank" onclick="fbq(\'track\', \'CompleteRegistration\');" href="' . $tag->attr('eventbutton') . '">' . $tag->attr('text') . '</a>';
		}
	);
?>
