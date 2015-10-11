<?php snippet('header') ?>

<section class="container">
	<h1><?php echo kirbytext($page->title()) ?></h1>
	<ul class="plakat-liste">
		<?php $posters = $page->posters()->yaml(); ?>
		<?php foreach($posters as $poster) { ?>
			<li style="background-image: url('/content/plakate/<?php echo $poster['image']; ?>')">
				<?php if (strlen($poster['image'])==0) { ?><h2 class="fallback-year"><?php echo $poster['year']; ?></h2><?php } else { ?>
					<a class="open-gallery" href="/content/plakate/<?php echo $poster['image']; ?>"></a>
				<?php } ?>
				<div class="poster" >
					<?php if (strlen($poster['designer'])==0 && strlen($poster['motiv'])==0) { ?>
						<span class="missing"><?php echo kirbytext($page->missing()) ?></span>
					<?php } else { ?>
						<h2><?php echo $poster['year']; ?></h2>
						<?php if (strlen($poster['designer'])>0) { ?><strong>Entwurf:</strong> <?php echo $poster['designer']; ?><br /><?php } ?>
						<?php if (strlen($poster['motiv'])>0) { ?><strong>Motiv:</strong> <?php echo $poster['motiv']; ?><?php } ?>
					<?php } ?>
				</div>
			</li>
		<?php } ?>
	</ul>
</section>



<?php snippet('footer') ?>
