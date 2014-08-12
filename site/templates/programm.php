<?php snippet('header') ?>

  <main class="content" role="main">
    
    
    <section class="container">
      <div class="row">
        <div class="col-xs-9">
          <h1><?php echo html($page->title()) ?></h1>
        </div>
        <div class="col-xs-3">
        <select class="form-control selectpicker">
          <option>2010</option>
          <option>2011</option>
          <option>2012</option>
          <option>2013</option>
          <option selected="selected">2014</option>
        </select>
      </div>
    </div>
      <hr />
      <div class="row">
        <?php snippet('programm-table', array('tag' => "Freitag", 'bands' => filterByStagetimes($page->children(),"Freitag"))) ?>
        <?php snippet('programm-table', array('tag' => "Samstag", 'bands' => filterByStagetimes($page->children(),"Samstag"))) ?>
        <?php snippet('programm-table', array('tag' => "Sonntag", 'bands' => filterByStagetimes($page->children(),"Sonntag"))) ?>
      </div>
    </section>
  </main>

<?php snippet('footer') ?>