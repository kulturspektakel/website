<!DOCTYPE html>
<html lang="en">
<head>

	<meta charset="utf-8" />
	
	<title><?php echo html($site->title()) ?> | <?php echo html($page->title()) ?></title>
	<meta name="description" content="<?php echo html($site->description()) ?>" />
	
	<?php
	echo css(array(
		'http://fonts.googleapis.com/css?family=Lato:300,700,300italic',
		'/bower_components/bootstrap/dist/css/bootstrap.min.css',
		'/bower_components/bootstrap-select/dist/css/bootstrap-select.min.css',
		'/bower_components/jquery/dist/jquery.min.js',
		'/bower_components/fontawesome/css/font-awesome.min.css',
		'/assets/css/screen.css',
	));
	?>
	
	<?php
	echo js(array(
		'/bower_components/jquery/dist/jquery.min.js',
		'/bower_components/bootstrap/dist/js/bootstrap.min.js',
		'/bower_components/bootstrap-select/dist/js/bootstrap-select.min.js',
		'/bower_components/unveil/jquery.unveil.min.js',
		'/assets/js/domscript.js',
	));
	?>

</head>
<body>

	<header class="cf" role="banner">
		<div class="container">
			<a class="branding" href="<?php echo url() ?>"><img src="<?php echo url('assets/img/logo.png') ?>" width="115" height="41" alt="<?php echo html($site->title()) ?>" /></a>
			<?php snippet('menu') ?>
		</div>
	</header>
	