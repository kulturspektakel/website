<?php snippet('header') ?>

<section class="container">
	<?php echo kirbytext($page->text()) ?>
</section>

<?php foreach ($page->children() as $subpage) {
  snippet('subpage', array('page' => $subpage));
} ?>

<?php snippet('footer') ?>
