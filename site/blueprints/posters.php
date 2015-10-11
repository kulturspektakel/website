<?php if(!defined('KIRBY')) exit ?>

title: Posters
pages:
  template: posters
  sort: date desc
fields:
  title:
    label: Titel
    type: text
  missing:
    label: Fehlendes Plakat
    type: textarea
  posters:
    label: Plakate
    type: structure
    entry: >
      {{year}} {{designer}}<br />
      {{motiv}}
    fields:
      designer:
        label: Designer
        type: text
      year:
        label: Jahr
        type: number
      motiv:
        label: Motiv
        type: text
     image:
       label: Bild
       type: text
