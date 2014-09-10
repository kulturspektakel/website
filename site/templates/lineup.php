<?php snippet('header') ?>
  <section class="container">
    <div class="row">
      <div class="col-xs-9">
        <h1><?php echo html($page->title()) ?></h1>
      </div>
      <div class="col-xs-3">
      <select class="form-control selectpicker">
        <option>2010</option>
        <option>2011</option>
        <option value="2012">2012</option>
        <option>2013</option>
        <option selected="selected">2014</option>
      </select>
    </div>
  </div>
    <hr />
    <div class="row">
      <div class="col-sm-12">
        <label class="checkbox-inline">
          <input type="checkbox" id="inlineCheckbox1" value="option1"> Große Bühne
        </label>
        <label class="checkbox-inline">
          <input type="checkbox" id="inlineCheckbox2" value="option2"> Kleine Bühne
        </label>
        <label class="checkbox-inline">
          <input type="checkbox" id="inlineCheckbox3" value="option3"> Waldbühne
        </label>
        <label class="checkbox-inline">
          <input type="checkbox" id="inlineCheckbox3" value="option3"> Aula
        </label>
        <label class="checkbox-inline">
          <input type="checkbox" id="inlineCheckbox3" value="option3"> DJ-Eck
        </label>
      </div>
    </div>
    <div class="row">
      <?php snippet('lineup-row', array('tag' => "Freitag", 'bands' => filterByStagetimes($page->children(),"Freitag"))) ?>
      <?php snippet('lineup-row', array('tag' => "Samstag", 'bands' => filterByStagetimes($page->children(),"Samstag"))) ?>
      <?php snippet('lineup-row', array('tag' => "Sonntag", 'bands' => filterByStagetimes($page->children(),"Sonntag"))) ?>
    </div>
  </section>

<?php snippet('footer') ?>