<?php if(!defined('KIRBY')) exit ?>

title: Posters
pages:
  template: posters
  sort: date desc
fields:
  title:
    label: Titel
    type: text
  text:
    label: text
    type: textarea
  competitionPosters:
    label: Einsendungen
    type: structure
    entry: >
      {{designer}}
    fields:
      designer:
        label: Designer (wird nicht angezeigt)
        type: text
     image:
       label: Bild
       type: select
       options: images
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
       type: select
       options: images
