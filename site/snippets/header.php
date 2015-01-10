<!DOCTYPE html>
<html lang="de">
<head>

	<meta charset="utf-8" />
	
	<title><?php echo html($site->title()) ?><?php if (!$page->isHomepage()) {echo " | ".html($page->title());} ?></title>
	<meta name="description" content="<?php echo html($site->description()) ?>" />
	<meta name="viewport" content="width=device-width">
	
	<link rel="shortcut icon" href="/assets/img/logo.png"> 
	<link rel="apple-itouch-icon" href="/assets/img/logo.png"> 
	<meta property="og:title" content="<?php if ($page->isHomepage()) {echo $site->title();} else {echo $page->title();} ?>" /> 
	<meta property="og:image" content="/assets/img/logo.png" /> 
	<meta name="google-site-verification" content="OrRSgLJfcndG9W-6TZFHHmmvGhUFw8lfbgS92PGT2Fg" />
	<?php
	echo css(array(
		'http://fonts.googleapis.com/css?family=Lato:300,400,300italic,400italic',
		'/bower_components/bootstrap/dist/css/bootstrap.min.css',
		'/bower_components/bootstrap-select/dist/css/bootstrap-select.min.css',
		'/bower_components/fontawesome/css/font-awesome.min.css',
		'/bower_components/swipebox/src/css/swipebox.css',
		'/assets/style.php/_main.scss',
	));
	?>
	
	<?php
	echo js(array(
		'/bower_components/jquery/dist/jquery.min.js',
		'/bower_components/lodash/dist/lodash.min.js',
		'/bower_components/bootstrap/dist/js/bootstrap.min.js',
		'/bower_components/typeahead.js/dist/typeahead.jquery.min.js',
		'/bower_components/bootstrap-select/dist/js/bootstrap-select.min.js',
		'/bower_components/unveil/jquery.unveil.min.js',
		'/bower_components/swipebox/src/js/jquery.swipebox.js',
		'/bower_components/sticky/jquery.sticky.js',
		'/bower_components/fastclick/lib/fastclick.js',
		'http://maps.google.com/maps/api/js?sensor=true',
		'/assets/js/instafeed.js',
		'/assets/js/domscript.js',
	));
	?>
</head>

<body class="<?php echo str_replace("/"," ",$_SERVER['REQUEST_URI']) ?><?php if ($_SERVER['REQUEST_URI']=="/") echo "home "; ?>">
	<div class="wrapper">
		<header class="hero" role="banner">
			<a class="nav-logo" href="<?php echo url() ?>">
				<img src="<?php echo url('assets/img/logo.svg') ?>" />
			</a>
			<a class="mobile-nav">
				<span class="line line-1"></span>
				<span class="line line-2"></span>
				<span class="line line-3"></span>
			</a>
			<div class="container">
				<a class="branding" href="<?php echo url() ?>" id="logo" oncontextmenu="return false">
					<img src="<?php echo url('assets/img/logo-text-right-white.svg') ?>" alt="<?php echo html($site->title()) ?>" />
				</a>
				<h2>
					<?php echo $site->eventdate(); ?></h2>
				<?php snippet( 'menu') ?>
			</div>
		</header>
		<main class="content" role="main">
