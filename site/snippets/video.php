<a href="<?= $video->url() ?>" class="album-title">
  <h2>
    <?= $video->title() ?>
  </h2>
</a>
<figure class="video">
  <?= video($video->link(), [], ['frameborder' => 0]) ?>
</figure>
