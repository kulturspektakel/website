<!DOCTYPE html>
<html lang="de">
<head>
	<meta charset="utf-8" />

	<title><?php echo html($site->title()) ?><?php if (!$page->isHomepage()) {echo " | ".html($page->title());} ?></title>
	<meta name="description" content="<?php echo html($site->infotext()) ?>" />
	<meta name="viewport" content="width=device-width">

	<link rel="shortcut icon" href="/assets/img/logo.png">
	<link rel="apple-touch-icon" href="/assets/img/logo.png">

	<link rel="canonical" href="<?php echo $page->isHomepage() ? $site->url() : str_replace('/home', '', $page->url()); ?>" />

	<meta property="og:title" content="<?php echo $page->isHomepage() ? $site->title() : $page->title(); ?>" />
	<meta property="og:image" content="<?php echo $og_image ? $og_image : "http://kulturspektakel.de/assets/img/logo.png"; ?>" />
	<meta property="og:type" content="article" />
	<meta property="og:url" content="<?php echo $page->isHomepage() ? $site->url() : str_replace('/home', '', $page->url()); ?>" />
	<meta property="og:description" content="<?php echo $og_description ? $og_description : $site->infotext(); ?>" />
	<meta property="og:site_name" content="Kulturspektakel" />

	<meta name="twitter:card" content="summary" />
	<meta name="twitter:site" content="@kulturspektakel" />
	<meta name="twitter:title" content="<?php echo $page->isHomepage() ? $site->title() : $page->title(); ?>" />
	<meta name="twitter:description" content="<?php echo $og_description ? $og_description : $site->infotext(); ?>" />
	<meta name="twitter:image" content="<?php echo $og_image ? $og_image : "http://kulturspektakel.de/assets/img/logo.png"; ?>" />

	<meta name="google-site-verification" content="pSQ1fDcPPCIcZ0sc63qakZdFcbMhz_02qld4RVxo4Hk" />
	<?php
	echo css(array(
		'//fonts.googleapis.com/css?family=Lato:300,400,300italic,400italic',
		'/bower_components/bootstrap/dist/css/bootstrap.min.css',
		'/bower_components/bootstrap-select/dist/css/bootstrap-select.min.css',
		'/bower_components/fontawesome/css/font-awesome.min.css',
		'/bower_components/swipebox/src/css/swipebox.css',
		'/assets/style.php/_main.scss',
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
				<?php snippet('now-playing') ?>
				<a class="branding" href="<?php echo url() ?>" id="logo" oncontextmenu="return false">
					<img src="<?php echo url('assets/img/logo-text-right-white.svg') ?>" alt="<?php echo html($site->title()) ?>" />
				</a>
				<h2>
				<?php echo $site->eventdate(); ?></h2>
				<?php snippet('menu') ?>
			</div>
		</header>
		<main class="content" role="main">
