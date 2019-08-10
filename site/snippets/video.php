<a href="<?= $video->url() ?>" class="album-title">
  <h2>
    <?= $video->title() ?>
  </h2>
</a>
<?= youtube($video->link()) ?>
