<?php snippet('header'); ?>
<section class="container">
  <?php if (kirbytext($page->parent()->bookinginfo())) { ?>
  <div class="bookinginfo">
    <?php echo kirbytext($page->parent()->bookinginfo()) ?>
  </div>
  <?php } ?>

  <div class="row">
    <div class="col-sm-7">
      <h1>
        Lineup <?= $page->title() ?>
      </h1>
    </div>
    <div class="col-sm-5" id="searchcontrol">
      <?php $years = $page->parent()->children()->filterBy('visibility','true')->sortBy('title')->flip()->pluck('title') ?>
      <a id="q-bandsearch"><i class="fa fa-search"></i></a>
      <input class="form-control" placeholder="Nach Bands suchen..." id="bandsearch" type="search" />
      <select class="form-control selectpicker yearSelector">
        <?php foreach ($years as $year) { ?>
          <option value="<?=$year ?>" <?php if ($page->title() == $year) {echo 'selected="selected"';}?>><?=$year ?></option>
        <?php } ?>
      </select>
    </div>
  </div>
  <div class="row">
    <div class="col-sm-12 visible-xs-block">
      <select class="form-control selectpicker stageSelector-mobile">
        <option value="" selected="selected">alle Bühnen</option>
        <option value="GB">Große Bühne</option>
        <option value="KB">Kultbühne</option>
        <option value="WB">Waldbühne</option>
        <option value="A" >Aula</option>
        <option value="DJ">DJ-Area</option>
      </select>
    </div>
    <div class="col-sm-12 visible-xs-block">
      <select class="form-control selectpicker daySelector-mobile">
        <option value="" selected="selected">alle Tage</option>
        <option value="Freitag">Freitag</option>
        <option value="Samstag">Samstag</option>
        <option value="Sonntag">Sonntag</option>
      </select>
    </div>
    <div class="stages hidden-xs">
      <div class="stageSelector">
        <label class="active">
          <input type="radio" value="" name="stageSelector" checked="checked">alle&nbsp;Bühnen
        </label>
      </div>
      <div class="stageSelector">
        <label class="GB">
          <input type="radio" value="GB" name="stageSelector">Große&nbsp;Bühne
        </label>
      </div>
      <div class="stageSelector">
        <label class="KB">
          <input type="radio" value="KB" name="stageSelector">Kultbühne
        </label>
      </div>
      <div class="stageSelector">
        <label class="WB">
          <input type="radio" value="WB" name="stageSelector">Waldbühne
        </label>
      </div>
      <div class="stageSelector">
        <label class="A">
          <input type="radio" value="A" name="stageSelector">Aula
        </label>
      </div>
      <div class="stageSelector">
        <label class="DJ">
          <input type="radio" value="DJ" name="stageSelector">DJ-Area
        </label>
      </div>
    </div>
  </div>
  <div class="row">
    <?php snippet( 'lineup-row', array('tag'=>"Freitag", 'bands' => $page->children()->filterBy("day","Freitag")->sortBy("time","asc"))) ?>
    <?php snippet( 'lineup-row', array('tag'=>"Samstag", 'bands' => $page->children()->filterBy("day","Samstag")->sortBy("time","asc"))) ?>
    <?php snippet( 'lineup-row', array('tag'=>"Sonntag", 'bands' => $page->children()->filterBy("day","Sonntag")->sortBy("time","asc"))) ?>
  </div>
</section>

<?php snippet( 'footer') ?>
<script>
  $(function() {
    if (document.location.hash) {
      $(document.location.hash).click();
    }
  });
</script>
