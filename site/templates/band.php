<?php snippet('header') ?>

	<main class="content" role="main">
		<section class="container">
			<h1><?= $page->title() ?></h1>
			
			<div class="row">
				<div class="col-sm-8">
					<?= kirbytext($page->description()) ?>
				</div>
				<div class="col-sm-4">
					<? if (bandPlays($page->stagetimes())) { ?>
					<div class="row">
						<div class="col-xs-12">
							<div class="band-stagetime gb">
								<span class="light"><?= substr(bandPlays($page->stagetimes())->day,0,2) ?></span>
								<?= bandPlays($page->stagetimes())->time ?><br />
								<span class="light band-stagetime-stage"><?= bandPlays($page->stagetimes())->stage ?></span>
							</div>
						</div>
					</div>
					<? } ?>
					<div class="row band-socialmedia">
						<? if(strlen($page->website())>0)    { ?><div class="col-xs-4"><a href="<?=$page->website() ?>" target="_blank"><i class="fa fa-globe"></i> </a></div><? } ?>
						<? if(strlen($page->facebook())>0)   { ?><div class="col-xs-4"><a href="<?=$page->facebook() ?>" target="_blank"><i class="fa fa-facebook"></i></a></div><? } ?>
						<? if(strlen($page->youtube())>0)    { ?><div class="col-xs-4"><a href="<?=$page->youtube() ?>" target="_blank"><i class="fa fa-youtube"></i></a></div><? } ?>
						<? if(strlen($page->soundcloud())>0) { ?><div class="col-xs-4"><a href="<?=$page->soundcloud() ?>" target="_blank"><i class="fa fa-soundcloud"></i></a></div><? } ?>
						<? if(strlen($page->twitter())>0)    { ?><div class="col-xs-4"><a href="<?=$page->twitter() ?>" target="_blank"><i class="fa fa-twitter"></i> </a></div><? } ?>
					</div>
					
					<h4>Bisherige Auftritte</h4>
					<ul class="past-events">
						<li class="gb">
							<a href="/lineup#2012">
								<span class="year">2012</span> SO Kleine Bühne
							</a>
						</li>
						<li class="gb">
							<a href="/lineup#2012">
								<span class="year">2012</span> SO Kleine Bühne
							</a>
						</li>
					</ul>
				</div>
			</div>
			
		</section>
	</main>

<?php snippet('footer') ?>