<?php
  if (false) {
    setlocale(LC_TIME, 'de_DE');
    date_default_timezone_set("Europe/Berlin");
    $weekday = strftime('%A');
    $year = strftime('%Y');
    $stages = array("GB","KB","WB","A");

    echo '<div class="now-playing"><h1>#kult2016</h1>';
    foreach ($stages as $stage) {
      $stageline = "";
      foreach ($pages->findBy('uid', 'lineup')->children()->findBy('uid',$year)->children()->filterBy('day',$weekday)->filterBy('stage',$stage)->sortBy('time', 'asc') as $band) {
        $bandtime = intval(preg_replace("/[^0-9]/", "", $band->time()));
        $currenttime = intval(preg_replace("/[^0-9]/", "", date("Hi")));


        if ($currenttime - $bandtime > 0 && $currenttime - $bandtime < 100) {
          $stageline .= '<div class="nowplaying"><span class="label now">jetzt&nbsp;</span><a href="'.$band->url().'">'. $band->title().'</a></div>';
        }

        if ($bandtime - $currenttime > 0 && $bandtime - $currenttime < 100) {
          $stageline .= '<div class="nextup"><span class="label next">'.$band->time().'&nbsp;</span>'. $band->title() ."</div>";
        }
      }
      if (strlen($stageline) > 0) {
        echo '<h4>'.stagenames($stage).'</h4>'.$stageline;
      }
    }
    echo '</div>';
  }
?>
